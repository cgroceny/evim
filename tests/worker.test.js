import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { workerSource } from "../scripts/sw-source.mjs";
const setup = () => {
  const handlers = {},
    cached = [],
    context = {
      URL,
      self: {
        location: { origin: "https://evim.test" },
        addEventListener: (name, fn) => (handlers[name] = fn),
        clients: { claim: async () => {} },
        skipWaiting: () => {},
      },
      caches: {
        match: async (path) => {
          cached.push(path);
          return "cached-shell";
        },
      },
      fetch: async () => {
        throw new Error("Offline");
      },
    };
  vm.runInNewContext(
    workerSource(["/index.html", "/assets/app.js"], "test"),
    context,
  );
  const request = (url, method = "GET", mode = "navigate") => {
    let result;
    handlers.fetch({
      request: { url, method, mode },
      respondWith: (r) => {
        result = r;
      },
    });
    return result;
  };
  return { request, cached };
};
test("Offline fallback serves only the public shell and declared static assets", async () => {
  const { request, cached } = setup();
  assert.equal(await request("https://evim.test/"), "cached-shell");
  assert.deepEqual(cached, ["/index.html"]);
  assert.equal(
    await request("https://evim.test/assets/app.js", "GET", "cors"),
    "cached-shell",
  );
  assert.equal(
    request("https://evim.test/unlisted.json", "GET", "cors"),
    undefined,
  );
});
test("Service worker never intercepts API reads/writes, OAuth callbacks or another origin", () => {
  const { request, cached } = setup();
  for (const [url, method] of [
    ["https://evim.test/api/cloud?action=state", "GET"],
    ["https://evim.test/api/cloud", "PUT"],
    ["https://evim.test/api/cloud", "GET"],
    ["https://evim.test/?auth_callback=1&code=test", "GET"],
    ["https://ha.test/api/states", "GET"],
    ["https://evim.test/", "POST"],
  ])
    assert.equal(request(url, method), undefined);
  assert.deepEqual(cached, []);
});
