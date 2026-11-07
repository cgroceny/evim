import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cloudService, HttpError } from "../server/cloud.js";
import { newAccessCode, normalizeAccessCode, validAccessCode, ACCESS_CODE_LIFETIME } from "../server/access-code.js";
import { createHandler } from "../api/cloud.js";
import { initialState } from "../src/model.js";

function setup() {
  const records = new Map();
  let revision = 0;
  const repo = {
    async read(key) { return records.has(key) ? structuredClone(records.get(key)) : null; },
    async write(key, value, etag) {
      if ((records.get(key)?.etag ?? null) !== etag) throw new HttpError(409, "conflict");
      const row = { value: structuredClone(value), etag: "r" + ++revision };
      records.set(key, row);
      return { etag: row.etag };
    },
  };
  return { records, repo, svc: cloudService(repo, "synthetic-test-secret-not-for-real-accounts-1234") };
}
const pathFor = name => "accounts/" + createHash("sha256").update(name).digest("hex") + ".json";
async function provision(ctx, name = "owner_test", expiresAt) {
  const access = newAccessCode();
  if (expiresAt !== undefined) access.credential.expiresAt = expiresAt;
  await ctx.repo.write(pathFor(name), { id: name + "-id", username: name, password: null, recoveryHash: null, version: 1, sessions: [], accessCode: access.credential }, null);
  return access;
}
async function register(svc, name = "password_user") {
  return svc.register({ username: name, password: "Synthetic-password-1234!" }, name + "-ip");
}

test("Access codes have 128 random bits, tolerate typing separators and enforce expiry", () => {
  const a = newAccessCode(1234), b = newAccessCode(1234);
  assert.notEqual(a.code, b.code);
  assert.match(a.code, /^EVIM(?:-[0-9A-F]{4}){8}$/);
  assert.equal(a.credential.expiresAt, 1234 + ACCESS_CODE_LIFETIME);
  assert.equal(normalizeAccessCode(a.code).length, 32);
  assert.equal(validAccessCode(a.code.toLowerCase().replaceAll("-", " "), a.credential, 1235), true);
  assert.equal(validAccessCode(b.code, a.credential, 1235), false);
  assert.equal(validAccessCode(a.code, a.credential, a.credential.expiresAt), false);
  for (const bad of [null, {}, 123, "EVIM-123", "A".repeat(101), "G".repeat(32)]) assert.equal(normalizeAccessCode(bad), null);
});

test("Code sign-in on two devices shares the same isolated home and never returns the credential hash", async () => {
  const ctx = setup(), access = await provision(ctx);
  const first = await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "desktop");
  const second = await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "phone");
  assert.ok(first.recoveryCode);
  assert.equal(second.recoveryCode, undefined);
  assert.equal(first.user.hasPassword, false);
  assert.equal(first.user.id, second.user.id);
  const state = initialState(); state.home.name = "My private home";
  await ctx.svc.save(first.token, { accountId: first.user.id, state, revision: null });
  assert.equal((await ctx.svc.load(second.token)).state.home.name, "My private home");
  const other = await register(ctx.svc, "other_user");
  assert.equal((await ctx.svc.load(other.token)).state, null);
  await assert.rejects(() => ctx.svc.save(other.token, { accountId: first.user.id, state, revision: null }), e => e.status === 403);
  const exposed = JSON.stringify(await ctx.svc.session(first.token));
  assert.ok(!exposed.includes(access.credential.hash));
  assert.ok(!JSON.stringify([...ctx.records.values()]).includes(access.code));
});

test("Wrong, expired and cross-account codes cannot authenticate; password/code attempts share a rate limit", async () => {
  const ctx = setup(), access = await provision(ctx);
  await provision(ctx, "expired_user", Date.now() - 1);
  await assert.rejects(() => ctx.svc.loginCode({ username: "missing_user", accessCode: access.code }, "ip"), e => e.status === 401);
  await assert.rejects(() => ctx.svc.loginCode({ username: "expired_user", accessCode: access.code }, "ip"), e => e.status === 401);
  for (let i = 0; i < 10; i++) {
    await assert.rejects(() => i % 2
      ? ctx.svc.login({ username: "owner_test", password: "Invalid-password-1234" }, "ip")
      : ctx.svc.loginCode({ username: "owner_test", accessCode: "invalid" }, "ip"), e => e.status === 401);
  }
  await assert.rejects(() => ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "ip"), e => e.status === 429);
});

test("Password reauthentication is required to mint codes; rotation/revocation close old sessions", async () => {
  const { svc } = setup(), a = await register(svc);
  const args = { accountId: a.user.id, mode: "access-create", currentPassword: "Synthetic-password-1234!" };
  await assert.rejects(() => svc.security(a.token, { ...args, currentPassword: "Wrong-password-1234" }), e => e.status === 400);
  await assert.rejects(() => svc.security(a.token, { ...args, accountId: "someone-else" }), e => e.status === 403);
  const b = await svc.security(a.token, args);
  const phone = await svc.loginCode({ username: a.user.username, accessCode: b.accessCode }, "phone");
  const c = await svc.security(b.token, args);
  await assert.rejects(() => svc.loginCode({ username: a.user.username, accessCode: b.accessCode }, "phone"), e => e.status === 401);
  await assert.rejects(() => svc.session(phone.token), e => e.status === 401);
  const d = await svc.security(c.token, { ...args, mode: "access-revoke" });
  assert.equal(d.user.accessCodeExpiresAt, null);
  await assert.rejects(() => svc.loginCode({ username: a.user.username, accessCode: c.accessCode }, "phone"), e => e.status === 401);
  assert.ok((await svc.login({ username: a.user.username, password: args.currentPassword }, "password-ip")).token);
});

test("Code-only users can rotate their code or add a password without getting locked out", async () => {
  const ctx = setup(), access = await provision(ctx);
  const a = await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "ip");
  const args = { accountId: a.user.id, currentCode: access.code };
  await assert.rejects(() => ctx.svc.security(a.token, { ...args, mode: "access-revoke" }), e => e.status === 400);
  await assert.rejects(() => ctx.svc.security(a.token, { ...args, currentCode: "bad", mode: "access-create" }), e => e.status === 400);
  const b = await ctx.svc.security(a.token, { ...args, mode: "access-create" });
  assert.ok(b.accessCode);
  await assert.rejects(() => ctx.svc.session(a.token), e => e.status === 401);
  const c = await ctx.svc.security(b.token, { accountId: a.user.id, currentCode: b.accessCode, mode: "password", password: "Added-password-1234!" });
  assert.equal(c.user.hasPassword, true);
  assert.equal(c.user.accessCodeExpiresAt, null);
  assert.ok((await ctx.svc.login({ username: "owner_test", password: "Added-password-1234!" }, "ip")).token);
});

test("Recovery invalidates access codes and code-issued sessions; near-expiry sessions cannot outlive the code", async () => {
  const ctx = setup(), access = await provision(ctx, "owner_test", Date.now() + 30000);
  const a = await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "ip");
  const claim = JSON.parse(Buffer.from(a.token.split(".")[0], "base64url"));
  assert.equal(claim.expires, access.credential.expiresAt);
  const b = await ctx.svc.recover({ username: "owner_test", password: "Recovered-password-1234!", recoveryCode: a.recoveryCode }, "ip");
  assert.equal(b.user.accessCodeExpiresAt, null);
  await assert.rejects(() => ctx.svc.session(a.token), e => e.status === 401);
  await assert.rejects(() => ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "ip"), e => e.status === 401);
});

test("Simultaneous rotations are atomic and keep only the winning credential", async () => {
  const ctx = setup(), access = await provision(ctx);
  const a = await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "ip");
  const args = { accountId: a.user.id, currentCode: access.code, mode: "access-create" };
  const results = await Promise.allSettled([ctx.svc.security(a.token, args), ctx.svc.security(a.token, args)]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(results.filter(x => x.status === "rejected" && x.reason.status === 409).length, 1);
  const winner = results.find(x => x.status === "fulfilled").value;
  assert.equal((await ctx.svc.session(winner.token)).id, a.user.id);
  assert.ok((await ctx.svc.loginCode({ username: "owner_test", accessCode: winner.accessCode }, "ip")).token);
});

test("HTTP auth uses Secure HttpOnly cookies, rejects foreign origins, and does not return session tokens", async () => {
  const ctx = setup(), access = await provision(ctx);
  const handler = createHandler(() => ctx.svc);
  async function request({ method = "POST", action = "loginCode", origin = "https://home.cemgocen.com", body = { username: "owner_test", accessCode: access.code }, cookie = "" } = {}) {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(value) { this.value = value; return this; } };
    await handler({ method, query: { action }, body, headers: { host: "home.cemgocen.com", origin, "content-type": "application/json", cookie, "x-vercel-forwarded-for": "test-ip" } }, res);
    return res;
  }
  assert.equal((await request({ origin: "https://foreign.example" })).statusCode, 403);
  assert.equal((await request({ method: "GET" })).statusCode, 404);
  const response = await request();
  assert.equal(response.statusCode, 200);
  assert.equal(response.value.token, undefined);
  assert.equal(response.value.accessCode, undefined);
  assert.match(response.headers["Set-Cookie"], /__Host-evim-session=.+; Path=\/; HttpOnly; Secure; SameSite=Strict/);
  assert.match(response.headers["Cache-Control"], /no-store/);
  const cookie = response.headers["Set-Cookie"].split(";")[0];
  assert.equal((await request({ method: "GET", action: "state", cookie })).statusCode, 200);
  const guest = await request({ method: "GET", action: "state" });
  assert.equal(guest.statusCode, 200);
  assert.deepEqual(guest.value, { user: null, state: null, revision: null });
  assert.equal((await request({ method: "GET", action: "state", cookie: "__Host-evim-session=forged.token" })).statusCode, 401);
  assert.equal((await request({ action: "provisionAccess" })).statusCode, 404);
});

test("Renewing the recovery key keeps a code-only account's access code", async () => {
  const ctx = setup(), access = await provision(ctx);
  const a = await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "ip");
  const r = await ctx.svc.security(a.token, { accountId: a.user.id, currentCode: access.code, mode: "recovery" });
  assert.ok(r.recoveryCode);
  assert.notEqual(r.user.accessCodeExpiresAt, null);
  assert.ok((await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "ip")).token);
});

test("Junk sign-ins from another address cannot lock the owner out", async () => {
  const ctx = setup(), access = await provision(ctx);
  for (let i = 0; i < 12; i++)
    await assert.rejects(() => ctx.svc.loginCode({ username: "owner_test", accessCode: "invalid" }, "attacker"), e => [401, 429].includes(e.status));
  assert.ok((await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "owner-phone")).token);
});

test("Logout with an already revoked session still clears the cookie", async () => {
  const ctx = setup(), access = await provision(ctx);
  const handler = createHandler(() => ctx.svc);
  const call = async (action, cookie, body = {}) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(value) { this.value = value; return this; } };
    await handler({ method: "POST", query: { action }, body, headers: { host: "home.cemgocen.com", origin: "https://home.cemgocen.com", "content-type": "application/json", cookie, "x-vercel-forwarded-for": "ip" } }, res);
    return res;
  };
  const login = await call("loginCode", "", { username: "owner_test", accessCode: access.code });
  const cookie = login.headers["Set-Cookie"].split(";")[0];
  const other = await ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "ip");
  await ctx.svc.security(other.token, { accountId: other.user.id, currentCode: access.code, mode: "sessions" });
  const out = await call("logout", cookie);
  assert.equal(out.statusCode, 200);
  assert.match(out.headers["Set-Cookie"], /Max-Age=0/);
});

test("Simultaneous sign-ins on two devices both succeed", async () => {
  const ctx = setup(), access = await provision(ctx);
  const [a, b] = await Promise.all([
    ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "laptop"),
    ctx.svc.loginCode({ username: "owner_test", accessCode: access.code }, "phone"),
  ]);
  assert.equal((await ctx.svc.session(a.token)).username, "owner_test");
  assert.equal((await ctx.svc.session(b.token)).username, "owner_test");
});
