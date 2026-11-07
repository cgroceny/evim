export function energyUnit(unit) {
  return { Wh: 0.001, kWh: 1, MWh: 1000, GWh: 1000000 }[unit] ?? null;
}
export function powerWatts(entity) {
  if (
    !entity ||
    !String(entity.state ?? "").trim() ||
    ["unknown", "unavailable"].includes(entity.state)
  )
    return null;
  const factor = { W: 1, kW: 1000, MW: 1000000 }[
      entity.attributes?.unit_of_measurement
    ],
    value = Number(entity.state);
  return factor && Number.isFinite(value) ? value * factor : null;
}
export function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
}
export function energyRange(
  period,
  timeZone = "Europe/Istanbul",
  now = new Date(),
) {
  const p = zonedParts(now, timeZone),
    calendar = new Date(
      Date.UTC(
        p.year,
        p.month - 1,
        period === "month" ? 1 : p.day - (period === "week" ? 6 : 0),
      ),
    );
  const target = calendar.getTime();
  let start = target;
  for (let i = 0; i < 4; i++) {
    const q = zonedParts(new Date(start), timeZone);
    const local = Date.UTC(
      q.year,
      q.month - 1,
      q.day,
      q.hour,
      q.minute,
      q.second,
    );
    start += target - local;
  }
  // When local midnight does not exist (clocks jump forward at 00:00), the
  // loop settles an hour early, on the previous day. Step forward to the
  // first instant of the requested day.
  for (let i = 0; i < 3; i++) {
    const q = zonedParts(new Date(start), timeZone);
    if (Date.UTC(q.year, q.month - 1, q.day) >= target) break;
    start += 3600000;
  }
  return {
    start: new Date(start),
    end: new Date(now),
    period: period === "today" ? "hour" : "day",
  };
}
export function summarizeStatistics(rows, start, end) {
  // Home Assistant Recorder provides reset-corrected changes in requested kWh units.
  const points = (rows || [])
    .filter(
      (r) => Number.isFinite(r.start) && r.start >= +start && r.start < +end,
    )
    .sort((a, b) => a.start - b.start);
  const valid = points.filter(
    (r) => typeof r.change === "number" && Number.isFinite(r.change),
  );
  return {
    points: points.map((r) => ({
      start: r.start,
      end: r.end,
      kwh: Number.isFinite(r.change) ? r.change : null,
    })),
    total: valid.length ? valid.reduce((a, r) => a + r.change, 0) : null,
    missing: points.length - valid.length,
    lastEnd: valid.length ? Math.max(...valid.map((r) => r.end)) : null,
    negative: valid.some((r) => r.change < 0),
  };
}
export function estimatedCost(kwh, tariff) {
  return Number.isFinite(kwh) && Number.isFinite(tariff) && tariff > 0
    ? kwh * tariff
    : null;
}
export function energyCsv(series, names, timeZone) {
  const cell = (v) => {
    const raw = String(v),
      safe =
        typeof v === "string" &&
        /^[\s]*[=+@\-]/.test(raw) &&
        !/^-?\d+(,\d+)?$/.test(raw) // a plain number like "-0,5" is safe
          ? "'" + raw
          : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  // Times are written in the home's time zone and kWh with a decimal comma,
  // so Turkish Excel (which also expects ";" separators) reads them as
  // dates and numbers rather than text.
  const zone = timeZone || "Europe/Istanbul";
  const when = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const time = (t) => when.format(new Date(t));
  const kwh = (v) =>
    Number.isFinite(v)
      ? // Plain ASCII minus and comma: tr-TR locale formatting would emit a
        // Unicode minus sign that spreadsheets do not read as a number.
        String(Number(v.toFixed(6))).replace(".", ",")
      : "";
  const rows = [
    ["Sayaç", `Dönem başlangıcı (${zone})`, `Dönem sonu (${zone})`, "kWh"],
  ];
  for (const [id, s] of Object.entries(series))
    for (const p of s.points)
      rows.push([names[id] || id, time(p.start), time(p.end), kwh(p.kwh)]);
  return "\ufeff" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
export const ENERGY_DEFAULTS = {
  meter: "",
  power: "",
  submeters: [],
  tariff: 0,
  currency: "TRY",
  monthlyBudget: 0,
};
