// Generates src/dark.css from the light stylesheets.
// Every declaration that carries a color is re-emitted under a dark scope with a
// color mapped by role: surfaces become dark, ink becomes light, borders and
// shadows are tuned for a dark background. Hand-tuned overrides live in
// src/dark-tweaks.css, which is imported after the generated file.
// Run: node scripts/build-dark-css.mjs   (also runs before every build)
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const SRC = new URL("../src/", import.meta.url);
const FILES = ["styles.css", "crud.css", "temperature.css", "features.css"];
const DARK = ':root[data-scheme="dark"]';
const AUTO = ':root:not([data-scheme="light"])';

// --- color math (OKLab / OKLCH) ---------------------------------------------
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055;
function hexToRgba(hex) {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
}
function rgbToOklch([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function oklchToRgb([L, C, H]) {
  const A = C * Math.cos(H),
    B = C * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3,
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3,
    s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
function toHex(L, C, H, a) {
  let rgb;
  for (let c = C; ; c *= 0.9) {
    rgb = oklchToRgb([L, c, H]);
    if (rgb.every((v) => v >= -0.001 && v <= 1.001) || c < 0.001) break;
  }
  const byte = (v) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return (
    "#" + rgb.map((v) => byte(toGam(Math.min(1, Math.max(0, v))))).join("") +
    (a < 1 ? byte(a) : "")
  );
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// role: "surface" | "ink" | "line" | "shadow"
export function darkColor(hex, role) {
  const [r, g, b, a] = hexToRgba(hex);
  let [L, C, H] = rgbToOklch([r, g, b]);
  if (role === "shadow") return toHex(0.08, C * 0.3, H, Math.min(1, a * 1.6));
  if (role === "surface") {
    // Light surfaces become layered dark surfaces; dark fills (buttons,
    // sidebar) stay dark and dim a little.
    if (L >= 0.7) return toHex(0.2 + (1 - L) * 0.55, C * 0.55, H, a);
    if (L >= 0.55) return toHex(L * 0.62, C * 0.85, H, a);
    return toHex(clamp(L * 0.85, 0.22, 0.5), C, H, a);
  }
  if (role === "line") {
    if (L >= 0.6) return toHex(0.3 + (1 - L) * 0.4, C * 0.6, H, a);
    return toHex(clamp(1.15 - L, 0.55, 0.85), C, H, a);
  }
  // ink: dark text becomes light; already-light text (on dark fills) stays.
  if (L < 0.62) return toHex(clamp(0.97 - L * 0.32, 0.72, 0.93), C * 0.8, H, a);
  return toHex(Math.max(L, 0.8), C, H, a);
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const NAMED = /\b(white|black)\b/g;
const VAR_ROLES = {
  "--green": "surface",
  "--accent": "surface",
  "--cream": "surface",
  "--line": "line",
  "--muted": "ink",
  "--orange": "ink",
  "--dial-color": "ink",
};
const roleOf = (prop) => {
  if (VAR_ROLES[prop]) return VAR_ROLES[prop];
  if (/shadow/.test(prop)) return "shadow";
  if (/^(background|--.*bg|--.*surface)/.test(prop)) return "surface";
  if (/^(border|--line)/.test(prop)) return "line";
  return "ink"; // color, fill, stroke, accent-color, caret, text-decoration…
};
// Theme variables used for text get an ink twin in dark mode.
const INK_VARS = { "--green": "--green-ink", "--muted": "--muted-ink" };

function mapValue(prop, value) {
  const role = roleOf(prop);
  let v = value
    .replace(NAMED, (n) => (n === "white" ? "#ffffff" : "#000000"))
    .replace(HEX, (h) => darkColor(h, role));
  if (role === "ink" && !prop.startsWith("--"))
    for (const [from, to] of Object.entries(INK_VARS))
      v = v.replaceAll(`var(${from})`, `var(${to})`);
  return v;
}
const hasColor = (prop, value) =>
  HEX.test(value) ||
  (NAMED.test(value) && !/^(white-space)$/.test(prop)) ||
  (roleOf(prop) === "ink" &&
    Object.keys(INK_VARS).some((k) => value.includes(`var(${k})`)));

function scopeSelector(sel, scope) {
  return sel
    .split(",")
    .map((s) => {
      s = s.trim();
      if (s.startsWith(":root")) return scope + s.slice(5);
      if (/^html\b/.test(s)) return scope + s.slice(4);
      return `${scope} ${s}`;
    })
    .join(", ");
}

function darkTree(scope) {
  const out = postcss.root();
  for (const file of FILES) {
    const root = postcss.parse(readFileSync(new URL(file, SRC), "utf8"));
    root.walkAtRules((at) => {
      if (/^(import|font-face|keyframes|-webkit-keyframes)$/.test(at.name))
        at.remove();
    });
    root.walkRules((rule) => {
      rule.walkDecls((d) => {
        HEX.lastIndex = NAMED.lastIndex = 0;
        const keep = hasColor(d.prop, d.value);
        HEX.lastIndex = NAMED.lastIndex = 0;
        if (!keep) d.remove();
        else d.value = mapValue(d.prop, d.value);
      });
      if (!rule.nodes.length) rule.remove();
      else rule.selector = scopeSelector(rule.selector, scope);
    });
    root.walkAtRules((at) => {
      if (!at.nodes?.length) at.remove();
    });
    out.append(root.nodes);
  }
  return out;
}

const forced = darkTree(DARK);
const auto = postcss.atRule({ name: "media", params: "(prefers-color-scheme: dark)" });
auto.append(darkTree(AUTO).nodes);
const css =
  "/* Generated by scripts/build-dark-css.mjs — do not edit by hand. */\n" +
  forced.toString() +
  "\n" +
  auto.toString() +
  "\n";
writeFileSync(new URL("dark.css", SRC), css);
console.log(`dark.css: ${css.length} bytes`);
