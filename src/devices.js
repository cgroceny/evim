import { available } from "./core.js";
import {
  CLIMATE_FLAGS,
  CLIMATE_OPTIONS,
  climateTarget,
  demoClimateEntity,
} from "./climate.js";

export const DEVICE_TYPES = {
  climate: "Klima / vana / termostat",
  sensor: "Ölçüm sensörü",
  binary_sensor: "Durum sensörü",
  switch: "Priz / anahtar",
  fan: "Fan",
  cover: "Perde / panjur",
  media_player: "Medya oynatıcı",
  scene: "Home Assistant sahnesi",
  script: "Home Assistant betiği",
  button: "Cihaz düğmesi",
  input_boolean: "Sanal anahtar",
  number: "Sayısal ayar",
  input_number: "Sayısal yardımcı",
  select: "Seçenek",
  input_select: "Seçenek yardımcısı",
};
export const SENSOR_CLASSES = {
  temperature: "Sıcaklık",
  humidity: "Nem",
  energy: "Enerji (kWh)",
  power: "Anlık güç (W)",
  battery: "Pil",
  voltage: "Gerilim",
  current: "Akım",
  gas: "Gaz",
  water: "Su",
  generic: "Diğer ölçüm",
};
export const OPERATIONS = {
  climate: [
    ["on", "Aç"],
    ["off", "Kapat"],
    ["temperature", "Hedef sıcaklık (°C)"],
    ["hvac_mode", "Çalışma modu"],
    ["fan_mode", "Fan hızı"],
    ["swing_mode", "Dikey kanat"],
    ["swing_horizontal_mode", "Yatay kanat"],
    ["preset_mode", "Hazır ayar"],
  ],
  switch: [
    ["on", "Aç"],
    ["off", "Kapat"],
  ],
  input_boolean: [
    ["on", "Aç"],
    ["off", "Kapat"],
  ],
  fan: [
    ["on", "Aç"],
    ["off", "Kapat"],
    ["percentage", "Hız (%)"],
  ],
  cover: [
    ["open", "Aç"],
    ["close", "Kapat"],
    ["stop", "Durdur"],
    ["position", "Konum (%)"],
  ],
  media_player: [
    ["play", "Oynat"],
    ["pause", "Duraklat"],
    ["stop", "Durdur"],
    ["volume", "Ses (%)"],
  ],
  scene: [["run", "Çalıştır"]],
  script: [["run", "Çalıştır"]],
  button: [["press", "Bas"]],
  number: [["value", "Değer ayarla"]],
  input_number: [["value", "Değer ayarla"]],
  select: [["option", "Seçenek seç"]],
  input_select: [["option", "Seçenek seç"]],
};
export const optionOperation = (op) => op === "option" || !!CLIMATE_OPTIONS[op];
export const valueOperation = (op) =>
  ["percentage", "position", "volume", "value", "temperature"].includes(op) ||
  optionOperation(op);
export function validateDeviceAction(device, action) {
  if (
    !device ||
    !(OPERATIONS[device.type] || []).some(([op]) => op === action.operation)
  )
    throw new Error("Bu cihaz için geçerli bir işlem seçin.");
  if (
    ["percentage", "position", "volume"].includes(action.operation) &&
    (!Number.isFinite(action.value) || action.value < 0 || action.value > 100)
  )
    throw new Error("Değer 0–100 arasında olmalı.");
  if (
    action.operation === "value" &&
    (!Number.isFinite(action.value) || Math.abs(action.value) > 1e12)
  )
    throw new Error("Geçerli bir sayısal değer girin.");
  if (
    optionOperation(action.operation) &&
    (typeof action.value !== "string" ||
      !action.value.trim() ||
      action.value.length > 150)
  )
    throw new Error("Bir seçenek seçin.");
  if (
    action.operation === "temperature" &&
    (!Number.isFinite(action.value) || action.value < -20 || action.value > 60)
  )
    throw new Error("Geçerli bir hedef sıcaklık girin (°C).");
  return {
    operation: action.operation,
    ...(valueOperation(action.operation) ? { value: action.value } : {}),
  };
}
export function supportsOperation(type, op, entity) {
  if (!entity) return true;
  const a = entity.attributes || {},
    f = a.supported_features || 0;
  if (type === "climate") {
    if (CLIMATE_OPTIONS[op] && !a[CLIMATE_OPTIONS[op]]?.length) return false;
    return CLIMATE_FLAGS[op] ? !!(f & CLIMATE_FLAGS[op]) : op === "hvac_mode";
  }
  const flag = {
    cover: { open: 1, close: 2, position: 4, stop: 8 },
    fan: { percentage: 1 },
    media_player: { play: 16384, pause: 1, stop: 4096, volume: 4 },
  }[type]?.[op];
  return flag ? !!(f & flag) : true;
}
export function deviceCommand(
  device,
  action,
  entity,
  services,
  temperatureUnit,
) {
  const valid = validateDeviceAction(device, action);
  if (!device.enabled || !device.entityId || !available(entity))
    throw new Error(device.name + ": cihaz erişilemiyor veya eşleştirilmemiş.");
  if (
    !device.entityId.startsWith(device.type + ".") ||
    entity.entity_id !== device.entityId
  )
    throw new Error("Cihaz türü ve Home Assistant eşleştirmesi uyuşmuyor.");
  if (!supportsOperation(device.type, valid.operation, entity))
    throw new Error(
      device.name + ": bu işlem cihaz tarafından desteklenmiyor.",
    );
  const domain = device.type,
    a = entity.attributes || {};
  let service,
    data = {};
  switch (valid.operation) {
    case "temperature":
      service = "set_temperature";
      data.temperature = climateTarget(valid.value, entity, temperatureUnit);
      break;
    case "hvac_mode":
    case "fan_mode":
    case "swing_mode":
    case "swing_horizontal_mode":
    case "preset_mode":
      if (!a[CLIMATE_OPTIONS[valid.operation]]?.includes(valid.value))
        throw new Error(device.name + ": bu seçenek artık mevcut değil.");
      service = "set_" + valid.operation;
      data[valid.operation] = valid.value;
      break;
    case "on":
      service = "turn_on";
      break;
    case "off":
      service = "turn_off";
      break;
    case "open":
      service = "open_cover";
      break;
    case "close":
      service = "close_cover";
      break;
    case "stop":
      service = domain === "cover" ? "stop_cover" : "media_stop";
      break;
    case "play":
      service = "media_play";
      break;
    case "pause":
      service = "media_pause";
      break;
    case "run":
      service = "turn_on";
      break;
    case "press":
      service = "press";
      break;
    case "percentage":
      service = "set_percentage";
      data.percentage = valid.value;
      break;
    case "position":
      service = "set_cover_position";
      data.position = valid.value;
      break;
    case "volume":
      service = "volume_set";
      data.volume_level = valid.value / 100;
      break;
    case "value": {
      const min = Number(a.min),
        max = Number(a.max),
        step = Number(a.step || 1);
      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        !Number.isFinite(step) ||
        step <= 0 ||
        valid.value < min ||
        valid.value > max ||
        Math.abs(
          (valid.value - min) / step - Math.round((valid.value - min) / step),
        ) > 1e-6
      )
        throw new Error(
          device.name +
            `: ${min}–${max} aralığında ${step} adımla bir değer girin.`,
        );
      service = "set_value";
      data.value = valid.value;
      break;
    }
    case "option":
      if (!a.options?.includes(valid.value))
        throw new Error(device.name + ": bu seçenek artık mevcut değil.");
      service = "select_option";
      data.option = valid.value;
      break;
  }
  if (services && !services[domain]?.[service])
    throw new Error(
      device.name + ": gerekli Home Assistant işlemi bulunamadı.",
    );
  return [domain, service, data, { entity_id: device.entityId }];
}
export function applyDeviceAction(device, action) {
  const a = validateDeviceAction(device, action);
  if (device.type === "climate") {
    const demo = demoClimateEntity(device);
    if (!supportsOperation("climate", a.operation, demo))
      throw new Error("Bu örnek cihaz seçilen işlemi desteklemiyor.");
    if (
      CLIMATE_OPTIONS[a.operation] &&
      !demo.attributes[CLIMATE_OPTIONS[a.operation]]?.includes(a.value)
    )
      throw new Error("Örnek cihazın desteklediği bir seçenek seçin.");
    const climateDemo = { ...device.climateDemo };
    if (a.operation === "temperature")
      climateDemo.temperature = climateTarget(a.value, demo, "°C");
    else if (CLIMATE_OPTIONS[a.operation] && a.operation !== "hvac_mode")
      climateDemo[a.operation] = a.value;
    return {
      ...device,
      climateDemo,
      demoState:
        a.operation === "hvac_mode"
          ? a.value
          : a.operation === "on"
            ? "heat"
            : a.operation === "off"
              ? "off"
              : device.demoState,
    };
  }
  const demoState =
    {
      on: "on",
      off: "off",
      open: "open",
      close: "closed",
      play: "playing",
      pause: "paused",
      stop: "idle",
      run: "on",
      press: "pressed",
    }[a.operation] || device.demoState;
  return {
    ...device,
    demoState,
    ...(valueOperation(a.operation) ? { demoValue: String(a.value) } : {}),
  };
}
export function deviceReading(d, entities, live) {
  const e = entities[d.entityId];
  if (live)
    return {
      state: available(e) ? e.state : "unavailable",
      unit: e?.attributes?.unit_of_measurement || d.unit || "",
      available: d.enabled && available(e),
      attributes: e?.attributes || {},
      updated: e?.last_updated,
    };
  return {
    state:
      d.type === "sensor"
        ? d.sensorClass === "temperature"
          ? String(d.temperature)
          : d.demoValue
        : ["number", "input_number", "select", "input_select"].includes(d.type)
          ? d.demoValue
          : d.demoState,
    unit:
      d.type === "climate"
        ? ""
        : d.unit || (d.sensorClass === "temperature" ? "°C" : ""),
    available: d.enabled,
    attributes: {
      percentage: Number(d.demoValue) || 0,
      current_position: Number(d.demoValue) || 0,
      volume_level: (Number(d.demoValue) || 0) / 100,
      min: 0,
      max: 100,
      step: 1,
      options: ["Düşük", "Orta", "Yüksek"],
    },
  };
}
export const stateLabel = (s) =>
  ({
    on: "Açık",
    off: "Kapalı",
    open: "Açık",
    closed: "Kapalı",
    opening: "Açılıyor",
    closing: "Kapanıyor",
    playing: "Oynatılıyor",
    paused: "Duraklatıldı",
    idle: "Beklemede",
    unavailable: "Erişilemiyor",
    unknown: "Bilinmiyor",
    home: "Evde",
    not_home: "Dışarıda",
    pressed: "Basıldı",
  })[s] || s;
export function entityCandidates(entities, state, metadata = {}) {
  const bound = new Set(
    [...state.devices, ...state.lights].map((d) => d.entityId).filter(Boolean),
  );
  const registry = new Map(
    (metadata.entities || []).map((e) => [e.entity_id, e]),
  );
  const devices = new Map((metadata.devices || []).map((d) => [d.id, d]));
  const areas = new Map((metadata.areas || []).map((a) => [a.area_id, a.name]));
  return Object.values(entities)
    .filter(
      (e) =>
        DEVICE_TYPES[e.entity_id.split(".")[0]] ||
        e.entity_id.startsWith("light."),
    )
    .map((e) => {
      const reg = registry.get(e.entity_id),
        dev = devices.get(reg?.device_id),
        areaId = reg?.area_id || dev?.area_id || "";
      return {
        id: e.entity_id,
        name: e.attributes.friendly_name || e.entity_id,
        domain: e.entity_id.split(".")[0],
        areaId,
        area: areas.get(areaId) || "",
        platform: reg?.platform || "",
        manufacturer: dev?.manufacturer || "",
        model: dev?.model || "",
        bound: bound.has(e.entity_id),
        disabled: !!reg?.disabled_by,
        entity: e,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
export function temperatureC(entity) {
  if (!available(entity) || !String(entity.state ?? "").trim()) return null;
  const value = Number(entity.state),
    a = entity.attributes || {};
  if (!Number.isFinite(value)) return null;
  if (a.unit_of_measurement === "°F") return ((value - 32) * 5) / 9;
  if (a.unit_of_measurement === "K") return value - 273.15;
  return a.device_class === "temperature" || a.unit_of_measurement === "°C"
    ? value
    : null;
}
