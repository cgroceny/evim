import { HttpError } from "./cloud.js";

const readableDomains = new Set(["sensor", "binary_sensor", "switch"]);

function selectReadings(states, entityIds) {
  return states.flatMap((entry) => {
    const id = entry?.entity_id;
    if (typeof id !== "string" || !/^[a-z_]+\.[a-z0-9_]+$/.test(id))
      return [];
    const domain = id.split(".")[0];
    if (!readableDomains.has(domain) || (entityIds.size && !entityIds.has(id)))
      return [];
    if (typeof entry.state !== "string") return [];

    const name = entry.attributes?.friendly_name;
    const unit = entry.attributes?.unit_of_measurement;
    return [{
      id,
      domain,
      name: typeof name === "string" && name.trim() ? name.slice(0, 160) : id,
      value: entry.state.slice(0, 255),
      unit: typeof unit === "string" ? unit.slice(0, 32) : "",
    }];
  });
}

export async function readHomeAssistant(
  user,
  { env = process.env, fetchImpl = globalThis.fetch } = {},
) {
  const owner = env.HA_OWNER_USERNAME?.trim();
  if (owner && user?.username !== owner)
    throw new HttpError(403, "Bu hesap için ev sunucusu erişimi açık değil.");

  const url = env.HA_BASE_URL?.trim();
  const token = env.HA_ACCESS_TOKEN?.trim();
  if (!owner || !url || !token)
    return { status: "unconfigured", readings: [] };

  let origin;
  try {
    origin = new URL(url);
  } catch {
    throw new HttpError(503, "Ev sunucusunun HTTPS adresi geçersiz.");
  }
  if (
    origin.protocol !== "https:" ||
    origin.pathname !== "/" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash
  )
    throw new HttpError(503, "Ev sunucusunun HTTPS adresi geçersiz.");

  const headers = { Accept: "application/json", Authorization: "Bearer " + token };
  const accessId = env.HA_CF_ACCESS_CLIENT_ID?.trim();
  const accessSecret = env.HA_CF_ACCESS_CLIENT_SECRET?.trim();
  if (Boolean(accessId) !== Boolean(accessSecret))
    throw new HttpError(503, "Ev sunucusunun Cloudflare erişim ayarları eksik.");
  if (accessId) {
    headers["CF-Access-Client-Id"] = accessId;
    headers["CF-Access-Client-Secret"] = accessSecret;
  }

  let response;
  try {
    response = await fetchImpl(new URL("/api/states", origin), {
      method: "GET",
      headers,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw new HttpError(504, "Ev sunucusunun yanıtı gecikti.");
    throw new HttpError(502, "Ev sunucusuna ulaşılamadı.");
  }

  if (response.status === 401)
    throw new HttpError(502, "Home Assistant erişim jetonunu kabul etmedi.");
  if (response.status === 403)
    throw new HttpError(502, "Ev sunucusu bağlantı isteğini reddetti.");
  if (!response.ok)
    throw new HttpError(502, "Ev sunucusu ölçümleri gönderemedi.");

  let states;
  try {
    states = await response.json();
  } catch {
    throw new HttpError(502, "Ev sunucusundan geçerli ölçüm verisi alınamadı.");
  }
  if (!Array.isArray(states))
    throw new HttpError(502, "Ev sunucusundan geçerli ölçüm verisi alınamadı.");

  const entityIds = new Set(
    (env.HA_ENTITY_IDS || "").split(",").map((id) => id.trim()).filter(Boolean),
  );
  return {
    status: "connected",
    readAt: new Date().toISOString(),
    readings: selectReadings(states, entityIds),
  };
}
