import test from "node:test";
import assert from "node:assert/strict";
import {
  boundTemperature,
  temperatureAtPoint,
  dialPoint,
  temperatureProgress,
  parseTemperature,
} from "../src/temperature.js";
test("Dial position maps left endpoint, top midpoint and right endpoint to the configured room limits", () => {
  assert.equal(temperatureAtPoint(-1, 1, 10, 28), 10);
  assert.equal(temperatureAtPoint(0, -1, 10, 28), 19);
  assert.equal(temperatureAtPoint(1, 1, 10, 28), 28);
  assert.equal(temperatureAtPoint(0, -1, 16, 24), 20);
});
test("Dragging across the bottom gap keeps the same endpoint instead of wrapping the temperature", () => {
  assert.equal(temperatureAtPoint(-0.01, 1, 10, 28, 28), 28);
  assert.equal(temperatureAtPoint(0.01, 1, 10, 28, 10), 10);
});
test("Manual input supports Turkish and dot decimals but rejects empty, mixed, nonnumeric, out of range and non half-degree values", () => {
  assert.deepEqual(parseTemperature("22,5", 10, 28), { value: 22.5 });
  assert.deepEqual(parseTemperature(" 19.0 ", 10, 28), { value: 19 });
  for (const s of [
    "",
    "22,",
    "22.5.2",
    "abc",
    "Infinity",
    "1e2",
    "28.5",
    "-5",
    "22,3",
  ])
    assert.ok(parseTemperature(s, 10, 28).error, s);
  assert.deepEqual(parseTemperature("18", 18, 23), { value: 18 });
  assert.ok(parseTemperature("17,5", 18, 23).error);
});
test("Pointer scale and keyboard nudges clamp correctly including a fixed-temperature room", () => {
  assert.equal(boundTemperature(100, 10, 28), 28);
  assert.equal(boundTemperature(-4, 10, 28), 10);
  assert.equal(boundTemperature(22.27, 10, 28), 22.5);
  assert.equal(boundTemperature(22, 19, 19), 19);
  assert.equal(temperatureProgress(19, 19, 19), 0);
  assert.equal(temperatureAtPoint(0, -1, 19, 19), 19);
  const p = dialPoint(0.5);
  assert.equal(p.x, 120);
  assert.equal(p.y, 30);
  for (const value of [10, 12, 18.5, 22, 27.5, 28]) {
    const point = dialPoint(temperatureProgress(value, 10, 28));
    assert.equal(
      temperatureAtPoint(point.x - 120, point.y - 120, 10, 28),
      value,
    );
  }
});
