import {
  getAuth,
  createConnection,
  subscribeEntities,
  callService,
} from "home-assistant-js-websocket";
import { safeHassUrl } from "./core.js";
const TOKEN_KEY = "evim.ha.session";
const URL_KEY = "evim.ha.url";
export const rememberedUrl = () => localStorage.getItem(URL_KEY) || "";
export const hasSession = () => !!sessionStorage.getItem(TOKEN_KEY);
export const isCallback = () =>
  new URLSearchParams(location.search).has("auth_callback");
let current;
export async function connectHomeAssistant(rawUrl, onEntities, onStatus) {
  const hassUrl = safeHassUrl(
    rawUrl || rememberedUrl(),
    location.protocol === "https:",
  );
  localStorage.setItem(URL_KEY, hassUrl);
  onStatus("connecting");
  const auth = await getAuth({
    hassUrl,
    clientId: location.origin + "/",
    redirectUrl: location.origin + "/",
    limitHassInstance: true,
    saveTokens: (tokens) =>
      tokens
        ? sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
        : sessionStorage.removeItem(TOKEN_KEY),
    loadTokens: async () => {
      try {
        return (
          JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null") || undefined
        );
      } catch {
        return undefined;
      }
    },
  });
  const connection = await createConnection({
    auth,
    setupRetry: 0,
    connectTimeout: 12000,
  });
  current?.connection.close();
  current = { connection, auth };
  const reportStatus = (status) => {
    if (current?.connection === connection) onStatus(status);
  };
  connection.addEventListener("ready", () => reportStatus("connected"));
  connection.addEventListener("disconnected", () =>
    reportStatus("disconnected"),
  );
  connection.addEventListener("reconnect-error", () =>
    reportStatus("disconnected"),
  );
  subscribeEntities(connection, (entities) => {
    if (current?.connection === connection) onEntities(entities);
  });
  onStatus("connected");
  history.replaceState({}, "", location.pathname);
  return current;
}
export async function command(domain, service, data = {}, target) {
  if (!current?.connection.connected)
    throw new Error("Home Assistant bağlantısı yok. Komut gönderilmedi.");
  let timer;
  try {
    return await Promise.race([
      callService(current.connection, domain, service, data, target),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Komut sonucu zamanında alınamadı. Tekrar göndermeden cihaz durumunu kontrol edin.",
              ),
            ),
          12000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function disconnectHomeAssistant() {
  const saved = current;
  current = undefined;
  sessionStorage.removeItem(TOKEN_KEY);
  saved?.connection.close();
  if (saved) await saved.auth.revoke();
}
export function connectionError(error) {
  if (error instanceof Error) return error.message;
  if (error?.message) return String(error.message);
  return (
    {
      1: "Sunucuya ulaşılamadı. HTTPS adresini ve erişim bağlantısını kontrol edin.",
      2: "Oturum doğrulanamadı. Yeniden giriş yapın.",
      3: "Sunucuyla bağlantı kesildi. Cihazın son durumunu kontrol edin.",
      4: "Home Assistant adresi gerekli.",
      5: "HTTPS siteden HTTP sunucuya bağlanılamaz.",
      6: "Oturum dönüşü doğrulanamadı. Bağlantıyı yeniden başlatın.",
    }[error] ||
    "Bağlantı kurulamadı. Sunucu adresini ve oturumunuzu kontrol edin."
  );
}
export async function haMessage(message) {
  if (!current?.connection.connected)
    throw new Error("Önce Home Assistant’a bağlanın.");
  let timer;
  try {
    return await Promise.race([
      current.connection.sendMessagePromise(message),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Sunucu yanıt vermedi. Bağlantıyı kontrol edip yeniden deneyin.",
              ),
            ),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function loadMetadata() {
  const requests = {
    config: "get_config",
    services: "get_services",
    user: "auth/current_user",
    areas: "config/area_registry/list",
    devices: "config/device_registry/list",
    entities: "config/entity_registry/list",
  };
  const results = await Promise.allSettled(
    Object.values(requests).map((type) => haMessage({ type })),
  );
  const data = { warnings: [] };
  Object.keys(requests).forEach((key, i) => {
    const r = results[i];
    if (r.status === "fulfilled") data[key] = r.value;
    else data.warnings.push(key);
  });
  if (data.config)
    data.config = {
      time_zone: data.config.time_zone,
      version: data.config.version,
      unit_system: data.config.unit_system,
    };
  return data;
}
export async function haRequest(path, method = "GET", body) {
  const session = current;
  if (!session?.connection.connected)
    throw new Error("Home Assistant bağlantısı yok.");
  if (!/^config\/automation\/config\/evim_[a-f0-9]{32}$/.test(path))
    throw new Error("Geçersiz otomasyon yolu.");
  if (session.auth.expired) await session.auth.refreshAccessToken();
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(session.auth.hassUrl + "/api/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + session.auth.accessToken,
        "Content-Type": "application/json",
      },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const error = new Error(
        response.status === 403
          ? "Bu işlem için Home Assistant yönetici hesabı gerekli."
          : response.status === 404
            ? "Sunucuda bu program bulunamadı."
            : "Home Assistant işlemi tamamlamadı (" + response.status + ").",
      );
      error.status = response.status;
      throw error;
    }
    const content = await response.text();
    return content ? JSON.parse(content) : null;
  } catch (e) {
    if (e.name === "AbortError")
      throw new Error(
        "Sunucu yanıtı gecikti. Sonucu denetlemeden tekrar aktarmayın.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export const loadEnergyStatistics = (ids, range) =>
  haMessage({
    type: "recorder/statistics_during_period",
    start_time: range.start.toISOString(),
    end_time: range.end.toISOString(),
    statistic_ids: ids,
    period: range.period,
    units: { energy: "kWh" },
    types: ["change"],
  });
