import test from "node:test";
import assert from "node:assert/strict";
import {
  companionEntities,
  companionCommand,
  greeDemoCompanions,
} from "../src/companions.js";
import { initialState, validateState } from "../src/model.js";

// Entity registry as returned by config/entity_registry/list.
const registry = [
  { entity_id: "climate.yatak_gree", device_id: "gree1", platform: "gree" },
  { entity_id: "switch.yatak_gree_panel_light", device_id: "gree1", platform: "gree", translation_key: "light" },
  { entity_id: "switch.yatak_gree_quiet", device_id: "gree1", platform: "gree", translation_key: "quiet" },
  { entity_id: "switch.yatak_gree_xfan", device_id: "gree1", platform: "gree", translation_key: "xfan" },
  { entity_id: "switch.yatak_gree_fresh_air", device_id: "gree1", platform: "gree", translation_key: "fresh_air" },
  { entity_id: "switch.yatak_gree_health_mode", device_id: "gree1", platform: "gree", translation_key: "health_mode", disabled_by: "integration" },
  { entity_id: "climate.salon_trv", device_id: "trv1", platform: "mqtt" },
  { entity_id: "switch.salon_trv_child_lock", device_id: "trv1", platform: "mqtt" },
  { entity_id: "number.salon_trv_valve_opening_degree", device_id: "trv1", platform: "mqtt" },
  { entity_id: "select.salon_trv_temperature_sensor_select", device_id: "trv1", platform: "mqtt" },
  { entity_id: "sensor.salon_trv_battery", device_id: "trv1", platform: "mqtt", entity_category: "diagnostic" },
  { entity_id: "switch.kettle", device_id: "other", platform: "mqtt" },
];
const on = (state, attributes = {}) => ({ state, attributes });
const entities = {
  "climate.yatak_gree": on("cool"),
  "switch.yatak_gree_panel_light": on("on"),
  "switch.yatak_gree_quiet": on("off"),
  "switch.yatak_gree_xfan": on("on"),
  "switch.yatak_gree_fresh_air": on("unavailable"),
  "switch.yatak_gree_health_mode": on("off"),
  "climate.salon_trv": on("heat"),
  "switch.salon_trv_child_lock": on("off"),
  "number.salon_trv_valve_opening_degree": on("100", { min: 0, max: 100, step: 1, unit_of_measurement: "%" }),
  "select.salon_trv_temperature_sensor_select": on("local_temperature", { options: ["local_temperature", "remote_temperature", "remote_source_offline"] }),
  "sensor.salon_trv_battery": on("87", { unit_of_measurement: "%" }),
  "switch.kettle": on("off"),
};
const services = {
  switch: { turn_on: {}, turn_off: {} },
  select: { select_option: {} },
  number: { set_value: {} },
};

test("Gree switches of the same device are found with Turkish labels; disabled ones are skipped", () => {
  const list = companionEntities("climate.yatak_gree", registry, entities);
  assert.deepEqual(
    list.map((c) => c.label),
    ["Panel ışığı", "Sessiz mod", "Taze hava", "X-Fan (iç ünite kurutma)"],
  );
  assert.ok(list.every((c) => c.domain === "switch"));
  assert.ok(!list.some((c) => c.entityId === "switch.kettle"));
});

test("TRVZB extras are grouped with diagnostic battery last", () => {
  const list = companionEntities("climate.salon_trv", registry, entities);
  assert.deepEqual(
    list.map((c) => [c.domain, c.label]),
    [
      ["switch", "Çocuk kilidi"],
      ["select", "Sıcaklık kaynağı"],
      ["number", "Vana açılma oranı"],
      ["sensor", "Pil"],
    ],
  );
  assert.equal(list.at(-1).diagnostic, true);
});

test("Companion commands only target entities of the same device and validate values", () => {
  assert.deepEqual(
    companionCommand("climate.yatak_gree", "switch.yatak_gree_quiet", { operation: "on" }, registry, entities, services),
    ["switch", "turn_on", {}, { entity_id: "switch.yatak_gree_quiet" }],
  );
  assert.throws(
    () => companionCommand("climate.yatak_gree", "switch.kettle", { operation: "on" }, registry, entities, services),
    /ait değil/,
  );
  assert.throws(
    () => companionCommand("climate.yatak_gree", "switch.yatak_gree_fresh_air", { operation: "on" }, registry, entities, services),
    /erişilemiyor/,
  );
  assert.deepEqual(
    companionCommand("climate.salon_trv", "number.salon_trv_valve_opening_degree", { operation: "value", value: 60 }, registry, entities, services),
    ["number", "set_value", { value: 60 }, { entity_id: "number.salon_trv_valve_opening_degree" }],
  );
  assert.throws(
    () => companionCommand("climate.salon_trv", "number.salon_trv_valve_opening_degree", { operation: "value", value: 140 }, registry, entities, services),
    /0–100/,
  );
  assert.deepEqual(
    companionCommand("climate.salon_trv", "select.salon_trv_temperature_sensor_select", { operation: "option", value: "remote_temperature" }, registry, entities, services),
    ["select", "select_option", { option: "remote_temperature" }, { entity_id: "select.salon_trv_temperature_sensor_select" }],
  );
  assert.throws(
    () => companionCommand("climate.salon_trv", "sensor.salon_trv_battery", { operation: "on" }, registry, entities, services),
    /okunabilir/,
  );
  assert.throws(
    () => companionCommand("climate.salon_trv", "switch.salon_trv_child_lock", { operation: "on" }, registry, entities, { switch: {} }),
    /işlemi bulunamadı/,
  );
});

test("Without registry data nothing is shown", () => {
  assert.deepEqual(companionEntities("climate.yatak_gree", undefined, entities), []);
  assert.deepEqual(companionEntities("climate.unknown", registry, entities), []);
});

test("Demo Gree features persist and reject unknown keys or non-boolean values", () => {
  const s = initialState();
  const ac = s.devices.find((d) => d.climateRole === "independent");
  assert.equal(greeDemoCompanions(ac.climateDemo.features).find((c) => c.key === "quiet").entity.state, "off");
  ac.climateDemo.features = { quiet: true, unknown: true };
  const v = validateState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(v.devices.find((d) => d.id === ac.id).climateDemo.features, { quiet: true });
  ac.climateDemo.features = { quiet: "yes" };
  assert.throws(() => validateState(s), /Açık\/kapalı/);
});
