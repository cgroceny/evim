import test from "node:test";
import assert from "node:assert/strict";
import { freshState } from "../src/core.js";
import {
  initialState,
  validateState,
  template,
  saveRecord,
  deleteRecord,
  restoreRecord,
  duplicateRecord,
  reorder,
  applyMode,
  applyScene,
  liveCommands,
} from "../src/model.js";
test("Legacy migration preserves names, settings, light state and manual targets", () => {
  const old = freshState();
  old.homeName = "Benim evim";
  old.rooms[0].name = "Yaşam alanı";
  old.rooms[0].target = 24;
  old.settings.away = 16.5;
  old.lights[1].brightness = 11;
  const s = validateState(old);
  assert.equal(s.home.name, "Benim evim");
  assert.equal(s.rooms[0].target, 24);
  assert.equal(s.modes.find((m) => m.id === "away").target, 16.5);
  assert.equal(s.lights[1].brightness, 11);
  assert.equal(
    s.devices.filter((d) => d.type === "climate" && d.climateRole === "radiator").length,
    5,
  );
  const ac = s.devices.find((d) => d.climateRole === "independent");
  assert.equal(ac.roomId, "yatak");
  assert.deepEqual(ac.climateDemo.features, { light: true, xfan: true });
  assert.deepEqual(validateState(s), s);
});
test("Arbitrary records round trip and edits, duplicates, order and deletion persist", () => {
  let s = initialState();
  const r = { ...template("rooms", s), name: "Balkon" };
  s = saveRecord(s, "rooms", r);
  s = saveRecord(s, "rooms", { ...r, name: "Misafir odası", target: 20 });
  s = duplicateRecord(s, "rooms", r.id);
  assert.equal(s.rooms.length, 6);
  s = reorder(s, "rooms", r.id, -1);
  assert.equal(s.rooms[3].name, "Misafir odası");
  s = validateState(JSON.parse(JSON.stringify(s)));
  s = deleteRecord(s, "rooms", r.id);
  assert.equal(s.rooms.length, 5);
  s = restoreRecord(s, s.trash[0].id);
  assert.equal(s.rooms.length, 6);
  assert.equal(s.trash.length, 0);
});
test("Deleting parent detaches dependents without deleting devices and removes stale actions", () => {
  let s = initialState();
  s.scenes[0].steps.push({
    id: "room-step",
    type: "room",
    targetId: "salon",
    temperature: 23,
  });
  const before = s.devices.length;
  s = deleteRecord(s, "rooms", "salon");
  assert.equal(s.devices.length, before);
  assert.equal(s.devices.find((d) => d.id === "valve-salon-0").roomId, "");
  assert.ok(!s.scenes[0].steps.some((a) => a.targetId === "salon"));
  s = deleteRecord(s, "modes", "home");
  assert.equal(s.activeModeId, "");
  assert.ok(
    s.programs
      .filter((p) => p.action === "mode" && !p.targetId)
      .every((p) => !p.enabled),
  );
  assert.doesNotThrow(() => validateState(s));
});
test("All configurable collections can become empty and imported backups preserve it", () => {
  let s = initialState();
  for (const k of ["rooms", "devices", "lights", "modes", "scenes", "programs"])
    for (const r of [...s[k]]) s = deleteRecord(s, k, r.id);
  const restored = validateState(JSON.parse(JSON.stringify(s)));
  for (const k of ["rooms", "devices", "lights", "modes", "scenes", "programs"])
    assert.equal(restored[k].length, 0);
});
test("Moving and changing a sensor clears invalid room measurement references", () => {
  let s = initialState();
  const sensor = s.devices.find((d) => d.id === "sensor-salon");
  s = saveRecord(s, "devices", { ...sensor, roomId: "yatak" });
  assert.equal(s.rooms[0].sensorId, "");
  assert.throws(() =>
    saveRecord(s, "rooms", { ...s.rooms[0], sensorId: sensor.id }),
  );
});
test("Invalid references, duplicate bindings, bounds and programs are rejected", () => {
  for (const mutate of [
    (s) => (s.devices[0].roomId = "missing"),
    (s) => (s.rooms[0].min = 30),
    (s) => (s.programs[0].days = []),
    (s) => (s.scenes[0].steps[0].targetId = "missing"),
    (s) => {
      s.lights[0].entityId = "light.a";
      s.lights[1].entityId = "light.a";
    },
  ]) {
    const s = initialState();
    mutate(s);
    assert.throws(() => validateState(s));
  }
});
test("Custom scenes use explicit IDs, remain correct when reordered, and respect room bounds", () => {
  let s = initialState();
  s.rooms[0].max = 21;
  s.rooms[0].target = 21;
  s = applyMode(s, "home");
  assert.equal(s.rooms[0].target, 21);
  const scene = {
    steps: [
      {
        type: "light",
        targetId: s.lights[1].id,
        on: true,
        brightness: 32,
        color: "#123456",
        kelvin: 3000,
        colorMode: "color",
      },
    ],
  };
  s = reorder(s, "lights", s.lights[1].id, -1);
  s = applyScene(s, scene);
  assert.equal(s.lights.find((l) => l.id === "abajur").brightness, 32);
});
test("Live preflight rejects unmapped targets before returning any commands", () => {
  let s = initialState();
  const step = { type: "room", targetId: "salon", temperature: 23 };
  assert.throws(() => liveCommands(s, [step], {}));
  for (const d of s.devices.filter(
    (d) => d.type === "climate" && d.roomId === "salon",
  ))
    d.entityId = "climate." + d.id.replaceAll("-", "_");
  const entities = Object.fromEntries(
    s.devices
      .filter((d) => d.entityId)
      .map((d) => [
        d.entityId,
        { state: "heat", attributes: { min_temp: 5, max_temp: 30 } },
      ]),
  );
  const plans = liveCommands(s, [step], entities);
  assert.equal(plans.length, 2);
  assert.ok(plans.every((p) => p[3].entity_id.startsWith("climate.")));
  entities[plans[1][3].entity_id].state = "unavailable";
  assert.throws(() => liveCommands(s, [step], entities));
});
