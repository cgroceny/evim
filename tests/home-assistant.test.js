import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../api/cloud.js";
import { HttpError } from "../server/cloud.js";

const config = {
  HA_BASE_URL: "https://home-assistant.example",
  HA_ACCESS_TOKEN: "fixture-ha-credential",
  HA_OWNER_USERNAME: "owner",
  HA_CF_ACCESS_CLIENT_ID: "fixture-service-id",
  HA_CF_ACCESS_CLIENT_SECRET: "fixture-service-credential",
};

async function readStates(options, session, query = {}) {
  const svc = {
    async session(token) {
      if (!token) throw new HttpError(401, "Giriş gerekli.");
      return { username: token };
    },
  };
  const res = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const handler = createHandler(() => svc, options);
  await handler({
    method: "GET",
    query: { action: "ha-states", ...query },
    headers: { cookie: session ? "__Host-evim-session=" + session : "" },
  }, res);
  return res;
}

test("Guests and other Evim accounts never contact the home server", async () => {
  let requests = 0;
  const options = { env: config, fetchImpl: async () => { requests += 1; } };
  const guest = await readStates(options);
  const other = await readStates(options, "other");
  assert.equal(guest.statusCode, 401);
  assert.equal(other.statusCode, 403);
  assert.equal(requests, 0);
});

test("The owner gets selected measurements through one fixed authenticated GET", async () => {
  const res = await readStates({
    env: { ...config, HA_ENTITY_IDS: "sensor.power, switch.socket, light.private" },
    fetchImpl: async (url, request) => {
      assert.equal(url.href, "https://home-assistant.example/api/states");
      assert.equal(request.method, "GET");
      assert.equal(request.redirect, "error");
      assert.equal(request.headers.Authorization, "Bearer " + config.HA_ACCESS_TOKEN);
      assert.equal(request.headers["CF-Access-Client-Id"], config.HA_CF_ACCESS_CLIENT_ID);
      assert.equal(request.headers["CF-Access-Client-Secret"], config.HA_CF_ACCESS_CLIENT_SECRET);
      return Response.json([
        {
          entity_id: "sensor.power",
          state: "0",
          attributes: { friendly_name: "Priz gücü", unit_of_measurement: "W", private: "omit" },
          context: { user_id: "omit" },
        },
        { entity_id: "switch.socket", state: "unavailable" },
        { entity_id: "sensor.excluded", state: "21" },
        { entity_id: "light.private", state: "on" },
      ]);
    },
  }, "owner", { url: "https://other.example", path: "/api/services" });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(res.body.status, "connected");
  assert.deepEqual(res.body.readings, [
    { id: "sensor.power", domain: "sensor", name: "Priz gücü", value: "0", unit: "W" },
    { id: "switch.socket", domain: "switch", name: "switch.socket", value: "unavailable", unit: "" },
  ]);
});

test("Incomplete, non-HTTPS and rejected credentials never leak upstream details", async () => {
  let requests = 0;
  const fetchImpl = async () => {
    requests += 1;
    return Response.json({ private: "upstream response" }, { status: 401 });
  };
  const pending = await readStates({ env: { HA_OWNER_USERNAME: "owner" }, fetchImpl }, "owner");
  assert.deepEqual(pending.body, { status: "unconfigured", readings: [] });
  const insecure = await readStates({
    env: { ...config, HA_BASE_URL: "http://home-assistant.example" }, fetchImpl,
  }, "owner");
  assert.equal(insecure.statusCode, 503);
  assert.equal(requests, 0);

  const rejected = await readStates({ env: config, fetchImpl }, "owner");
  assert.equal(rejected.statusCode, 502);
  assert.equal(requests, 1);
  assert.deepEqual(rejected.body, { error: "Home Assistant erişim jetonunu kabul etmedi." });
});
