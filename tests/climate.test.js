import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  template,
  validateState,
  saveRecord,
  importEntities,
  liveCommands,
  applyMode,
  applyRoomTarget,
  expireOverrides,
  applyScene,
} from "../src/model.js";
import {
  applyDeviceAction,
  deviceCommand,
  entityCandidates,
  supportsOperation,
} from "../src/devices.js";
import {
  climateTarget,
  demoClimateEntity,
  inferClimateRole,
  isRoomThermostat,
} from "../src/climate.js";
import { compileProgram } from "../src/programs.js";

function fixture() {
  let state = initialState();
  const device = {
    ...template("devices", state),
    name: "Yatak odası Gree",
    roomId: "yatak",
    entityId: "climate.gree",
  };
  state = saveRecord(state, "devices", device);
  const entity = demoClimateEntity(device);
  entity.attributes.fan_modes.push("medium_low");
  entity.attributes.preset_modes.push("away");
  const entities = { [device.entityId]: entity },
    services = {
      climate: Object.fromEntries(
        [
          "turn_on",
          "turn_off",
          "set_temperature",
          "set_hvac_mode",
          "set_fan_mode",
          "set_swing_mode",
          "set_swing_horizontal_mode",
          "set_preset_mode",
        ].map((s) => [s, {}]),
      ),
    };
  return { state, device: state.devices.at(-1), entity, entities, services };
}

test("V3 migration preserves five radiator roles and V4 round trips independent AC settings", () => {
  const old = initialState();
  old.version = 3;
  // V3 workspaces never contained the demo air conditioner.
  old.devices = old.devices.filter((d) => !d.id.startsWith("ac-"));
  for (const d of old.devices) {
    delete d.climateRole;
    delete d.climateDemo;
  }
  const migrated = validateState(old);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.devices.filter((d) => isRoomThermostat(d)).length, 5);
  const { state } = fixture();
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
  delete state.devices.at(-1).climateRole;
  assert.equal(validateState(state).devices.at(-1).climateRole, "independent");
  state.devices.at(-1).climateRole = "invalid";
  assert.throws(() => validateState(state), /kullanımı/);
});

test("Discovery identifies cooling devices and Gree platform as independent while keeping heat-only TRVs grouped", () => {
  const { entity } = fixture();
  assert.equal(inferClimateRole(entity), "independent");
  assert.equal(
    inferClimateRole({ attributes: { hvac_modes: ["heat", "off"] } }),
    "radiator",
  );
  assert.equal(inferClimateRole({ attributes: {} }, "gree"), "independent");
  assert.equal(inferClimateRole({ attributes: {} }), "independent");
  const state = initialState(),
    metadata = {
      entities: [
        { entity_id: "climate.gree", platform: "gree", area_id: "bedroom" },
      ],
      areas: [{ area_id: "bedroom", name: "Yatak odası" }],
    };
  const candidates = entityCandidates(
    { "climate.gree": entity },
    state,
    metadata,
  );
  const next = importEntities(state, candidates);
  assert.equal(next.devices.at(-1).climateRole, "independent");
  assert.equal(next.devices.at(-1).roomId, "yatak");
  assert.deepEqual(importEntities(next, candidates), next);
});

test("Whole-house and room heating never target AC, including incorrectly classified legacy records", () => {
  const f = fixture();
  f.device.climateRole = "radiator";
  for (const d of f.state.devices.filter((d) =>
    isRoomThermostat(d, f.entities[d.entityId]),
  )) {
    d.entityId = "climate." + d.id.replaceAll("-", "_");
    f.entities[d.entityId] = { ...demoClimateEntity(d), state: "heat" };
  }
  const plans = liveCommands(
    f.state,
    [{ type: "mode", targetId: "night" }],
    f.entities,
    f.services,
    "°C",
  );
  assert.equal(plans.length, 5);
  assert.ok(
    plans.every(
      (p) => p[3].entity_id !== "climate.gree" && p[2].temperature === 19,
    ),
  );
  const room = liveCommands(
    f.state,
    [{ type: "room", targetId: "yatak", temperature: 23 }],
    f.entities,
    f.services,
    "°C",
  );
  assert.equal(room.length, 1);
  assert.notEqual(room[0][3].entity_id, "climate.gree");
  f.state.devices = [f.device];
  assert.throws(
    () =>
      liveCommands(f.state, [{ type: "mode", targetId: "home" }], f.entities),
    /adım yok/,
  );
  assert.throws(
    () =>
      liveCommands(
        f.state,
        [{ type: "room", targetId: "yatak", temperature: 23 }],
        f.entities,
      ),
    /vana yok/,
  );
});

test("An AC-only room and an unbound independent AC do not block radiator presets", () => {
  const f = fixture();
  f.state.devices = f.state.devices.filter(
    (d) => d.type !== "climate" || d.id === f.device.id,
  );
  f.device.entityId = "";
  const valve = {
    ...template("devices", f.state),
    name: "Tek vana",
    climateRole: "radiator",
    roomId: "salon",
    entityId: "climate.valve",
  };
  f.state = saveRecord(f.state, "devices", valve);
  f.entities[valve.entityId] = demoClimateEntity(valve);
  const plans = liveCommands(
    f.state,
    [{ type: "mode", targetId: "home" }],
    f.entities,
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0][3].entity_id, "climate.valve");
});

test("Climate actions use each entity's current capability flags and exact option strings", () => {
  const { device, entity, services } = fixture();
  for (const [operation, value] of [
    ["hvac_mode", "cool"],
    ["fan_mode", "medium_low"],
    ["swing_mode", "fixed_middle"],
    ["swing_horizontal_mode", "full_swing"],
    ["preset_mode", "away"],
  ]) {
    assert.deepEqual(
      deviceCommand(device, { operation, value }, entity, services),
      [
        "climate",
        "set_" + operation,
        { [operation]: value },
        { entity_id: device.entityId },
      ],
    );
    assert.throws(
      () =>
        deviceCommand(
          device,
          { operation, value: "unknown_option" },
          entity,
          services,
        ),
      /seçenek/,
    );
  }
  assert.equal(
    deviceCommand(device, { operation: "off" }, entity, services)[1],
    "turn_off",
  );
  assert.equal(
    deviceCommand(device, { operation: "on" }, entity, services)[1],
    "turn_on",
  );
  assert.throws(
    () => deviceCommand(device, { operation: "on" }, entity, {}),
    /işlemi/,
  );
  assert.throws(
    () =>
      deviceCommand(
        device,
        { operation: "on" },
        { ...entity, state: "unavailable" },
        services,
      ),
    /erişilemiyor/,
  );
  entity.attributes.supported_features = 1;
  assert.equal(supportsOperation("climate", "fan_mode", entity), false);
  assert.throws(
    () =>
      deviceCommand(
        device,
        { operation: "fan_mode", value: "auto" },
        entity,
        services,
      ),
    /desteklenmiyor/,
  );
  entity.attributes.hvac_modes = [];
  assert.equal(supportsOperation("climate", "hvac_mode", entity), false);
});

test("AC temperature converts native units, respects bounds and step, rejects missing metadata and range-only devices", () => {
  const { device, entity, services } = fixture();
  assert.equal(
    deviceCommand(
      device,
      { operation: "temperature", value: 22.4 },
      entity,
      services,
    )[2].temperature,
    22,
  );
  assert.throws(
    () =>
      deviceCommand(
        device,
        { operation: "temperature", value: 35 },
        entity,
        services,
      ),
    /aralığında/,
  );
  const f = {
    ...entity,
    attributes: {
      ...entity.attributes,
      temperature_unit: "°F",
      min_temp: 61,
      max_temp: 86,
      target_temp_step: 1,
    },
  };
  assert.equal(climateTarget(22, f), 72);
  delete f.attributes.temperature_unit;
  assert.equal(climateTarget(22, f, "°F"), 72);
  assert.throws(() => climateTarget(22, f, null), /birimi/);
  f.attributes.target_temp_step = 0;
  assert.throws(() => climateTarget(22, f, "°F"), /sınırları/);
  entity.attributes.supported_features = 2;
  assert.throws(
    () =>
      deviceCommand(
        device,
        { operation: "temperature", value: 22 },
        entity,
        services,
      ),
    /desteklenmiyor/,
  );
});

test("Independent demo temperature and fan settings persist without changing room or radiator targets", () => {
  let { state, device } = fixture();
  const before = structuredClone(state.rooms);
  for (const a of [
    { operation: "hvac_mode", value: "cool" },
    { operation: "temperature", value: 24 },
    { operation: "fan_mode", value: "low" },
    { operation: "swing_horizontal_mode", value: "full_swing" },
  ])
    device = applyDeviceAction(device, a);
  state = saveRecord(state, "devices", device);
  state = applyMode(state, "night");
  const restored = validateState(JSON.parse(JSON.stringify(state))).devices.at(
    -1,
  );
  assert.equal(restored.demoState, "cool");
  assert.equal(restored.climateDemo.temperature, 24);
  assert.equal(restored.climateDemo.fan_mode, "low");
  assert.equal(restored.climateDemo.swing_horizontal_mode, "full_swing");
  assert.equal(before.find((r) => r.id === "yatak").target, 22);
  assert.equal(state.rooms.find((r) => r.id === "yatak").target, 19);
  assert.throws(
    () => applyDeviceAction(device, { operation: "temperature", value: 40 }),
    /aralığında/,
  );
});

test("Climate scenes compile to explicit AC targets and live bookkeeping does not impose demo restrictions", () => {
  const f = fixture();
  const scene = {
    ...template("scenes", f.state),
    name: "Klima gecesi",
    steps: [
      {
        id: "cool",
        type: "device",
        targetId: f.device.id,
        operation: "hvac_mode",
        value: "cool",
      },
      {
        id: "temp",
        type: "device",
        targetId: f.device.id,
        operation: "temperature",
        value: 24,
      },
      {
        id: "fan",
        type: "device",
        targetId: f.device.id,
        operation: "fan_mode",
        value: "medium_low",
      },
    ],
  };
  f.state = saveRecord(f.state, "scenes", scene);
  const program = {
    ...template("programs", f.state),
    name: "Yatarken",
    time: "23:00",
    action: "scene",
    targetId: scene.id,
    enabled: true,
  };
  f.state = saveRecord(f.state, "programs", program);
  const compiled = compileProgram(f.state, program, f.entities, {
    config: {
      time_zone: "Europe/Istanbul",
      unit_system: { temperature: "°C" },
    },
    services: f.services,
  });
  assert.equal(compiled.actions.length, 3);
  assert.ok(
    compiled.actions.every((a) => a.target.entity_id === "climate.gree"),
  );
  assert.equal(compiled.actions[1].data.temperature, 24);
  const after = applyScene(f.state, scene, { simulateDevices: false });
  assert.deepEqual(after.devices, f.state.devices);
  assert.deepEqual(after.rooms, f.state.rooms);
});

test("Changing a climate role marks published programs for review and republishing", () => {
  const f = fixture();
  f.state.programs[0].deployment = {
    id: "evim_" + "a".repeat(32),
    fingerprint: "b".repeat(64),
    server: "https://ha.example.com",
    syncedAt: 1,
  };
  const next = saveRecord(f.state, "devices", {
    ...f.device,
    climateRole: "radiator",
  });
  assert.equal(next.programs[0].needsPublish, true);
});

test("Demo room targets and expiring overrides update radiators while preserving the independent AC", () => {
  const f = fixture();
  let state = applyMode(f.state, "night");
  assert.ok(
    state.devices
      .filter((d) => isRoomThermostat(d))
      .every((d) => d.climateDemo.temperature === 19),
  );
  state = applyRoomTarget(state, "yatak", 25, 100);
  assert.equal(
    state.devices.find((d) => d.id === "valve-yatak-0").climateDemo.temperature,
    25,
  );
  state = expireOverrides(state, 101);
  assert.equal(
    state.devices.find((d) => d.id === "valve-yatak-0").climateDemo.temperature,
    19,
  );
  assert.deepEqual(state.devices.at(-1), f.device);
});
