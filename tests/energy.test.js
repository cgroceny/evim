import test from "node:test";
import assert from "node:assert/strict";
import {
  energyRange,
  zonedParts,
  energyUnit,
  powerWatts,
  summarizeStatistics,
  estimatedCost,
  energyCsv,
} from "../src/energy.js";

test("Istanbul ranges respect local midnight and calendar boundaries", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  assert.equal(
    energyRange("today", "Europe/Istanbul", now).start.toISOString(),
    "2026-10-28T21:00:00.000Z",
  );
  assert.equal(
    energyRange("week", "Europe/Istanbul", now).start.toISOString(),
    "2026-10-22T21:00:00.000Z",
  );
  assert.equal(
    energyRange("month", "Europe/Istanbul", now).start.toISOString(),
    "2026-09-30T21:00:00.000Z",
  );
  assert.equal(
    energyRange(
      "today",
      "Europe/Berlin",
      new Date("2026-03-29T12:00:00Z"),
    ).start.toISOString(),
    "2026-03-28T23:00:00.000Z",
  );
  assert.equal(
    energyRange(
      "today",
      "Europe/Berlin",
      new Date("2026-10-25T12:00:00Z"),
    ).start.toISOString(),
    "2026-10-24T22:00:00.000Z",
  );
});
test("Energy totals consume Recorder reset-corrected changes, not cumulative readings", () => {
  const start = 1793221200000,
    end = start + 10800000;
  const r = summarizeStatistics(
    [
      { start: start - 3600000, end: start, change: 999 },
      { start, end: start + 3600000, state: 500, sum: 500, change: 2 },
      {
        start: start + 3600000,
        end: start + 7200000,
        state: 1,
        sum: 501,
        change: 1,
      },
      { start: start + 7200000, end, change: null },
      { start: end, end: end + 3600000, change: 999 },
    ],
    start,
    end,
  );
  assert.equal(r.total, 3);
  assert.equal(r.missing, 1);
  assert.equal(r.points.length, 3);
  assert.equal(r.lastEnd, start + 7200000);
});
test("Missing data is not zero; zero consumption and negative net energy remain explicit", () => {
  assert.equal(summarizeStatistics([], 0, 10).total, null);
  assert.equal(
    summarizeStatistics([{ start: 0, end: 5, change: null }], 0, 10).total,
    null,
  );
  assert.equal(
    summarizeStatistics([{ start: 0, end: 5, change: 0 }], 0, 10).total,
    0,
  );
  assert.equal(
    summarizeStatistics([{ start: 0, end: 5, change: -1 }], 0, 10).negative,
    true,
  );
  assert.equal(estimatedCost(null, 3), null);
  assert.equal(estimatedCost(10, 0), null);
  assert.equal(estimatedCost(0, 3), 0);
  assert.equal(estimatedCost(10, 3.5), 35);
});
test("Power and energy units cannot be mixed; blank and unavailable power stay unknown", () => {
  assert.equal(energyUnit("Wh"), 0.001);
  assert.equal(energyUnit("W"), null);
  const e = (state) => ({ state, attributes: { unit_of_measurement: "kW" } });
  assert.equal(powerWatts(e("1.25")), 1250);
  assert.equal(powerWatts(e("0")), 0);
  assert.equal(powerWatts(e("")), null);
  assert.equal(powerWatts(e("unavailable")), null);
});
test("CSV keeps numeric values but neutralizes spreadsheet formulas in sensor names", () => {
  const csv = energyCsv(
    { x: { points: [{ start: 0, end: 1000, kwh: -0.5 }] } },
    { x: '=HYPERLINK("bad")' },
  );
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"-0,5"'));
  assert.ok(csv.includes('"1970-01-01 02:00"'), "times use the home time zone");
  assert.ok(csv.startsWith("\ufeff"));
});

test("Day range starts at the first real instant when local midnight is skipped", () => {
  const r = energyRange("today", "America/Santiago", new Date("2026-09-06T12:00:00Z"));
  const q = zonedParts(r.start, "America/Santiago");
  assert.equal(q.day, 6);
  assert.ok(q.hour <= 1);
});
