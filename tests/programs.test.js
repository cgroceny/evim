import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  template,
  saveRecord,
  liveCommands,
} from "../src/model.js";
import {
  compileProgram,
  deploymentPlan,
  publishAutomation,
} from "../src/programs.js";
function setup() {
  let state = initialState();
  const device = {
    ...template("devices", state),
    name: "Priz",
    type: "switch",
    entityId: "switch.plug",
  };
  state = saveRecord(state, "devices", device);
  const scene = {
    ...template("scenes", state),
    name: "Tasarruf",
    steps: [
      { id: "off", type: "device", targetId: device.id, operation: "off" },
    ],
  };
  state = saveRecord(state, "scenes", scene);
  const p = {
    ...template("programs", state),
    name: "Güç sınırı",
    action: "scene",
    targetId: scene.id,
    enabled: true,
    days: [0, 2, 4],
    trigger: {
      type: "numeric",
      entityId: "sensor.power",
      comparison: "above",
      value: 2000,
      seconds: 30,
    },
    conditions: [{ entityId: "binary_sensor.home", state: "off" }],
  };
  state = saveRecord(state, "programs", p);
  const entities = Object.fromEntries(
    ["switch.plug", "sensor.power", "binary_sensor.home"].map((id) => [
      id,
      { entity_id: id, state: "on", attributes: {} },
    ]),
  );
  const metadata = {
    config: { time_zone: "Europe/Istanbul" },
    services: { switch: { turn_off: {} } },
  };
  return { state, program: state.programs.at(-1), entities, metadata };
}
test("Compiler preserves trigger, hold time, weekdays, conditions and explicit device action", () => {
  const f = setup(),
    c = compileProgram(f.state, f.program, f.entities, f.metadata);
  assert.deepEqual(c.triggers, [
    {
      trigger: "numeric_state",
      entity_id: "sensor.power",
      above: 2000,
      for: { seconds: 30 },
    },
  ]);
  assert.deepEqual(c.conditions[0].weekday, ["mon", "wed", "fri"]);
  assert.throws(
    () => compileProgram(f.state, f.program, f.entities, {}),
    /saat dilimi/,
  );
  assert.equal(c.conditions[1].state, "off");
  assert.deepEqual(c.actions, [
    { action: "switch.turn_off", target: { entity_id: "switch.plug" } },
  ]);
  assert.throws(
    () =>
      compileProgram(f.state, f.program, f.entities, {
        config: { time_zone: "UTC" },
      }),
    /saat dilimi/,
  );
});
test("Compiler rejects missing targets, compiles sunset offset and keeps IDs stable per home/program", async () => {
  const f = setup();
  assert.throws(() => compileProgram(f.state, f.program, {}, f.metadata));
  f.state = saveRecord(f.state, "programs", {
    ...f.program,
    trigger: { type: "sun", event: "sunset", offset: -15 },
  });
  f.program = f.state.programs.at(-1);
  const a = await deploymentPlan(f.state, f.program, f.entities, f.metadata),
    b = await deploymentPlan(
      f.state,
      { ...f.program, name: "Stale caller" },
      f.entities,
      f.metadata,
    );
  assert.equal(a.id, b.id);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(a.config.triggers, [
    { trigger: "sun", event: "sunset", offset: -900 },
  ]);
});
function adapter(initial, id) {
  let config = initial,
    enabled = false;
  const calls = [];
  return {
    calls,
    read: async () => structuredClone(config),
    write: async (key, value) => {
      calls.push("write");
      config = structuredClone(value);
    },
    backup: async () => {
      calls.push("backup");
    },
    states: async () => [
      {
        entity_id: "automation.test",
        state: enabled ? "on" : "off",
        attributes: { id },
      },
    ],
    activate: async (key, value) => {
      calls.push(value ? "enable" : "disable");
      enabled = value;
    },
  };
}
test("Publishing verifies saved configuration and activation; pausing persists across restarts", async () => {
  const f = setup(),
    plan = await deploymentPlan(f.state, f.program, f.entities, f.metadata),
    io = adapter(null, plan.id);
  const opts = { ...f, plan, prior: null, server: "https://ha.example.com" };
  const result = await publishAutomation(opts, io);
  assert.equal(result.result.enabled, true);
  assert.equal(result.result.needsPublish, false);
  assert.deepEqual(io.calls, ["write", "enable"]);
  const paused = await publishAutomation(
    { ...opts, prior: result.saved, pauseOnly: true },
    io,
  );
  assert.equal(paused.saved.initial_state, false);
  assert.equal(paused.result.enabled, false);
  assert.deepEqual(io.calls.slice(2), ["backup", "write", "disable"]);
});
test("Publishing will not overwrite foreign or changed records and reports partial failures honestly", async () => {
  const f = setup(),
    plan = await deploymentPlan(f.state, f.program, f.entities, f.metadata),
    opts = { ...f, plan, prior: null, server: "https://ha.example.com" };
  const foreign = adapter(
    { ...plan.config, description: "Other application" },
    plan.id,
  );
  await assert.rejects(
    () => publishAutomation(opts, foreign),
    (e) => !e.written,
  );
  assert.deepEqual(foreign.calls, []);
  const changed = adapter({ ...plan.config, alias: "Changed in HA" }, plan.id);
  await assert.rejects(
    () => publishAutomation({ ...opts, prior: plan.config }, changed),
    /değişmiş/,
  );
  assert.deepEqual(changed.calls, []);
  const failure = adapter(null, plan.id);
  failure.activate = async () => {
    throw new Error("Offline");
  };
  await assert.rejects(
    () => publishAutomation(opts, failure),
    (e) => e.written === true,
  );
});
test("A stale server pause does not mark unrelated local edits as already published", async () => {
  const f = setup(),
    plan = await deploymentPlan(f.state, f.program, f.entities, f.metadata),
    old = { ...plan.config, alias: "evim · Old name" },
    io = adapter(old, plan.id);
  const result = await publishAutomation(
    {
      ...f,
      plan,
      prior: old,
      pauseOnly: true,
      server: "https://ha.example.com",
    },
    io,
  );
  assert.equal(result.result.needsPublish, true);
});
test("Thermostat commands convert displayed Celsius to native Fahrenheit with device limits", () => {
  const s = initialState(),
    room = s.rooms[0],
    entities = {};
  s.devices
    .filter((d) => d.type === "climate")
    .forEach((d, i) => {
      d.entityId = "climate.test_" + i;
      entities[d.entityId] = {
        state: "heat",
        attributes: { min_temp: 41, max_temp: 95, target_temp_step: 1 },
      };
    });
  const commands = liveCommands(
    s,
    [{ type: "room", targetId: room.id, temperature: 22 }],
    entities,
    undefined,
    "°F",
  );
  assert.equal(commands[0][2].temperature, 72);
  assert.throws(
    () =>
      liveCommands(
        s,
        [{ type: "room", targetId: room.id, temperature: 22 }],
        entities,
        undefined,
        null,
      ),
    /birimi okunamadı/,
  );
});
