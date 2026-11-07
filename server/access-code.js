import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export const ACCESS_CODE_LIFETIME = 90 * 86400000;

export function normalizeAccessCode(value) {
  if (typeof value !== "string" || value.length > 100) return null;
  const normalized = value.trim().toUpperCase().replace(/^EVIM[-\s]*/, "").replace(/[-\s]/g, "");
  return /^[0-9A-F]{32}$/.test(normalized) ? normalized : null;
}

export function accessCodeHash(value) {
  const normalized = normalizeAccessCode(value);
  return normalized ? createHash("sha256").update("evim-access-v1:" + normalized).digest("hex") : null;
}

export function newAccessCode(now = Date.now()) {
  const code = "EVIM-" + randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g).join("-");
  return { code, credential: { hash: accessCodeHash(code), createdAt: now, expiresAt: now + ACCESS_CODE_LIFETIME } };
}

export function validAccessCode(value, credential, now = Date.now()) {
  const hash = accessCodeHash(value);
  return !!(hash && typeof credential?.hash === "string" && /^[0-9a-f]{64}$/.test(credential.hash)
    && credential.expiresAt > now && timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(credential.hash, "hex")));
}
