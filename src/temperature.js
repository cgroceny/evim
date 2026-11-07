// The dial spans 270 degrees, leaving a gap below the scale.
export const START_ANGLE = -135;
export const END_ANGLE = 135;
export function boundTemperature(value, min, max, step = 0.5) {
  const number = Number.isFinite(value) ? value : min;
  const rounded = min + Math.round((number - min) / step) * step;
  return Number(Math.min(max, Math.max(min, rounded)).toFixed(4));
}
export function temperatureProgress(value, min, max) {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
export function dialPoint(progress, radius = 90, center = 120) {
  const angle =
    ((START_ANGLE + Math.max(0, Math.min(1, progress)) * 270) * Math.PI) / 180;
  return {
    x: center + Math.sin(angle) * radius,
    y: center - Math.cos(angle) * radius,
  };
}
export function temperatureAtPoint(x, y, min, max, previous) {
  // x/y are relative to the center; screen y increases downwards.
  let angle = (Math.atan2(x, -y) * 180) / Math.PI;
  if (Math.abs(angle) > END_ANGLE) {
    // Keep the same endpoint while dragging through the gap; don't wrap 28 -> 10.
    angle = Number.isFinite(previous)
      ? previous < (min + max) / 2
        ? START_ANGLE
        : END_ANGLE
      : angle < 0
        ? START_ANGLE
        : END_ANGLE;
  }
  return boundTemperature(
    min + ((angle - START_ANGLE) / 270) * (max - min),
    min,
    max,
  );
}
export function parseTemperature(raw, min, max, step = 0.5) {
  const value = String(raw).trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(value))
    return { error: "Bir sıcaklık yazın; örneğin 22,5." };
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number) || number < min || number > max)
    return {
      error: `${String(min).replace(".", ",")}–${String(max).replace(".", ",")}°C arasında bir değer girin.`,
    };
  if (Math.abs(boundTemperature(number, min, max, step) - number) > 0.00001)
    return {
      error: `${String(step).replace(".", ",")}° adımlarla girin; örneğin ${String(boundTemperature(number, min, max, step)).replace(".", ",")}.`,
    };
  return { value: number };
}
