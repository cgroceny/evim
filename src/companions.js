// Extra controls that Home Assistant registers on the same physical device as a
// climate entity: Gree's switches (panel light, quiet, X-Fan …) and the extra
// settings of Zigbee radiator valves such as SONOFF TRVZB (child lock, window
// detection, valve opening, external sensor …). Only entities that share the
// climate entity's device_id are ever shown or commanded.
import { available } from "./core.js";

export const COMPANION_DOMAINS = [
  "switch",
  "select",
  "number",
  "sensor",
  "binary_sensor",
];

// [match, label, hint]. Gree entities match by translation_key, TRVZB entities
// (Zigbee2MQTT / ZHA) by the end of their entity id.
const KNOWN = [
  // Gree (Home Assistant "gree" integration)
  ["gree:light", "Panel ışığı", "İç ünitedeki ekran ışığını açar veya kapatır."],
  ["gree:quiet", "Sessiz mod", "Fanı en sessiz kademede çalıştırır."],
  [
    "gree:xfan",
    "X-Fan (iç ünite kurutma)",
    "Soğutma veya nem almadan sonra fan bir süre daha döner; serpantin kurur, küf ve koku azalır.",
  ],
  [
    "gree:fresh_air",
    "Taze hava",
    "Yalnız taze hava modülü olan modellerde çalışır.",
  ],
  [
    "gree:health_mode",
    "Sağlık modu (iyonizer)",
    "Destekleyen modellerde iyonizeri açar. Home Assistant’ta varsayılan olarak kapalıdır; Varlıklar ekranından etkinleştirilebilir.",
  ],
  // Zigbee radiator valves (SONOFF TRVZB and similar)
  ["_child_lock", "Çocuk kilidi", "Vananın üzerindeki düğmeleri kilitler."],
  [
    "_open_window",
    "Açık pencere algılama",
    "Sıcaklık hızla düşerse vana bir süre kapanır.",
  ],
  ["_window_detection", "Açık pencere algılama", ""],
  [
    "_frost_protection_temperature",
    "Donma koruma sıcaklığı",
    "Vana kapalıyken bu sıcaklığın altına inilmez.",
  ],
  [
    "_valve_opening_degree",
    "Vana açılma oranı",
    "Isıtma isterken vananın en fazla ne kadar açılacağı (%).",
  ],
  [
    "_valve_closing_degree",
    "Vana kapanma oranı",
    "Isıtma gerekmediğinde vananın ne kadar kapanacağı (%).",
  ],
  [
    "_temperature_accuracy",
    "Sıcaklık hassasiyeti",
    "Vananın hedefin ne kadar altında yeniden açılacağı (°C).",
  ],
  [
    "_local_temperature_calibration",
    "Sıcaklık düzeltmesi",
    "Vananın ölçtüğü sıcaklığa eklenen düzeltme (°C).",
  ],
  [
    "_temperature_sensor_select",
    "Sıcaklık kaynağı",
    "Harici seçilirse vana, odadaki sensörün değerini kullanır.",
  ],
  [
    "_external_temperature_input",
    "Harici sensör değeri",
    "Odadaki sensörün ölçümü buraya yazılır; bunu bir Home Assistant otomasyonu düzenli yapmalı.",
  ],
  [
    "_smart_temperature_control",
    "Akıllı sıcaklık kontrolü",
    "Vana açıklığını kendi algoritmasıyla ayarlar. Açıkken açılma oranı ve hassasiyet kullanılmaz.",
  ],
  ["_temporary_mode_select", "Geçici mod", "Boost veya zamanlayıcı."],
  ["_temporary_mode_duration", "Geçici mod süresi", "Dakika."],
  ["_timer_mode_target_temp", "Zamanlayıcı hedefi", ""],
  ["_battery", "Pil", ""],
  ["_running_state", "Çalışma durumu", ""],
  ["_linkquality", "Sinyal kalitesi", ""],
];

const OPTION_LABELS = {
  local_temperature: "Vananın kendi sensörü",
  remote_temperature: "Harici sensör",
  remote_source_offline: "Harici sensör çevrimdışı",
  external: "Harici sensör",
  internal: "Vananın kendi sensörü",
  boost: "Boost",
  timer: "Zamanlayıcı",
  idle: "Beklemede",
  heat: "Isıtıyor",
};
export const companionOptionLabel = (v) => OPTION_LABELS[v] || v;

const ORDER = { switch: 0, select: 1, number: 2, binary_sensor: 3, sensor: 4 };

function describe(entry, entity) {
  const key =
    entry.platform === "gree" && entry.translation_key
      ? "gree:" + entry.translation_key
      : null;
  const known =
    (key && KNOWN.find(([m]) => m === key)) ||
    KNOWN.find(
      ([m]) => m.startsWith("_") && entry.entity_id.endsWith(m),
    );
  const friendly = entity?.attributes?.friendly_name || entry.entity_id;
  return {
    label: known?.[1] || entry.name || entry.original_name || friendly,
    hint: known?.[2] || "",
    known: !!known,
  };
}

// registry: Home Assistant entity registry list (config/entity_registry/list).
export function companionEntities(climateEntityId, registry, entities) {
  if (!climateEntityId || !Array.isArray(registry)) return [];
  const own = registry.find((r) => r.entity_id === climateEntityId);
  if (!own?.device_id) return [];
  return registry
    .filter(
      (r) =>
        r.device_id === own.device_id &&
        r.entity_id !== climateEntityId &&
        !r.disabled_by &&
        COMPANION_DOMAINS.includes(r.entity_id.split(".")[0]) &&
        entities?.[r.entity_id],
    )
    .map((r) => {
      const domain = r.entity_id.split(".")[0],
        entity = entities[r.entity_id];
      return {
        entityId: r.entity_id,
        domain,
        entity,
        diagnostic: r.entity_category === "diagnostic",
        ...describe(r, entity),
      };
    })
    .sort(
      (a, b) =>
        ORDER[a.domain] - ORDER[b.domain] ||
        Number(b.known) - Number(a.known) ||
        a.label.localeCompare(b.label, "tr"),
    );
}

// Builds a Home Assistant service call for one companion control. Throws when
// the target is not on the same device, unavailable, or the value is invalid.
export function companionCommand(
  climateEntityId,
  entityId,
  action,
  registry,
  entities,
  services,
) {
  const item = companionEntities(climateEntityId, registry, entities).find(
    (c) => c.entityId === entityId,
  );
  if (!item) throw new Error("Bu ayar bu cihaza ait değil.");
  if (!available(item.entity))
    throw new Error(item.label + ": şu anda erişilemiyor.");
  const a = item.entity.attributes || {};
  let service,
    data = {};
  if (item.domain === "switch") {
    if (!["on", "off"].includes(action?.operation))
      throw new Error("Geçersiz işlem.");
    service = action.operation === "on" ? "turn_on" : "turn_off";
  } else if (item.domain === "select") {
    if (action?.operation !== "option" || !a.options?.includes(action.value))
      throw new Error(item.label + ": bu seçenek artık mevcut değil.");
    service = "select_option";
    data.option = action.value;
  } else if (item.domain === "number") {
    const v = Number(action?.value),
      min = Number(a.min),
      max = Number(a.max),
      step = Number(a.step || 1);
    if (
      action?.operation !== "value" ||
      !Number.isFinite(v) ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      v < min ||
      v > max ||
      Math.abs((v - min) / step - Math.round((v - min) / step)) > 1e-6
    )
      throw new Error(
        `${item.label}: ${min}–${max} aralığında ${step} adımla bir değer girin.`,
      );
    service = "set_value";
    data.value = v;
  } else throw new Error(item.label + ": yalnızca okunabilir.");
  if (services && !services[item.domain]?.[service])
    throw new Error("Gerekli Home Assistant işlemi bulunamadı.");
  return [item.domain, service, data, { entity_id: entityId }];
}

// Preview of the Gree switches on the demo air conditioner (no server).
export const GREE_DEMO_FEATURES = [
  ["light", true],
  ["quiet", false],
  ["xfan", true],
  ["fresh_air", false],
  ["health_mode", false],
];
export function greeDemoCompanions(state = {}) {
  return GREE_DEMO_FEATURES.map(([key, fallback]) => {
    const [, label, hint] = KNOWN.find(([m]) => m === "gree:" + key);
    return {
      entityId: "switch.demo_" + key,
      key,
      domain: "switch",
      entity: { state: (state[key] ?? fallback) ? "on" : "off", attributes: {} },
      label,
      hint,
      known: true,
      diagnostic: false,
    };
  });
}
