import assert from "node:assert/strict";
import { test } from "node:test";
import { EbayOAuthStateStore } from "../../src/ebay/oauth-state.ts";

test("validates a signed OAuth state", () => {
  const store = new EbayOAuthStateStore("secret");
  const state = store.create({
    userId: "user-1",
    sessionId: "session-1",
    now: new Date("2026-05-07T10:00:00.000Z"),
    ttlMs: 1000
  });

  const result = store.validate(state, {
    userId: "user-1",
    sessionId: "session-1",
    now: new Date("2026-05-07T10:00:00.500Z")
  });

  assert.equal(result.ok, true);
});

test("validates signed state without binding it to a request session", () => {
  const store = new EbayOAuthStateStore("secret");
  const state = store.create({
    userId: "user-1",
    sessionId: "session-1",
    now: new Date("2026-05-07T10:00:00.000Z"),
    ttlMs: 1000
  });

  const result = store.validateSignedState(state, {
    now: new Date("2026-05-07T10:00:00.500Z")
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.payload.userId, "user-1");
  assert.equal(result.ok && result.payload.sessionId, "session-1");
});

test("rejects expired state", () => {
  const store = new EbayOAuthStateStore("secret");
  const state = store.create({
    userId: "user-1",
    sessionId: "session-1",
    now: new Date("2026-05-07T10:00:00.000Z"),
    ttlMs: 1000
  });

  const result = store.validate(state, {
    userId: "user-1",
    sessionId: "session-1",
    now: new Date("2026-05-07T10:00:01.001Z")
  });

  assert.deepEqual(result, { ok: false, reason: "expired" });
});

test("rejects tampered state and wrong session context", () => {
  const store = new EbayOAuthStateStore("secret");
  const state = store.create({
    userId: "user-1",
    sessionId: "session-1"
  });

  const tampered = `${state.slice(0, -1)}x`;
  assert.deepEqual(
    store.validate(tampered, {
      userId: "user-1",
      sessionId: "session-1"
    }),
    { ok: false, reason: "invalid_signature" }
  );

  assert.deepEqual(
    store.validate(state, {
      userId: "user-1",
      sessionId: "session-2"
    }),
    { ok: false, reason: "wrong_session" }
  );
});
