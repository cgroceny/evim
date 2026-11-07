import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  validateState,
  template,
  saveRecord,
  importEntities,
  liveCommands,
  deleteRecord,
  restoreRecord,
} from "../src/model.js";
import {
  deviceCommand,
  entityCandidates,
  temperatureC,
  applyDeviceAction,
  deviceReading,
} from "../src/devices.js";
import { healthIssues } from "../src/health.js";
const ent = (id, state = "on", attributes = {}) => ({
  entity_id: id,
  state,
  attributes,
});
const dev = (type) => ({
  id: "test",
  name: "Test",
  type,
  entityId: type + ".test",
  enabled: true,
});

test("V2 settings migrate without losing user records and current schema round trips all new fields", () => {
  const old = initialState();
  old.version = 2;
  delete old.energy;
  delete old.id;
  delete old.home.timeZone;
  old.rooms[0].name = "Özel salon";
  old.devices.forEach((d) => {
    delete d.sensorClass;
    delete d.favorite;
  });
  const s = validateState(old);
  assert.equal(s.version, 4);
  assert.equal(s.rooms[0].name, "Özel salon");
  assert.equal(s.home.timeZone, "Europe/Istanbul");
  assert.equal(
    s.devices.find((d) => d.type === "sensor").sensorClass,
    "temperature",
  );
  assert.deepEqual(validateState(s), s);
  assert.throws(() =>
    validateState({ ...s, energy: { ...s.energy, meter: "switch.bad" } }),
  );
  assert.throws(() =>
    validateState({
      ...s,
      energy: { ...s.energy, meter: "sensor.a", submeters: ["sensor.a"] },
    }),
  );
});
test("Discovery imports supported entities and rooms once, preserves custom names, chooses temperature only", () => {
  const s = initialState(),
    entities = {
      "sensor.energy": ent("sensor.energy", "23", {
        device_class: "energy",
        unit_of_measurement: "kWh",
        friendly_name: "Priz tüketimi",
      }),
      "sensor.temp": ent("sensor.temp", "20", {
        device_class: "temperature",
        unit_of_measurement: "°C",
        friendly_name: "Oda sıcaklığı",
      }),
      "switch.plug": ent("switch.plug"),
      "lock.private": ent("lock.private"),
    };
  const metadata = {
    entities: Object.keys(entities).map((entity_id) => ({
      entity_id,
      device_id: "box",
    })),
    devices: [{ id: "box", area_id: "guest" }],
    areas: [{ area_id: "guest", name: "Yeni oda" }],
  };
  const list = entityCandidates(entities, s, metadata);
  assert.equal(list.length, 3);
  const next = importEntities(s, list),
    room = next.rooms.find((r) => r.name === "Yeni oda");
  assert.equal(
    next.devices.find((d) => d.id === room.sensorId).entityId,
    "sensor.temp",
  );
  assert.equal(
    next.devices.find((d) => d.entityId === "sensor.energy").sensorClass,
    "energy",
  );
  assert.deepEqual(importEntities(next, list), next);
});
test("Device commands enforce capabilities, types, availability, numeric steps, options and services", () => {
  assert.deepEqual(
    deviceCommand(dev("switch"), { operation: "on" }, ent("switch.test"), {
      switch: { turn_on: {} },
    }),
    ["switch", "turn_on", {}, { entity_id: "switch.test" }],
  );
  assert.throws(() =>
    deviceCommand(
      dev("switch"),
      { operation: "on" },
      ent("switch.test", "unavailable"),
    ),
  );
  assert.throws(() =>
    deviceCommand(dev("switch"), { operation: "on" }, ent("switch.wrong")),
  );
  assert.throws(() =>
    deviceCommand(
      dev("fan"),
      { operation: "percentage", value: 50 },
      ent("fan.test", "on", { supported_features: 0 }),
    ),
  );
  assert.equal(
    deviceCommand(
      dev("fan"),
      { operation: "percentage", value: 50 },
      ent("fan.test", "on", { supported_features: 1 }),
    )[2].percentage,
    50,
  );
  assert.equal(
    deviceCommand(
      dev("media_player"),
      { operation: "volume", value: 25 },
      ent("media_player.test", "on", { supported_features: 4 }),
    )[2].volume_level,
    0.25,
  );
  assert.throws(() =>
    deviceCommand(
      dev("number"),
      { operation: "value", value: 1.3 },
      ent("number.test", "0", { min: 0, max: 10, step: 0.5 }),
    ),
  );
  assert.throws(() =>
    deviceCommand(
      dev("select"),
      { operation: "option", value: "Missing" },
      ent("select.test", "A", { options: ["A"] }),
    ),
  );
  assert.throws(() =>
    deviceCommand(dev("switch"), { operation: "on" }, ent("switch.test"), {}),
  );
});
test("Demo generic controls show zero and chosen values; temperature units are explicit", () => {
  const d = applyDeviceAction(dev("number"), { operation: "value", value: 0 });
  assert.equal(deviceReading(d, {}, false).state, "0");
  assert.equal(deviceReading(d, {}, false).attributes.current_position, 0);
  assert.equal(
    temperatureC(ent("sensor.temp", "68", { unit_of_measurement: "°F" })),
    20,
  );
  assert.equal(
    temperatureC(ent("sensor.temp", "293.15", { unit_of_measurement: "K" })),
    20,
  );
  assert.equal(
    temperatureC(ent("sensor.temp", "", { device_class: "temperature" })),
    null,
  );
  assert.equal(
    temperatureC(ent("sensor.energy", "20", { unit_of_measurement: "kWh" })),
    null,
  );
});
test("Published programs become pending when their dependencies change, including delete and restore", () => {
  const s = initialState(),
    p = s.programs[0];
  p.deployment = {
    id: "evim_" + "a".repeat(32),
    fingerprint: "a".repeat(64),
    server: "https://ha.example.com",
    syncedAt: 1,
  };
  const renamed = saveRecord(s, "modes", { ...s.modes[0], name: "Özel ad" });
  assert.equal(renamed.programs[0].needsPublish, false);
  const changed = saveRecord(s, "modes", { ...s.modes[0], target: 23 });
  assert.equal(changed.programs[0].needsPublish, true);
  const deleted = deleteRecord(s, "devices", s.devices[0].id);
  assert.equal(deleted.programs[0].needsPublish, true);
  const restored = restoreRecord(deleted, deleted.trash[0].id);
  assert.equal(restored.programs[0].needsPublish, true);
});
test("Scene preflight rejects bad notification channels and sends supported notifications with device actions", () => {
  let s = initialState();
  const d = { ...template("devices", s), ...dev("switch") };
  s = saveRecord(s, "devices", d);
  const steps = [
    { id: "a", type: "device", targetId: d.id, operation: "off" },
    {
      id: "b",
      type: "notify",
      service: "notify.mobile_app_phone",
      message: "Enerji hedefi aşıldı",
      title: "evim",
    },
  ];
  s = saveRecord(s, "scenes", {
    ...template("scenes", s),
    name: "Enerji uyarısı",
    steps,
  });
  const services = {
    switch: { turn_off: {} },
    notify: { mobile_app_phone: {} },
  };
  assert.equal(
    liveCommands(s, steps, { "switch.test": ent("switch.test") }, services)
      .length,
    2,
  );
  assert.throws(() =>
    liveCommands(
      s,
      steps,
      { "switch.test": ent("switch.test") },
      { switch: { turn_off: {} } },
    ),
  );
  assert.throws(() =>
    saveRecord(s, "scenes", {
      ...s.scenes.at(-1),
      steps: [{ ...steps[1], service: "homeassistant.restart" }],
    }),
  );
});
test("Unknown battery values do not create false low-battery warnings", () => {
  let s = initialState();
  s.devices = [{ ...s.devices[0], entityId: "climate.test" }];
  s.rooms = s.rooms.map((r) => ({ ...r, sensorId: "" }));
  const issues = healthIssues(
    s,
    { "climate.test": ent("climate.test", "heat", { battery: null }) },
    true,
  );
  assert.ok(!issues.some((i) => i.message.includes("Pil seviyesi")));
});
