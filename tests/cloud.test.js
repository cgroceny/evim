import test from "node:test";
import assert from "node:assert/strict";
import { cloudService, HttpError } from "../server/cloud.js";
import { initialState } from "../src/model.js";
function setup() {
  const records = new Map();
  let rev = 0;
  const repo = {
    async read(k) {
      return records.has(k) ? structuredClone(records.get(k)) : null;
    },
    async write(k, v, etag) {
      const old = records.get(k);
      if ((old?.etag ?? null) !== etag) throw new HttpError(409, "conflict");
      const row = { value: structuredClone(v), etag: "version-" + ++rev };
      records.set(k, row);
      return { etag: row.etag };
    },
  };
  return cloudService(repo, "test-only-secret-never-used-in-production-123456");
}
test("Password changes authenticate the old password, rotate recovery and revoke all old sessions", async () => {
  const svc = setup(),
    a = await svc.register(
      { username: "security_a", password: "Original-password-1234" },
      "ip-security",
    );
  const b = await svc.login(
    { username: "security_a", password: "Original-password-1234" },
    "ip-security",
  );
  const args = {
    accountId: a.user.id,
    mode: "password",
    currentPassword: "Incorrect-password",
    password: "Replacement-password-5678",
  };
  await assert.rejects(
    () => svc.security(a.token, args),
    (e) => e.status === 400,
  );
  const updated = await svc.security(a.token, {
    ...args,
    currentPassword: "Original-password-1234",
  });
  assert.ok(updated.recoveryCode);
  assert.notEqual(updated.recoveryCode, a.recoveryCode);
  await assert.rejects(
    () => svc.session(a.token),
    (e) => e.status === 401,
  );
  await assert.rejects(
    () => svc.session(b.token),
    (e) => e.status === 401,
  );
  assert.equal((await svc.session(updated.token)).username, "security_a");
  await assert.rejects(
    () =>
      svc.login(
        { username: "security_a", password: "Original-password-1234" },
        "ip-security",
      ),
    (e) => e.status === 401,
  );
  assert.ok(
    (
      await svc.login(
        { username: "security_a", password: "Replacement-password-5678" },
        "ip-security",
      )
    ).token,
  );
});
test("Session security cannot target another account and keeps only a fresh current session", async () => {
  const svc = setup(),
    a = await svc.register(
      { username: "security_b", password: "Original-password-1234" },
      "ip-security-b",
    );
  await assert.rejects(
    () => svc.security(a.token, { accountId: "foreign", mode: "sessions" }),
    (e) => e.status === 403,
  );
  const next = await svc.security(a.token, {
    accountId: a.user.id,
    mode: "sessions",
  });
  assert.equal(next.recoveryCode, undefined);
  await assert.rejects(
    () => svc.session(a.token),
    (e) => e.status === 401,
  );
  assert.equal((await svc.session(next.token)).id, a.user.id);
});
test("Old application versions cannot overwrite energy, automation or climate roles", async () => {
  const svc = setup(),
    a = await svc.register(
      { username: "version_three", password: "Original-password-1234" },
      "ip-version",
    );
  const s = initialState();
  s.energy.tariff = 4;
  const saved = await svc.save(a.token, {
    accountId: a.user.id,
    state: s,
    revision: null,
  });
  for (const version of [2, 3])
    await assert.rejects(
      () =>
        svc.save(a.token, {
          accountId: a.user.id,
          state: { ...s, version },
          revision: saved.revision,
        }),
      (e) => e.status === 426,
    );
  assert.equal((await svc.load(a.token)).state.energy.tariff, 4);
});
test("Accounts isolate data, reject unauthenticated access and stale device writes", async () => {
  const svc = setup();
  await assert.rejects(
    () => svc.load(""),
    (e) => e.status === 401,
  );
  const a = await svc.register(
    { username: "tester_a", password: "Testing-only-password-A!" },
    "ip-a",
  );
  const b = await svc.register(
    { username: "tester_b", password: "Testing-only-password-B!" },
    "ip-b",
  );
  let state = initialState();
  state.home.name = "Private A";
  const saved = await svc.save(a.token, {
    accountId: a.user.id,
    state,
    revision: null,
  });
  assert.equal((await svc.load(b.token)).state, null);
  await assert.rejects(
    () => svc.save(b.token, { accountId: a.user.id, state, revision: null }),
    (e) => e.status === 403,
  );
  state.home.name = "Stale";
  await assert.rejects(
    () => svc.save(a.token, { accountId: a.user.id, state, revision: null }),
    (e) => e.status === 409,
  );
  assert.equal((await svc.load(a.token)).state.home.name, "Private A");
  assert.equal((await svc.load(a.token)).revision, saved.revision);
});
test("Authentication rejects wrong passwords and tokens; logout revokes only that session", async () => {
  const svc = setup();
  const a = await svc.register(
    { username: "tester_c", password: "Testing-only-password-C!" },
    "ip-c",
  );
  await assert.rejects(
    () =>
      svc.login(
        { username: "tester_c", password: "Wrong-password-1234" },
        "ip-c",
      ),
    (e) => e.status === 401,
  );
  const b = await svc.login(
    { username: "tester_c", password: "Testing-only-password-C!" },
    "ip-c",
  );
  await svc.logout(a.token);
  await assert.rejects(
    () => svc.session(a.token),
    (e) => e.status === 401,
  );
  assert.equal((await svc.session(b.token)).username, "tester_c");
  await assert.rejects(
    () => svc.session(b.token + "x"),
    (e) => e.status === 401,
  );
});
test("Recovery rotates recovery key and revokes existing sessions", async () => {
  const svc = setup();
  const a = await svc.register(
    { username: "tester_d", password: "Testing-only-password-D!" },
    "ip-d",
  );
  const b = await svc.recover(
    {
      username: "tester_d",
      password: "New-testing-password-D!",
      recoveryCode: a.recoveryCode,
    },
    "ip-d",
  );
  assert.notEqual(a.recoveryCode, b.recoveryCode);
  await assert.rejects(
    () => svc.session(a.token),
    (e) => e.status === 401,
  );
  await assert.rejects(
    () =>
      svc.recover(
        {
          username: "tester_d",
          password: "Another-password-D!",
          recoveryCode: a.recoveryCode,
        },
        "ip-d",
      ),
    (e) => e.status === 401,
  );
  assert.equal((await svc.session(b.token)).username, "tester_d");
});
test("Optimistic concurrency permits only one writer for the same revision", async () => {
  const svc = setup();
  const a = await svc.register(
    { username: "tester_e", password: "Testing-only-password-E!" },
    "ip-e",
  );
  const s = initialState();
  const first = await svc.save(a.token, {
    accountId: a.user.id,
    state: s,
    revision: null,
  });
  const results = await Promise.allSettled([
    svc.save(a.token, {
      accountId: a.user.id,
      state: { ...s, home: { ...s.home, name: "Writer one" } },
      revision: first.revision,
    }),
    svc.save(a.token, {
      accountId: a.user.id,
      state: { ...s, home: { ...s.home, name: "Writer two" } },
      revision: first.revision,
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.filter((r) => r.status === "rejected" && r.reason.status === 409)
      .length,
    1,
  );
});
