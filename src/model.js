import { freshState, validateImport, validTime, hexToRgb } from "./core.js";
import {
  DEVICE_TYPES,
  validateDeviceAction,
  deviceCommand,
  applyDeviceAction,
} from "./devices.js";
import { ENERGY_DEFAULTS } from "./energy.js";
import { GREE_DEMO_FEATURES } from "./companions.js";
import {
  CLIMATE_OPTIONS,
  climateTarget,
  inferClimateRole,
  isRoomThermostat,
} from "./climate.js";

export const KEY = "evim.workspace.v2";
export const COLLECTIONS = [
  "rooms",
  "devices",
  "lights",
  "modes",
  "scenes",
  "programs",
];
export const LABELS = {
  rooms: "Oda",
  devices: "Cihaz",
  lights: "Lamba",
  modes: "Ev modu",
  scenes: "Senaryo",
  programs: "Program",
};
export const uid = () => crypto.randomUUID();
const copy = (x) => structuredClone(x);
const num = (v, min, max, label) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`${label}: ${min}–${max} aralığında bir değer girin.`);
  return v;
};
const text = (v, max, label, empty = false) => {
  if (typeof v !== "string" || v.length > max || (!empty && !v.trim()))
    throw new Error(
      `${label} alanını kontrol edin (en fazla ${max} karakter).`,
    );
  return v.trim();
};
const one = (v, values, label) => {
  if (!values.includes(v)) throw new Error(`${label} geçersiz.`);
  return v;
};
const bool = (v) => {
  if (typeof v !== "boolean") throw new Error("Açık/kapalı değeri geçersiz.");
  return v;
};
const color = (v) => {
  if (!/^#[\da-f]{6}$/i.test(v)) throw new Error("Renk geçersiz.");
  return v;
};
const ref = (v, list, label) => {
  if (v && !list.some((x) => x.id === v))
    throw new Error(`${label} bulunamadı.`);
  return v || "";
};
const entity = (v, domain) => {
  if (
    v &&
    (typeof v !== "string" ||
      v.length > 150 ||
      !new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(v))
  )
    throw new Error(`Home Assistant kimliği ${domain}. ile başlamalı.`);
  return v || "";
};
const anyEntity = (v) => entity(text(v, 150, "Varlık"), "[a-z_]+");
export function validateTrigger(t) {
  const type = one(t?.type, ["time", "sun", "state", "numeric"], "Tetikleyici");
  if (type === "time") return { type };
  if (type === "sun")
    return {
      type,
      event: one(t.event, ["sunrise", "sunset"], "Güneş olayı"),
      offset: num(t.offset ?? 0, -120, 120, "Dakika farkı"),
    };
  const base = {
    type,
    entityId: anyEntity(t.entityId),
    seconds: num(t.seconds ?? 0, 0, 3600, "Bekleme süresi"),
  };
  if (type === "state")
    return { ...base, to: text(t.to, 80, "Beklenen durum") };
  return {
    ...base,
    comparison: one(t.comparison, ["above", "below"], "Karşılaştırma"),
    value: num(t.value, -1e12, 1e12, "Eşik"),
  };
}
function validateConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length > 8)
    throw new Error("En fazla 8 koşul eklenebilir.");
  return conditions.map((c) => ({
    entityId: anyEntity(c.entityId),
    state: text(c.state, 80, "Koşul durumu"),
  }));
}
function validateDeployment(d) {
  if (!d) return null;
  if (
    !/^evim_[a-f0-9]{32}$/.test(d.id) ||
    !/^[a-f0-9]{64}$/.test(d.fingerprint)
  )
    throw new Error("Yayın kaydı geçersiz.");
  const url = new URL(d.server);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Yayın sunucusu geçersiz.");
  return {
    id: d.id,
    fingerprint: d.fingerprint,
    server: url.origin,
    syncedAt: num(d.syncedAt, 0, 1e15, "Yayın tarihi"),
  };
}
export function template(kind, state) {
  const base = { id: uid(), name: "" };
  return {
    rooms: {
      ...base,
      icon: "sofa",
      target: 22,
      min: 10,
      max: 28,
      sensorId: "",
      notes: "",
      overrideUntil: null,
    },
    devices: {
      ...base,
      type: "climate",
      climateRole: "independent",
      climateDemo: { temperature: 22 },
      roomId: "",
      entityId: "",
      protocol: "Wi-Fi",
      temperature: 21,
      humidity: 45,
      battery: 100,
      enabled: true,
      sensorClass: "temperature",
      unit: "",
      demoState: "off",
      demoValue: "0",
      favorite: false,
      notes: "",
    },
    lights: {
      ...base,
      roomId: "",
      entityId: "",
      protocol: "Wi-Fi",
      on: false,
      brightness: 75,
      color: "#f4ce8a",
      kelvin: 2700,
      colorMode: "white",
      enabled: true,
    },
    modes: { ...base, target: 22, icon: "home" },
    scenes: { ...base, icon: "sparkles", description: "", steps: [] },
    programs: {
      ...base,
      days: [0, 1, 2, 3, 4],
      time: "07:00",
      action: "mode",
      targetId: state?.modes?.[0]?.id || "",
      enabled: false,
      trigger: { type: "time" },
      conditions: [],
      deployment: null,
    },
  }[kind];
}
export function migrate(old) {
  const d = validateImport(old);
  const modeIds = {
    Evde: "home",
    Gece: "night",
    Dışarıda: "away",
    Tatil: "holiday",
  };
  const rooms = d.rooms.map(({ id, name, icon, target, overrideUntil }) => ({
    id,
    name,
    icon,
    target,
    overrideUntil,
    min: 10,
    max: 28,
    sensorId: "sensor-" + id,
    notes: "",
  }));
  const devices = d.rooms.flatMap((r) => [
    {
      id: "sensor-" + r.id,
      name: r.name + " sensörü",
      type: "sensor",
      roomId: r.id,
      entityId: "",
      protocol: "Zigbee",
      temperature: r.current,
      humidity: r.humidity,
      battery: r.battery,
      enabled: true,
    },
    ...Array.from({ length: r.valves }, (_, i) => ({
      id: `valve-${r.id}-${i}`,
      name: r.name + " vanası " + (i + 1),
      type: "climate",
      climateRole: "radiator",
      roomId: r.id,
      entityId: "",
      protocol: "Zigbee",
      temperature: r.current,
      humidity: r.humidity,
      battery: r.battery,
      enabled: true,
    })),
  ]);
  // Example Gree air conditioner so the demo shows every AC control.
  const acRoom = rooms.find((r) => r.id === "yatak") || rooms[0];
  if (acRoom)
    devices.push({
      id: "ac-" + acRoom.id,
      name: acRoom.name + " kliması (Gree)",
      type: "climate",
      climateRole: "independent",
      climateDemo: {
        temperature: 24,
        fan_mode: "auto",
        swing_mode: "default",
        swing_horizontal_mode: "default",
        preset_mode: "none",
        features: { light: true, xfan: true },
      },
      roomId: acRoom.id,
      entityId: "",
      protocol: "Wi-Fi",
      temperature: acRoom.current ?? 22,
      humidity: acRoom.humidity ?? 45,
      battery: 100,
      enabled: true,
      demoState: "cool",
    });
  const lights = d.lights.map(({ room, ...l }) => ({
    ...l,
    roomId: rooms.find((r) => r.name === room)?.id || "",
    entityId: "",
    protocol: "Wi-Fi",
    enabled: true,
    colorMode: "white",
  }));
  const modes = Object.entries(modeIds).map(([name, id]) => ({
    id,
    name,
    target:
      name === "Evde"
        ? d.settings.comfort
        : name === "Gece"
          ? d.settings.night
          : d.settings.away,
    icon: { home: "home", night: "moon", away: "away", holiday: "holiday" }[id],
  }));
  const scenes = [
    ["Okuma", "book", "Daha iyi odaklan"],
    ["Film", "film", "Biraz atmosfer"],
    ["Gece ışığı", "moon", "Yumuşak bir geçiş"],
    ["Kapat", "power", "Işıklara mola"],
  ].map(([name, icon, description], i) => ({
    id: "scene-" + i,
    name,
    icon,
    description,
    steps: lights.map((l, j) => ({
      id: uid(),
      type: "light",
      targetId: l.id,
      on: i === 3 ? false : i === 0 || j === 1,
      brightness: i === 0 ? 85 : i === 1 ? 20 : 5,
      color: i === 1 ? "#8e7dff" : "#f4ce8a",
      kelvin: i === 0 ? 4000 : 2700,
      colorMode: i === 1 ? "color" : "white",
    })),
  }));
  const groups = new Map();
  d.schedule.forEach((p, i) => {
    for (const [time, targetId] of [
      [p.start, "home"],
      [p.end, "night"],
    ]) {
      const key = time + targetId + p.enabled;
      const item = groups.get(key) || {
        id: uid(),
        name: (targetId === "home" ? "Gündüz" : "Gece") + " · " + time,
        days: [],
        time,
        action: "mode",
        targetId,
        enabled: p.enabled,
      };
      item.days.push(i);
      groups.set(key, item);
    }
  });
  return {
    version: 4,
    id: uid(),
    home: {
      name: d.homeName,
      title: "Evinin ritmi, elinde.",
      subtitle: "Biraz sıcaklık, doğru ışık, sana göre bir ev.",
      theme: "forest",
      timeZone: "Europe/Istanbul",
    },
    activeModeId: modeIds[d.mode],
    heating: d.heating,
    rooms,
    devices,
    lights,
    modes,
    scenes,
    programs: [...groups.values()],
    trash: [],
    events: d.events,
    updatedAt: Date.now(),
    energy: { ...ENERGY_DEFAULTS },
  };
}
export const initialState = () => validateState(migrate(freshState()));
export function validateState(input) {
  if (input?.version === 1) return validateState(migrate(input));
  if (!input || ![2, 3, 4].includes(input.version))
    throw new Error("Bu dosya desteklenen bir evim yedeği değil.");
  const out = {
    version: 4,
    id: text(input.id || uid(), 80, "Ev kimliği"),
    home: {
      name: text(input.home?.name, 60, "Ev adı"),
      title: text(input.home?.title, 100, "Başlık"),
      subtitle: text(input.home?.subtitle, 200, "Alt başlık", true),
      theme: one(input.home?.theme, ["forest", "blue", "earth"], "Tema"),
      timeZone: input.home?.timeZone || "Europe/Istanbul",
    },
    heating: bool(input.heating),
    updatedAt: Number(input.updatedAt) || Date.now(),
  };
  try {
    new Intl.DateTimeFormat("tr", { timeZone: out.home.timeZone }).format();
  } catch {
    throw new Error("Saat dilimi geçersiz.");
  }
  for (const k of COLLECTIONS) {
    if (!Array.isArray(input[k]) || input[k].length > 250)
      throw new Error(`${LABELS[k]} listesi geçersiz (en fazla 250).`);
    out[k] = input[k].map((r) => ({
      ...r,
      id: text(r?.id, 80, "Kayıt kimliği"),
      name: text(r?.name, 60, "Ad"),
    }));
    if (new Set(out[k].map((r) => r.id)).size !== out[k].length)
      throw new Error("Tekrarlanan kayıt kimliği var.");
  }
  out.devices = out.devices.map((r) => ({
    id: r.id,
    name: r.name,
    type: one(r.type, Object.keys(DEVICE_TYPES), "Cihaz türü"),
    ...(r.type === "climate"
      ? {
          climateRole: one(
            r.climateRole ?? (input.version < 4 ? "radiator" : "independent"),
            ["radiator", "independent"],
            "Klima / termostat kullanımı",
          ),
          climateDemo: {
            temperature: num(
              r.climateDemo?.temperature ?? 22,
              -20,
              60,
              "Örnek hedef sıcaklık",
            ),
            ...Object.fromEntries(
              Object.keys(CLIMATE_OPTIONS)
                .filter(
                  (op) => op !== "hvac_mode" && r.climateDemo?.[op] != null,
                )
                .map((op) => [
                  op,
                  text(r.climateDemo[op], 150, "Örnek klima ayarı"),
                ]),
            ),
            ...(r.climateDemo?.features != null
              ? {
                  features: Object.fromEntries(
                    GREE_DEMO_FEATURES.filter(
                      ([key]) => r.climateDemo.features[key] != null,
                    ).map(([key]) => [key, bool(r.climateDemo.features[key])]),
                  ),
                }
              : {}),
          },
        }
      : {}),
    roomId: ref(r.roomId, out.rooms, "Oda"),
    entityId: entity(r.entityId, r.type),
    protocol: one(
      r.protocol,
      ["Zigbee", "Wi-Fi", "Matter", "Bluetooth", "Diğer"],
      "Bağlantı türü",
    ),
    temperature: num(r.temperature, -20, 60, "Örnek sıcaklık"),
    humidity: num(r.humidity, 0, 100, "Nem"),
    battery: num(r.battery, 0, 100, "Pil"),
    enabled: bool(r.enabled),
    sensorClass: text(
      r.sensorClass ?? (r.type === "sensor" ? "temperature" : "generic"),
      50,
      "Ölçüm türü",
    ),
    unit: text(r.unit ?? "", 20, "Birim", true),
    demoState: text(r.demoState ?? "off", 80, "Örnek durum"),
    demoValue: text(r.demoValue ?? "0", 150, "Örnek değer", true),
    favorite: bool(r.favorite ?? false),
    notes: text(r.notes ?? "", 500, "Not", true),
  }));
  out.rooms = out.rooms.map((r) => {
    const min = num(r.min, 5, 35, "Alt sıcaklık sınırı"),
      max = num(r.max, min, 35, "Üst sıcaklık sınırı");
    const sensorId = ref(
      r.sensorId,
      out.devices.filter(
        (d) =>
          d.type === "sensor" &&
          d.sensorClass === "temperature" &&
          d.roomId === r.id,
      ),
      "Odanın sensörü",
    );
    return {
      id: r.id,
      name: r.name,
      icon: one(r.icon, ["sofa", "bed", "desk", "coffee"], "Oda simgesi"),
      target: num(r.target, min, max, "Oda hedefi"),
      min,
      max,
      sensorId,
      notes: text(r.notes, 500, "Not", true),
      overrideUntil: Number.isFinite(r.overrideUntil) ? r.overrideUntil : null,
      favorite: bool(r.favorite ?? false),
    };
  });
  out.lights = out.lights.map((r) => ({
    id: r.id,
    name: r.name,
    roomId: ref(r.roomId, out.rooms, "Oda"),
    entityId: entity(r.entityId, "light"),
    protocol: one(
      r.protocol,
      ["Zigbee", "Wi-Fi", "Matter", "Bluetooth", "Diğer"],
      "Bağlantı türü",
    ),
    on: bool(r.on),
    brightness: num(r.brightness, 1, 100, "Parlaklık"),
    color: color(r.color),
    kelvin: num(r.kelvin, 2000, 6500, "Beyaz tonu"),
    colorMode: one(r.colorMode, ["white", "color"], "Işık rengi"),
    enabled: bool(r.enabled),
    favorite: bool(r.favorite ?? false),
  }));
  const bindings = [...out.devices, ...out.lights]
    .map((r) => r.entityId)
    .filter(Boolean);
  if (new Set(bindings).size !== bindings.length)
    throw new Error(
      "Aynı Home Assistant varlığı birden fazla cihaza atanamaz.",
    );
  out.modes = out.modes.map((r) => ({
    id: r.id,
    name: r.name,
    target: num(r.target, 5, 35, "Mod hedefi"),
    icon: one(
      r.icon,
      ["home", "moon", "away", "holiday", "leaf"],
      "Mod simgesi",
    ),
  }));
  out.activeModeId = ref(input.activeModeId, out.modes, "Etkin mod");
  out.scenes = out.scenes.map((r) => {
    if (!Array.isArray(r.steps) || r.steps.length > 100)
      throw new Error("Senaryo adımları geçersiz.");
    return {
      id: r.id,
      name: r.name,
      description: text(r.description, 180, "Senaryo açıklaması", true),
      icon: one(
        r.icon,
        ["sparkles", "book", "film", "moon", "power", "sun"],
        "Senaryo simgesi",
      ),
      steps: r.steps.map((a) => {
        const type = one(
          a.type,
          ["light", "room", "mode", "device", "notify"],
          "Adım türü",
        );
        if (type === "notify") {
          const service = text(a.service, 120, "Bildirim kanalı");
          if (
            !/^(notify\.[a-z0-9_]+|persistent_notification\.create)$/.test(
              service,
            )
          )
            throw new Error("Bildirim kanalı geçersiz.");
          return {
            id: text(a.id, 80, "Adım kimliği"),
            type,
            service,
            title: text(a.title || "evim", 100, "Bildirim başlığı"),
            message: text(a.message, 500, "Bildirim metni"),
          };
        }
        const targetId = ref(
          a.targetId,
          type === "device"
            ? out.devices
            : type === "light"
              ? out.lights
              : type === "room"
                ? out.rooms
                : out.modes,
          "Adım hedefi",
        );
        if (!targetId)
          throw new Error("Her senaryo adımı için bir hedef seçin.");
        if (type === "device")
          return {
            id: text(a.id, 80, "Adım kimliği"),
            type,
            targetId,
            ...validateDeviceAction(
              out.devices.find((d) => d.id === targetId),
              a,
            ),
          };
        return type === "light"
          ? {
              id: text(a.id, 80, "Adım kimliği"),
              type,
              targetId,
              on: bool(a.on),
              brightness: num(a.brightness, 1, 100, "Parlaklık"),
              color: color(a.color),
              kelvin: num(a.kelvin, 2000, 6500, "Beyaz tonu"),
              colorMode: one(a.colorMode, ["white", "color"], "Işık rengi"),
            }
          : type === "room"
            ? {
                id: text(a.id, 80, "Adım kimliği"),
                type,
                targetId,
                temperature: num(
                  a.temperature,
                  out.rooms.find((x) => x.id === targetId).min,
                  out.rooms.find((x) => x.id === targetId).max,
                  "Adım hedefi",
                ),
              }
            : { id: text(a.id, 80, "Adım kimliği"), type, targetId };
      }),
    };
  });
  out.programs = out.programs.map((r) => {
    if (
      !Array.isArray(r.days) ||
      !r.days.length ||
      r.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
      new Set(r.days).size !== r.days.length ||
      !validTime(r.time)
    )
      throw new Error("Program günü ve saatini kontrol edin.");
    const action = one(r.action, ["mode", "scene"], "Program işlemi"),
      targetId = ref(
        r.targetId,
        action === "mode" ? out.modes : out.scenes,
        "Program hedefi",
      );
    if (r.enabled && !targetId)
      throw new Error("Etkin program için hedef seçin.");
    return {
      id: r.id,
      name: r.name,
      days: [...r.days].sort(),
      time: r.time,
      action,
      targetId,
      enabled: bool(r.enabled),
      trigger: validateTrigger(r.trigger || { type: "time" }),
      conditions: validateConditions(r.conditions || []),
      deployment: validateDeployment(r.deployment),
      needsPublish: bool(r.needsPublish ?? false),
    };
  });
  const energy = { ...ENERGY_DEFAULTS, ...input.energy };
  if (!Array.isArray(energy.submeters) || energy.submeters.length > 20)
    throw new Error("En fazla 20 alt sayaç seçilebilir.");
  out.energy = {
    meter: entity(energy.meter, "sensor"),
    power: entity(energy.power, "sensor"),
    submeters: [
      ...new Set(
        energy.submeters.map((e) => entity(e, "sensor")).filter(Boolean),
      ),
    ],
    tariff: num(energy.tariff, 0, 1000000, "Birim fiyat"),
    currency: one(energy.currency, ["TRY", "EUR", "USD"], "Para birimi"),
    monthlyBudget: num(energy.monthlyBudget, 0, 10000000, "Aylık kWh hedefi"),
  };
  if (out.energy.submeters.includes(out.energy.meter))
    throw new Error("Ana sayaç aynı zamanda alt sayaç olamaz.");
  // Trash is a reversible local archive; validate each item again when restoring it.
  out.trash = Array.isArray(input.trash)
    ? input.trash
        .filter(
          (x) =>
            COLLECTIONS.includes(x.kind) &&
            x.record &&
            typeof x.record.id === "string" &&
            typeof x.record.name === "string",
        )
        .slice(0, 100)
        .map((x) => ({
          id: String(x.id).slice(0, 80),
          kind: x.kind,
          record: x.record,
          deletedAt: Number(x.deletedAt) || 0,
        }))
    : [];
  out.events = Array.isArray(input.events)
    ? input.events
        .filter((e) => typeof e?.text === "string" && Number.isFinite(e.time))
        .slice(0, 60)
        .map((e) => ({ text: e.text.slice(0, 250), time: e.time }))
    : [];
  return out;
}
export function saveRecord(state, kind, record) {
  if (!COLLECTIONS.includes(kind)) throw new Error("Kayıt türü bulunamadı.");
  let next = copy(state);
  const i = next[kind].findIndex((r) => r.id === record.id);
  if (i < 0) next[kind].push(record);
  else next[kind][i] = record;
  // Moving or changing a sensor clears its former measurement assignment.
  if (kind === "devices")
    next.rooms = next.rooms.map((r) =>
      r.sensorId === record.id &&
      (record.type !== "sensor" ||
        (record.sensorClass && record.sensorClass !== "temperature") ||
        record.roomId !== r.id)
        ? { ...r, sensorId: "" }
        : r,
    );
  if (kind === "modes" && next.activeModeId === record.id)
    next = applyMode(next, record.id);
  const fields = {
    rooms: ["min", "max"],
    devices: ["enabled", "type", "entityId", "roomId", "climateRole"],
    lights: ["enabled", "entityId"],
    modes: ["target"],
    scenes: ["steps"],
    programs: [
      "name",
      "days",
      "time",
      "enabled",
      "action",
      "targetId",
      "trigger",
      "conditions",
    ],
  }[kind];
  const before = state[kind].find((x) => x.id === record.id);
  if (
    !before ||
    fields.some(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(record[key]),
    )
  )
    next.programs = next.programs.map((p) =>
      p.deployment && (kind !== "programs" || p.id === record.id)
        ? { ...p, needsPublish: true }
        : p,
    );
  return validateState(next);
}
function detach(state, kind, id) {
  const s = copy(state);
  if (kind === "rooms") {
    for (const k of ["devices", "lights"])
      s[k] = s[k].map((r) => (r.roomId === id ? { ...r, roomId: "" } : r));
  }
  if (kind === "devices")
    s.rooms = s.rooms.map((r) =>
      r.sensorId === id ? { ...r, sensorId: "" } : r,
    );
  const type = {
    rooms: "room",
    lights: "light",
    modes: "mode",
    devices: "device",
  }[kind];
  if (type)
    s.scenes = s.scenes.map((r) => ({
      ...r,
      steps: r.steps.filter((a) => !(a.type === type && a.targetId === id)),
    }));
  if (kind === "modes" || kind === "scenes")
    s.programs = s.programs.map((r) =>
      r.action === (kind === "modes" ? "mode" : "scene") && r.targetId === id
        ? { ...r, targetId: "", enabled: false }
        : r,
    );
  if (kind === "modes" && s.activeModeId === id) s.activeModeId = "";
  return s;
}
export function deleteRecord(state, kind, id) {
  const record = state[kind].find((r) => r.id === id);
  if (!record) return state;
  let s = detach(state, kind, id);
  s[kind] = s[kind].filter((r) => r.id !== id);
  s.programs = s.programs.map((p) =>
    p.deployment ? { ...p, needsPublish: true } : p,
  );
  s.trash = [
    { id: uid(), kind, record, deletedAt: Date.now() },
    ...s.trash,
  ].slice(0, 100);
  return validateState(s);
}
export function restoreRecord(state, trashId) {
  const item = state.trash.find((r) => r.id === trashId);
  if (!item) throw new Error("Silinen kayıt bulunamadı.");
  const r = copy(item.record),
    s = copy(state);
  if (s[item.kind].some((x) => x.id === r.id))
    throw new Error("Bu kayıt zaten mevcut.");
  if ("roomId" in r && !s.rooms.some((x) => x.id === r.roomId)) r.roomId = "";
  if (item.kind === "rooms") r.sensorId = "";
  if (item.kind === "devices" || item.kind === "lights") {
    if (
      [...s.devices, ...s.lights].some(
        (x) => x.entityId && x.entityId === r.entityId,
      )
    )
      r.entityId = "";
  }
  if (item.kind === "scenes")
    r.steps = r.steps.filter(
      (a) =>
        a.type === "notify" ||
        (a.type === "device"
          ? s.devices
          : a.type === "light"
            ? s.lights
            : a.type === "room"
              ? s.rooms
              : s.modes
        ).some((x) => x.id === a.targetId),
    );
  if (
    item.kind === "programs" &&
    !(r.action === "mode" ? s.modes : s.scenes).some((x) => x.id === r.targetId)
  ) {
    r.targetId = "";
    r.enabled = false;
  }
  s[item.kind].push(r);
  s.programs = s.programs.map((p) =>
    p.deployment ? { ...p, needsPublish: true } : p,
  );
  s.trash = s.trash.filter((x) => x.id !== trashId);
  return validateState(s);
}
export function duplicateRecord(state, kind, id) {
  const r = copy(state[kind].find((x) => x.id === id));
  r.id = uid();
  r.name = (r.name + " (kopya)").slice(0, 60);
  if ("entityId" in r) r.entityId = "";
  if (kind === "rooms") r.sensorId = "";
  if (kind === "scenes") r.steps = r.steps.map((a) => ({ ...a, id: uid() }));
  if (kind === "programs") {
    r.enabled = false;
    r.deployment = null;
  }
  return saveRecord(state, kind, r);
}
export function reorder(state, kind, id, delta) {
  const s = copy(state),
    i = s[kind].findIndex((x) => x.id === id),
    j = i + delta;
  if (i < 0 || j < 0 || j >= s[kind].length) return state;
  [s[kind][i], s[kind][j]] = [s[kind][j], s[kind][i]];
  return s;
}
function withRoomTargets(state, rooms, ids = rooms.map((r) => r.id)) {
  return {
    ...state,
    rooms,
    devices: state.devices.map((d) => {
      const room = rooms.find((r) => r.id === d.roomId);
      return d.enabled && isRoomThermostat(d) && room && ids.includes(room.id)
        ? { ...d, climateDemo: { ...d.climateDemo, temperature: room.target } }
        : d;
    }),
  };
}
export function applyRoomTarget(state, id, target, overrideUntil = null) {
  return withRoomTargets(
    state,
    state.rooms.map((r) => (r.id === id ? { ...r, target, overrideUntil } : r)),
    [id],
  );
}
export function applyMode(state, id) {
  const mode = state.modes.find((m) => m.id === id);
  if (!mode) throw new Error("Mod bulunamadı.");
  return withRoomTargets(
    { ...state, activeModeId: id },
    state.rooms.map((r) => ({
      ...r,
      target: Math.min(r.max, Math.max(r.min, mode.target)),
      overrideUntil: null,
    })),
  );
}
export function applyScene(state, scene, { simulateDevices = true } = {}) {
  let s = copy(state);
  for (const a of scene.steps) {
    if (a.type === "device" && simulateDevices)
      s.devices = s.devices.map((d) =>
        d.id === a.targetId ? applyDeviceAction(d, a) : d,
      );
    if (a.type === "notify")
      s.events = [
        {
          time: Date.now(),
          text: "Demo bildirimi: " + a.title + " · " + a.message,
        },
        ...s.events,
      ].slice(0, 60);
    if (a.type === "mode") s = applyMode(s, a.targetId);
    if (a.type === "room") s = applyRoomTarget(s, a.targetId, a.temperature);
    if (a.type === "light")
      s.lights = s.lights.map((l) =>
        l.id === a.targetId
          ? {
              ...l,
              on: a.on,
              brightness: a.brightness,
              color: a.color,
              kelvin: a.kelvin,
              colorMode: a.colorMode,
            }
          : l,
      );
  }
  return s;
}
export function expireOverrides(state, now = Date.now()) {
  const m = state.modes.find((m) => m.id === state.activeModeId);
  if (!state.rooms.some((r) => r.overrideUntil && r.overrideUntil <= now))
    return state;
  // No active mode (e.g. it was deleted): end the expired overrides and keep
  // each room's current target instead of leaving them overridden forever.
  if (!m)
    return {
      ...state,
      rooms: state.rooms.map((r) =>
        r.overrideUntil && r.overrideUntil <= now
          ? { ...r, overrideUntil: null }
          : r,
      ),
    };
  return withRoomTargets(
    state,
    state.rooms.map((r) =>
      r.overrideUntil && r.overrideUntil <= now
        ? {
            ...r,
            target: Math.min(r.max, Math.max(r.min, m.target)),
            overrideUntil: null,
          }
        : r,
    ),
    state.rooms
      .filter((r) => r.overrideUntil && r.overrideUntil <= now)
      .map((r) => r.id),
  );
}
export function liveCommands(
  state,
  steps,
  entities,
  services,
  temperatureUnit = "°C",
) {
  const plans = [];
  const thermostat = (r, t) => {
    if (!["°C", "°F"].includes(temperatureUnit))
      throw new Error(
        "Sunucunun sıcaklık birimi okunamadı. Entegrasyonlar ekranından bağlantı bilgilerini yenileyin.",
      );
    const devices = state.devices.filter(
      (d) =>
        d.roomId === r.id &&
        isRoomThermostat(d, entities[d.entityId]) &&
        d.enabled,
    );
    if (!devices.length) throw new Error(r.name + ": atanmış etkin vana yok.");
    for (const d of devices) {
      if (
        !d.entityId ||
        !entities[d.entityId] ||
        ["unavailable", "unknown"].includes(entities[d.entityId].state)
      )
        throw new Error(
          d.name + ": erişilebilir bir Home Assistant varlığı eşleştirin.",
        );
      // Same unit conversion, limits and step rounding as a direct device
      // command, so a room program and a device step send the same value.
      let target;
      try {
        target = climateTarget(t, entities[d.entityId], temperatureUnit);
      } catch (e) {
        throw new Error(d.name + ": " + e.message);
      }
      plans.push([
        "climate",
        "set_temperature",
        { temperature: target },
        { entity_id: d.entityId },
      ]);
    }
  };
  for (const a of steps) {
    if (a.type === "device") {
      const d = state.devices.find((x) => x.id === a.targetId);
      if (!d) throw new Error("Cihaz bulunamadı.");
      plans.push(
        deviceCommand(d, a, entities[d.entityId], services, temperatureUnit),
      );
    } else if (a.type === "notify") {
      const [domain, service] = a.service.split(".");
      if (services && !services[domain]?.[service])
        throw new Error("Bildirim kanalı bulunamadı.");
      plans.push([domain, service, { title: a.title, message: a.message }]);
    } else if (a.type === "mode") {
      const m = state.modes.find((x) => x.id === a.targetId);
      if (!m) throw new Error("Mod bulunamadı.");
      if (!state.rooms.length) throw new Error("Oda yok.");
      state.rooms
        .filter((r) =>
          state.devices.some(
            (d) =>
              d.enabled &&
              d.roomId === r.id &&
              isRoomThermostat(d, entities[d.entityId]),
          ),
        )
        .forEach((r) =>
          thermostat(r, Math.min(r.max, Math.max(r.min, m.target))),
        );
    } else if (a.type === "room") {
      const r = state.rooms.find((x) => x.id === a.targetId);
      if (!r) throw new Error("Oda bulunamadı.");
      thermostat(r, a.temperature);
    } else {
      const l = state.lights.find((l) => l.id === a.targetId);
      if (
        !l?.enabled ||
        !l.entityId ||
        !entities[l.entityId] ||
        ["unavailable", "unknown"].includes(entities[l.entityId].state)
      )
        throw new Error(
          (l?.name || "Lamba") +
            ": erişilebilir bir Home Assistant varlığı eşleştirin.",
        );
      const attrs = entities[l.entityId].attributes,
        modes = attrs.supported_color_modes || [],
        data = {};
      if (a.on) {
        if (modes.some((m) => m !== "onoff"))
          data.brightness_pct = a.brightness;
        if (a.colorMode === "color") {
          if (
            !modes.some((m) => ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(m))
          )
            throw new Error(l.name + ": renk desteklenmiyor.");
          data.rgb_color = hexToRgb(a.color);
        } else if (modes.includes("color_temp"))
          data.color_temp_kelvin = Math.min(
            attrs.max_color_temp_kelvin ?? 6500,
            Math.max(attrs.min_color_temp_kelvin ?? 2000, a.kelvin),
          );
      }
      plans.push([
        "light",
        a.on ? "turn_on" : "turn_off",
        data,
        { entity_id: l.entityId },
      ]);
    }
  }
  if (!plans.length) throw new Error("Çalıştırılacak adım yok.");
  return plans;
}
export function importEntities(
  state,
  candidates,
  { roomId = "", useAreas = true } = {},
) {
  const next = copy(state),
    bound = new Set([...next.devices, ...next.lights].map((d) => d.entityId));
  for (const c of candidates) {
    if (bound.has(c.id) || c.disabled) continue;
    let assigned = roomId;
    if (useAreas && c.area) {
      let room = next.rooms.find(
        (r) =>
          r.name.toLocaleLowerCase("tr") === c.area.toLocaleLowerCase("tr"),
      );
      if (!room) {
        room = { ...template("rooms", next), name: c.area.slice(0, 60) };
        next.rooms.push(room);
      }
      assigned = room.id;
    }
    const kind = c.domain === "light" ? "lights" : "devices",
      a = c.entity.attributes || {};
    const record = {
      ...template(kind, next),
      name: c.name.slice(0, 60),
      roomId: assigned,
      entityId: c.id,
      protocol: "Diğer",
    };
    if (kind === "devices")
      Object.assign(record, {
        type: c.domain,
        ...(c.domain === "climate"
          ? { climateRole: inferClimateRole(c.entity, c.platform) }
          : {}),
        sensorClass: a.device_class || "generic",
        unit: a.unit_of_measurement || "",
        demoState: "off",
        demoValue: "0",
      });
    next[kind].push(record);
    bound.add(c.id);
    if (
      c.domain === "sensor" &&
      record.sensorClass === "temperature" &&
      assigned
    ) {
      const room = next.rooms.find((r) => r.id === assigned);
      if (room && !room.sensorId) room.sensorId = record.id;
    }
  }
  next.programs = next.programs.map((p) =>
    p.deployment ? { ...p, needsPublish: true } : p,
  );
  return validateState(next);
}
