export const MODES = {
  Evde: { target: 22, label: "Konfor zamanı" },
  Gece: { target: 19, label: "İyi geceler" },
  Dışarıda: { target: 17, label: "Ev beklemede" },
  Tatil: { target: 17, label: "Uzun bir mola" },
};
export const DAYS = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
export const STORAGE_KEY = "evim.demo.v1";
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const temperature = (n) =>
  Math.round(clamp(Number(n) || 10, 10, 28) * 2) / 2;
export const formatTemp = (n) =>
  Number.isFinite(Number(n)) && n !== null
    ? Number(n).toLocaleString("tr-TR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "—";
export function freshState() {
  return {
    version: 1,
    homeName: "Evim",
    mode: "Evde",
    heating: false,
    settings: { comfort: 22, night: 19, away: 17 },
    rooms: [
      {
        id: "salon",
        name: "Salon",
        icon: "sofa",
        current: 21.6,
        target: 22,
        humidity: 44,
        valves: 2,
        battery: 92,
        overrideUntil: null,
      },
      {
        id: "yatak",
        name: "Yatak odası",
        icon: "bed",
        current: 21.1,
        target: 22,
        humidity: 48,
        valves: 1,
        battery: 86,
        overrideUntil: null,
      },
      {
        id: "calisma",
        name: "Çalışma odası",
        icon: "desk",
        current: 22.3,
        target: 22,
        humidity: 41,
        valves: 1,
        battery: 95,
        overrideUntil: null,
      },
      {
        id: "mutfak",
        name: "Mutfak",
        icon: "coffee",
        current: 21.9,
        target: 22,
        humidity: 46,
        valves: 1,
        battery: 89,
        overrideUntil: null,
      },
    ],
    lights: [
      {
        id: "oda",
        name: "Oda lambası",
        room: "Salon",
        on: true,
        brightness: 75,
        color: "#f4ce8a",
        kelvin: 3000,
      },
      {
        id: "abajur",
        name: "Abajur",
        room: "Yatak odası",
        on: true,
        brightness: 35,
        color: "#f4ce8a",
        kelvin: 2700,
      },
    ],
    schedule: DAYS.map((day, i) => ({
      day,
      start: i < 5 ? "07:00" : "08:00",
      end: "23:00",
      enabled: true,
    })),
    events: [],
  };
}
export function targetFor(state) {
  return state.mode === "Evde"
    ? state.settings.comfort
    : state.mode === "Gece"
      ? state.settings.night
      : state.settings.away;
}
export function setMode(state, mode) {
  if (!Object.hasOwn(MODES, mode)) return state;
  const next = { ...state, mode };
  return {
    ...next,
    rooms: state.rooms.map((r) => ({
      ...r,
      target: targetFor(next),
      overrideUntil: null,
    })),
  };
}
export function reconcileOverrides(state, now = Date.now()) {
  return {
    ...state,
    rooms: state.rooms.map((r) =>
      r.overrideUntil && r.overrideUntil <= now
        ? { ...r, target: targetFor(state), overrideUntil: null }
        : r,
    ),
  };
}
export function validateImport(input) {
  if (
    !input ||
    input.version !== 1 ||
    !Object.hasOwn(MODES, input.mode) ||
    typeof input.heating !== "boolean" ||
    typeof input.homeName !== "string" ||
    !input.homeName.trim() ||
    input.homeName.length > 40
  )
    throw new Error("Bu dosya geçerli bir evim ayar dosyası değil.");
  for (const key of ["comfort", "night", "away"])
    if (
      !Number.isFinite(input.settings?.[key]) ||
      input.settings[key] < 10 ||
      input.settings[key] > 28
    )
      throw new Error("Sıcaklıklar 10–28°C arasında olmalı.");
  const base = freshState();
  if (
    !Array.isArray(input.rooms) ||
    input.rooms.length !== 4 ||
    new Set(input.rooms.map((r) => r.id)).size !== 4
  )
    throw new Error("Oda listesi eksik.");
  if (
    !Array.isArray(input.lights) ||
    input.lights.length !== 2 ||
    new Set(input.lights.map((l) => l.id)).size !== 2
  )
    throw new Error("Işık listesi eksik.");
  const rooms = base.rooms.map((def) => {
    const r = input.rooms.find((x) => x.id === def.id);
    if (
      !r ||
      typeof r.name !== "string" ||
      !r.name.trim() ||
      r.name.length > 40 ||
      !Number.isFinite(r.target)
    )
      throw new Error("Oda ayarları geçersiz.");
    // Keep every valid field from the user's file; fall back to the default
    // only for a missing or out-of-range value.
    const pick = (v, ok, fallback) => (ok(v) ? v : fallback);
    const between = (lo, hi) => (v) => Number.isFinite(v) && v >= lo && v <= hi;
    return {
      ...def,
      name: r.name,
      icon: pick(r.icon, (v) => typeof v === "string" && /^[a-z0-9-]{1,30}$/.test(v), def.icon),
      current: pick(r.current, between(-30, 60), def.current),
      humidity: pick(r.humidity, between(0, 100), def.humidity),
      valves: pick(r.valves, (v) => Number.isInteger(v) && v >= 0 && v <= 4, def.valves),
      battery: pick(r.battery, between(0, 100), def.battery),
      target: temperature(r.target),
      overrideUntil: Number.isFinite(r.overrideUntil) ? r.overrideUntil : null,
    };
  });
  const defaultRoomName = (name) =>
    rooms.find((r) => r.id === base.rooms.find((x) => x.name === name)?.id)
      ?.name ?? name;
  const lights = base.lights.map((def) => {
    const l = input.lights.find((x) => x.id === def.id);
    if (
      !l ||
      typeof l.on !== "boolean" ||
      !Number.isFinite(l.brightness) ||
      !/^#[0-9a-f]{6}$/i.test(l.color) ||
      !Number.isFinite(l.kelvin)
    )
      throw new Error("Işık ayarları geçersiz.");
    return {
      ...def,
      // Light names and rooms may have been renamed; the room link follows the
      // light's own room name when it exists, else its default room's new name.
      name:
        typeof l.name === "string" && l.name.trim() && l.name.length <= 40
          ? l.name
          : def.name,
      room: rooms.some((r) => r.name === l.room)
        ? l.room
        : defaultRoomName(def.room),
      on: l.on,
      brightness: clamp(l.brightness, 1, 100),
      color: l.color,
      kelvin: clamp(l.kelvin, 2500, 6500),
    };
  });
  if (!Array.isArray(input.schedule) || input.schedule.length !== 7)
    throw new Error("Haftalık program eksik.");
  const schedule = DAYS.map((day, i) => {
    const s = input.schedule[i];
    if (
      s.day !== day ||
      typeof s.enabled !== "boolean" ||
      !validTime(s.start) ||
      !validTime(s.end) ||
      s.start >= s.end
    )
      throw new Error(
        "Program saatlerini kontrol edin; başlangıç bitişten önce olmalı.",
      );
    return { day, start: s.start, end: s.end, enabled: s.enabled };
  });
  return {
    ...base,
    homeName: input.homeName.trim(),
    mode: input.mode,
    heating: input.heating,
    settings: { ...input.settings },
    rooms,
    lights,
    schedule,
    events: Array.isArray(input.events)
      ? input.events
          .filter((e) => typeof e.text === "string" && Number.isFinite(e.time))
          .slice(0, 30)
      : [],
  };
}
export const validTime = (t) =>
  typeof t === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
export function safeHassUrl(value, secure = true) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Geçerli bir Home Assistant adresi yazın.");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["https:", "http:"].includes(url.protocol)
  )
    throw new Error("Adres kullanıcı bilgisi veya ek parametre içermemeli.");
  if (secure && url.protocol !== "https:")
    throw new Error(
      "Vercel üzerinden bağlantı için HTTPS adresi gerekiyor. Yerel HTTP adresini doğrudan kullanamayız.",
    );
  if (url.pathname !== "/")
    throw new Error("Panel yolunu değil, sunucunun ana adresini yazın.");
  return url.origin;
}
export function sceneLights(lights, scene) {
  return lights.map((l, i) =>
    scene === "Kapat"
      ? { ...l, on: false }
      : scene === "Okuma"
        ? { ...l, on: true, brightness: 85, kelvin: 4000, color: "#fff0d4" }
        : scene === "Film"
          ? {
              ...l,
              on: i === 1,
              brightness: 20,
              color: "#8e7dff",
              kelvin: 2700,
            }
          : scene === "Gece ışığı"
            ? {
                ...l,
                on: i === 1,
                brightness: 5,
                color: "#f4ce8a",
                kelvin: 2700,
              }
            : l,
  );
}
export function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
export function rgbToHex(rgb) {
  return rgb?.length === 3
    ? "#" +
        rgb
          .map((n) =>
            clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0"),
          )
          .join("")
    : "#f4ce8a";
}
export function available(entity) {
  return !!entity && !["unavailable", "unknown"].includes(entity.state);
}
