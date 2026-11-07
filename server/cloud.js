import {
  randomBytes,
  randomUUID,
  createHash,
  createHmac,
  timingSafeEqual,
  scrypt as scryptCb,
} from "node:crypto";
import { promisify } from "node:util";
import { validateState } from "../src/model.js";
import { newAccessCode, validAccessCode } from "./access-code.js";
const scrypt = promisify(scryptCb);
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
const sha = (s) => createHash("sha256").update(s).digest("hex");
const equals = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export function username(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(value))
    fail(
      400,
      "Kullanıcı adı 3–30 karakter olmalı; küçük harf, rakam, nokta, alt çizgi veya tire kullanın.",
    );
  return value;
}
function password(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    fail(400, "Parola 12–128 karakter olmalı.");
  return value;
}
async function hashPassword(value, salt = randomBytes(16).toString("hex")) {
  const hash = await scrypt(value, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return { salt, hash: hash.toString("hex") };
}
const publicUser = (a) => ({
  username: a.username,
  id: a.id,
  hasPassword: !!a.password,
  accessCodeExpiresAt: a.accessCode?.expiresAt ?? null,
});
export function cloudService(repo, secret) {
  if (!secret || secret.length < 32)
    throw new Error("Cloud authentication configuration missing");
  const sign = (data) =>
    createHmac("sha256", secret).update(data).digest("base64url");
  const key = (name) => "accounts/" + sha(name) + ".json";
  const recoveryHash = (code) =>
    createHmac("sha256", secret)
      .update("recovery:" + code)
      .digest("hex");
  async function limit(identifier, max = 10, window = 900000) {
    const path =
      "limits/" +
      Math.floor(Date.now() / window) +
      "/" +
      sign(identifier) +
      ".json";
    for (let attempt = 0; attempt < 3; attempt++) {
      const old = await repo.read(path),
        count = (old?.value.count || 0) + 1;
      if (count > max)
        fail(429, "Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.");
      try {
        await repo.write(path, { count }, old?.etag ?? null);
        return;
      } catch (e) {
        if (e.status !== 409) throw e;
      }
    }
    fail(429, "Şu anda çok sayıda istek var. Biraz sonra tekrar deneyin.");
  }
  // Failed sign-ins are counted separately from attempts, so a stranger who
  // knows the username cannot lock the owner out with junk requests: the
  // per-user+IP budget stops guessing, and a high per-user ceiling stops a
  // distributed attack without blocking normal use.
  async function failures(identifier, max, window = 900000) {
    const path =
      "limits/" + Math.floor(Date.now() / window) + "/" + sign(identifier) + ".json";
    const old = await repo.read(path);
    if ((old?.value.count || 0) >= max)
      fail(429, "Çok fazla hatalı deneme yapıldı. Bir süre sonra tekrar deneyin.");
  }
  async function recordFailure(identifier, window = 900000) {
    try {
      await limit(identifier, Infinity, window);
    } catch {
      /* counting is best effort; the sign-in already failed */
    }
  }
  async function account(name) {
    return await repo.read(key(name));
  }
  // Account records are written with their ETag. A concurrent sign-in or
  // logout on another device makes the write fail with 409; re-read and retry.
  async function retrying(fn) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (e.status !== 409 || attempt >= 2) throw e;
      }
    }
  }
  async function issue(a, etag, maxExpires = Infinity) {
    const nonce = randomBytes(24).toString("base64url"),
      expires = Math.min(Date.now() + 7 * 86400000, maxExpires);
    const next = {
      ...a,
      sessions: [
        ...(a.sessions || []).filter((x) => x.expires > Date.now()).slice(-9),
        { nonce, expires },
      ],
    };
    await repo.write(key(a.username), next, etag);
    const data = Buffer.from(
      JSON.stringify({ name: a.username, nonce, expires, version: a.version }),
    ).toString("base64url");
    return { user: publicUser(a), token: data + "." + sign(data) };
  }
  async function authenticate(token) {
    if (typeof token !== "string" || token.length > 2048)
      fail(401, "Giriş yapmanız gerekiyor.");
    const [data, sig, ...extra] = token.split(".");
    if (extra.length || !data || !sig || !equals(sign(data), sig))
      fail(401, "Oturum geçersiz.");
    let claim;
    try {
      claim = JSON.parse(Buffer.from(data, "base64url").toString());
    } catch {
      fail(401, "Oturum geçersiz.");
    }
    if (typeof claim.name !== "string" || claim.expires < Date.now())
      fail(401, "Oturumun süresi doldu.");
    const record = await account(username(claim.name));
    if (
      !record ||
      record.value.version !== claim.version ||
      !record.value.sessions.some(
        (s) => s.nonce === claim.nonce && s.expires > Date.now(),
      )
    )
      fail(401, "Oturum sona erdi.");
    return { ...record, claim };
  }
  return {
    async register(body, ip) {
      await limit("register:" + ip, 5, 86400000);
      const name = username(body.username);
      password(body.password);
      if (await account(name)) fail(409, "Bu kullanıcı adı kullanılamıyor.");
      const recoveryCode = randomBytes(24).toString("base64url");
      const a = {
        id: randomUUID(),
        username: name,
        password: await hashPassword(body.password),
        recoveryHash: recoveryHash(recoveryCode),
        version: 1,
        sessions: [],
        createdAt: Date.now(),
      };
      return { ...(await issue(a, null)), recoveryCode };
    },
    async login(body, ip) {
      await limit("login-ip:" + ip, 25);
      const name = username(body.username);
      await failures("login-fail:" + name + ":" + ip, 10);
      await failures("login-fail:" + name, 100);
      password(body.password);
      const rec = await account(name);
      const candidate = await hashPassword(
        body.password,
        rec?.value.password?.salt || "00000000000000000000000000000000",
      );
      if (!rec?.value.password || !equals(candidate.hash, rec.value.password.hash)) {
        await recordFailure("login-fail:" + name + ":" + ip);
        await recordFailure("login-fail:" + name);
        fail(401, "Kullanıcı adı veya parola hatalı.");
      }
      let current = rec;
      return retrying(async () => {
        try {
          return await issue(current.value, current.etag);
        } catch (e) {
          if (e.status === 409) current = await account(name);
          throw e;
        }
      });
    },
    async loginCode(body, ip) {
      await limit("login-ip:" + ip, 25);
      const name = username(body.username);
      await failures("login-fail:" + name + ":" + ip, 10);
      await failures("login-fail:" + name, 100);
      let rec = await account(name);
      if (!rec || !validAccessCode(body.accessCode, rec.value.accessCode)) {
        await recordFailure("login-fail:" + name + ":" + ip);
        await recordFailure("login-fail:" + name);
        fail(401, "Kullanıcı adı veya erişim kodu geçersiz. Kodun süresi dolmuş olabilir.");
      }
      return retrying(async () => {
        if (!validAccessCode(body.accessCode, rec?.value.accessCode))
          fail(401, "Kullanıcı adı veya erişim kodu geçersiz. Kodun süresi dolmuş olabilir.");
        // An administratively provisioned account receives its recovery key on first sign-in.
        const recoveryCode = rec.value.recoveryHash ? undefined : randomBytes(24).toString("base64url");
        const a = recoveryCode ? { ...rec.value, recoveryHash: recoveryHash(recoveryCode) } : rec.value;
        try {
          return { ...(await issue(a, rec.etag, a.accessCode.expiresAt)), recoveryCode };
        } catch (e) {
          if (e.status === 409) rec = await account(name);
          throw e;
        }
      });
    },
    async recover(body, ip) {
      await limit("recover:" + ip, 5);
      const name = username(body.username);
      password(body.password);
      const rec = await account(name);
      if (
        typeof body.recoveryCode !== "string" ||
        body.recoveryCode.length > 100 ||
        !rec ||
        !equals(recoveryHash(body.recoveryCode), rec.value.recoveryHash)
      )
        fail(401, "Kullanıcı adı veya kurtarma anahtarı hatalı.");
      const recoveryCode = randomBytes(24).toString("base64url");
      const a = {
        ...rec.value,
        password: await hashPassword(body.password),
        recoveryHash: recoveryHash(recoveryCode),
        accessCode: null,
        version: rec.value.version + 1,
        sessions: [],
      };
      return { ...(await issue(a, rec.etag)), recoveryCode };
    },
    async session(token) {
      return publicUser((await authenticate(token)).value);
    },
    async security(token, body) {
      const rec = await authenticate(token);
      if (body.accountId !== rec.value.id)
        fail(403, "Hesap değişti. Sayfayı yenileyin.");
      await limit("security:" + rec.value.id, 8);
      if (!["password", "recovery", "sessions", "access-create", "access-revoke"].includes(body.mode))
        fail(400, "Güvenlik işlemi geçersiz.");
      if (body.mode !== "sessions") {
        if (rec.value.password) {
          password(body.currentPassword);
          const candidate = await hashPassword(body.currentPassword, rec.value.password.salt);
          if (!equals(candidate.hash, rec.value.password.hash)) fail(400, "Mevcut parola hatalı.");
        } else if (!validAccessCode(body.currentCode, rec.value.accessCode)) {
          fail(400, "Mevcut erişim kodu geçersiz.");
        }
      }
      if (body.mode === "access-revoke" && !rec.value.password)
        fail(400, "Erişim kodunu kaldırmadan önce hesabınıza bir parola ekleyin.");
      if (body.mode === "password") password(body.password);
      const recoveryCode =
        ["password", "recovery"].includes(body.mode) ? randomBytes(24).toString("base64url") : undefined;
      const access = body.mode === "access-create" ? newAccessCode() : null;
      const a = {
        ...rec.value,
        version: rec.value.version + 1,
        sessions: [],
        ...(body.mode === "password"
          ? { password: await hashPassword(body.password) }
          : {}),
        ...(recoveryCode ? { recoveryHash: recoveryHash(recoveryCode) } : {}),
        ...(access ? { accessCode: access.credential } : {}),
        // Renewing only the recovery key must not strip the sole sign-in method
        // from an account that has an access code but no password.
        ...(["password", "access-revoke"].includes(body.mode) ||
        (body.mode === "recovery" && rec.value.password)
          ? { accessCode: null }
          : {}),
      };
      return { ...(await issue(a, rec.etag)), recoveryCode, accessCode: access?.code };
    },
    async logout(token) {
      // Re-authenticate on every attempt so a 409 retry uses the fresh record.
      await retrying(async () => {
        const r = await authenticate(token);
        await repo.write(
          key(r.value.username),
          {
            ...r.value,
            sessions: r.value.sessions.filter((x) => x.nonce !== r.claim.nonce),
          },
          r.etag,
        );
      });
    },
    async load(token) {
      const r = await authenticate(token);
      const home = await repo.read("homes/" + r.value.id + ".json");
      return {
        user: publicUser(r.value),
        state: home?.value ?? null,
        revision: home?.etag ?? null,
      };
    },
    async save(token, body) {
      const r = await authenticate(token);
      if (body.accountId !== r.value.id)
        fail(403, "Başka bir hesapta oturum açıldı. Sayfayı yenileyin.");
      if (body.state?.version !== 4)
        fail(
          426,
          "Uygulamanın yeni sürümü mevcut. Sayfayı yenileyin; yerel yedeğinizi koruyun.",
        );
      await limit("write:" + r.value.id, 90, 60000);
      if (body.revision !== null && typeof body.revision !== "string")
        fail(400, "Kayıt sürümü gerekli.");
      let state;
      try {
        state = validateState(body.state);
      } catch (e) {
        fail(400, e.message);
      }
      state.updatedAt = Date.now();
      const result = await repo.write(
        "homes/" + r.value.id + ".json",
        state,
        body.revision,
      );
      return { state, revision: result.etag };
    },
  };
}
