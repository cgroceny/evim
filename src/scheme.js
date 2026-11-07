// Light / dark appearance is a per-device preference (like font size), so it
// lives in this browser only and is not part of the synced home layout.
const KEY = "evim.scheme";
export const SCHEMES = [
  ["system", "Sistemle aynı"],
  ["light", "Açık"],
  ["dark", "Koyu"],
];
export function readScheme() {
  try {
    const v = localStorage.getItem(KEY);
    return SCHEMES.some(([k]) => k === v) ? v : "system";
  } catch {
    return "system";
  }
}
export function applyScheme(scheme) {
  const root = document.documentElement;
  if (scheme === "system") root.removeAttribute("data-scheme");
  else root.setAttribute("data-scheme", scheme);
}
export function saveScheme(scheme) {
  try {
    if (scheme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, scheme);
  } catch {
    /* private mode: still applies for this visit */
  }
  applyScheme(scheme);
}
