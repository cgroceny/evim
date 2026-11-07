// Home Assistant climate capabilities; option values always come from the entity.
export const CLIMATE_OPTIONS = {
  hvac_mode: "hvac_modes",
  fan_mode: "fan_modes",
  swing_mode: "swing_modes",
  swing_horizontal_mode: "swing_horizontal_modes",
  preset_mode: "preset_modes",
};
export const CLIMATE_FLAGS = {
  temperature: 1,
  fan_mode: 8,
  preset_mode: 16,
  swing_mode: 32,
  off: 128,
  on: 256,
  swing_horizontal_mode: 512,
};
const coolingModes = (e) =>
  (e?.attributes?.hvac_modes || []).some((mode) =>
    ["cool", "dry", "fan_only", "heat_cool"].includes(mode),
  );
export function inferClimateRole(entity, platform = "") {
  if (platform === "gree" || coolingModes(entity)) return "independent";
  return entity?.attributes?.hvac_modes?.includes("heat")
    ? "radiator"
    : "independent";
}
export const isRoomThermostat = (device, entity) =>
  device.type === "climate" &&
  device.climateRole !== "independent" &&
  !coolingModes(entity);

export const climateOptionLabel = (value) =>
  ({
    off: "Kapalı",
    heat: "Isıtma",
    cool: "Soğutma",
    auto: "Otomatik",
    heat_cool: "Isıtma / soğutma",
    dry: "Nem alma",
    fan_only: "Yalnız fan",
    low: "Düşük",
    medium_low: "Orta düşük",
    "medium low": "Orta düşük",
    medium: "Orta",
    medium_high: "Orta yüksek",
    "medium high": "Orta yüksek",
    high: "Yüksek",
    quiet: "Sessiz",
    none: "Normal",
    eco: "Ekonomi",
    away: "8°C koruma (Dışarıda)",
    boost: "Turbo",
    sleep: "Uyku",
    comfort: "Konfor",
    home: "Evde",
    on: "Açık",
    default: "Varsayılan",
    full_swing: "Tam salınım",
    vertical: "Dikey",
    horizontal: "Yatay",
    both: "İki yön",
    fixed_upper: "Sabit · üst",
    fixed_upper_middle: "Sabit · üst orta",
    fixed_middle: "Sabit · orta",
    fixed_lower_middle: "Sabit · alt orta",
    fixed_lower: "Sabit · alt",
    swing_upper: "Salınım · üst",
    swing_upper_middle: "Salınım · üst orta",
    swing_middle: "Salınım · orta",
    swing_lower_middle: "Salınım · alt orta",
    swing_lower: "Salınım · alt",
    left: "Sol",
    left_center: "Sol orta",
    center: "Orta",
    right_center: "Sağ orta",
    right: "Sağ",
  })[value] || value;

export const toCelsius = (value, unit) =>
  unit === "°F" ? ((value - 32) * 5) / 9 : value;
export function climateTemperature(entity, fallbackUnit) {
  const a = entity?.attributes || {},
    unit = a.temperature_unit || fallbackUnit;
  const valid =
    ["°C", "°F"].includes(unit) &&
    Number.isFinite(a.min_temp) &&
    Number.isFinite(a.max_temp) &&
    a.min_temp < a.max_temp &&
    Number.isFinite(a.target_temp_step ?? 0.5) &&
    (a.target_temp_step ?? 0.5) > 0;
  return {
    valid,
    unit,
    min: a.min_temp,
    max: a.max_temp,
    step: a.target_temp_step ?? 0.5,
    target: Number.isFinite(a.temperature) ? a.temperature : null,
    current: Number.isFinite(a.current_temperature)
      ? a.current_temperature
      : null,
  };
}
export function climateTarget(celsius, entity, fallbackUnit) {
  const t = climateTemperature(entity, fallbackUnit);
  if (!t.valid)
    throw new Error(
      "Cihazın sıcaklık birimi veya sınırları okunamadı. Bağlantı bilgilerini yenileyin.",
    );
  const native = t.unit === "°F" ? (celsius * 9) / 5 + 32 : celsius;
  if (
    !Number.isFinite(native) ||
    native < t.min - 1e-6 ||
    native > t.max + 1e-6
  )
    throw new Error(`Sıcaklık ${t.min}–${t.max} ${t.unit} aralığında olmalı.`);
  const target = Number(
    (t.min + Math.round((native - t.min) / t.step) * t.step).toFixed(6),
  );
  if (target < t.min || target > t.max)
    throw new Error("Hedef cihazın sıcaklık adımlarına uymuyor.");
  return target;
}
export function demoClimateEntity(device) {
  const independent = device.climateRole === "independent",
    demo = device.climateDemo || {};
  return {
    entity_id: device.entityId || "climate.demo",
    state: device.demoState || "off",
    attributes: {
      supported_features: independent ? 953 : 385,
      hvac_modes: independent
        ? ["off", "heat", "cool", "auto", "dry", "fan_only"]
        : ["off", "heat"],
      min_temp: independent ? 16 : 5,
      max_temp: independent ? 30 : 35,
      target_temp_step: independent ? 1 : 0.5,
      temperature_unit: "°C",
      temperature: demo.temperature ?? 22,
      current_temperature: device.temperature,
      ...(independent
        ? {
            // Same option strings as Home Assistant's Gree integration.
            fan_modes: [
              "auto",
              "low",
              "medium low",
              "medium",
              "medium high",
              "high",
            ],
            fan_mode: demo.fan_mode || "auto",
            swing_modes: [
              "default",
              "full_swing",
              "fixed_upper",
              "fixed_upper_middle",
              "fixed_middle",
              "fixed_lower_middle",
              "fixed_lower",
              "swing_upper",
              "swing_middle",
              "swing_lower",
            ],
            swing_mode: demo.swing_mode || "default",
            swing_horizontal_modes: [
              "default",
              "full_swing",
              "left",
              "left_center",
              "center",
              "right_center",
              "right",
            ],
            swing_horizontal_mode: demo.swing_horizontal_mode || "default",
            preset_modes: ["none", "eco", "sleep", "boost", "away"],
            preset_mode: demo.preset_mode || "none",
          }
        : {}),
    },
  };
}
