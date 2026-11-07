import test from "node:test";
import assert from "node:assert/strict";
import { pendingUpdate } from "../src/lifecycle.js";

const waiting = { state: "installed" };

test("first install is not offered as an update", () => {
  assert.equal(pendingUpdate({ waiting }, null), null);
});

test("waiting worker behind an active controller is an update", () => {
  assert.equal(pendingUpdate({ waiting }, { state: "activated" }), waiting);
});

test("no waiting worker means no update", () => {
  assert.equal(pendingUpdate({ waiting: null }, { state: "activated" }), null);
  assert.equal(pendingUpdate(undefined, { state: "activated" }), null);
});
