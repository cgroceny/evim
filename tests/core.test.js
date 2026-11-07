import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  validateImport,
  setMode,
  reconcileOverrides,
  safeHassUrl,
  sceneLights,
  temperature,
} from "../src/core.js";
test("A mode switch clears overrides and uses the configured target", () => {
  let s = freshState();
  s.settings.away = 16.5;
  s.rooms[0].overrideUntil = Date.now() + 10000;
  s = setMode(s, "Dışarıda");
  assert.ok(
    s.rooms.every((r) => r.target === 16.5 && r.overrideUntil === null),
  );
});
test("Only expired overrides return to the active target", () => {
  let s = freshState();
  s.rooms[0] = { ...s.rooms[0], target: 25, overrideUntil: 99 };
  s.rooms[1] = { ...s.rooms[1], target: 23, overrideUntil: 101 };
  s = reconcileOverrides(s, 100);
  assert.equal(s.rooms[0].target, 22);
  assert.equal(s.rooms[1].target, 23);
});
test("Import rejects invalid schedules, duplicated rooms and executable values", () => {
  for (const mutate of [
    (s) => (s.schedule[0].start = "25:00"),
    (s) => (s.schedule[0].end = "06:00"),
    (s) => (s.rooms[1].id = s.rooms[0].id),
    (s) => (s.lights[0].color = "javascript:alert(1)"),
    (s) => (s.settings.comfort = 100),
  ]) {
    let s = freshState();
    mutate(s);
    assert.throws(() => validateImport(s));
  }
  assert.equal(validateImport(freshState()).rooms.length, 4);
});
test("Secure deployment only connects to an HTTPS origin without credentials", () => {
  for (const u of [
    "http://192.168.1.17",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/home",
    "https://example.com/?token=x",
  ])
    assert.throws(() => safeHassUrl(u));
  assert.equal(
    safeHassUrl("https://ha.example.com/"),
    "https://ha.example.com",
  );
});
test("Scenes target the expected lights and temperature is bounded", () => {
  let s = sceneLights(freshState().lights, "Gece ışığı");
  assert.equal(s[0].on, false);
  assert.equal(s[1].brightness, 5);
  assert.ok(sceneLights(s, "Kapat").every((l) => !l.on));
  assert.equal(temperature(100), 28);
  assert.equal(temperature(22.3), 22.5);
});

test("Old v1 files keep renamed rooms, lights, light-room links and room details", async () => {
  const { migrate } = await import("../src/model.js");
  const old = freshState();
  old.rooms[0] = { ...old.rooms[0], name: "Oturma odası", icon: "tv", valves: 0, battery: 10 };
  old.lights[0] = { ...old.lights[0], name: "Tavan", room: "Oturma odası" };
  old.lights[1] = { ...old.lights[1], name: "Başucu" };
  const imported = validateImport(old);
  assert.equal(imported.rooms[0].name, "Oturma odası");
  assert.equal(imported.rooms[0].valves, 0);
  assert.equal(imported.rooms[0].battery, 10);
  assert.equal(imported.rooms[0].icon, "tv");
  assert.equal(imported.lights[0].name, "Tavan");
  const state = migrate(imported);
  const salon = state.rooms.find((r) => r.name === "Oturma odası");
  assert.equal(state.lights.find((l) => l.name === "Tavan").roomId, salon.id);
  const bed = state.rooms.find((r) => r.name === "Yatak odası");
  assert.equal(state.lights.find((l) => l.name === "Başucu").roomId, bed.id);
});
