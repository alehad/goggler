import assert from "node:assert/strict";
import { test } from "node:test";
import {
  InMemorySessionStore,
  hashSessionToken
} from "../../src/auth/session-store.ts";

const user = {
  id: "user-1",
  displayName: "Test User"
};

test("creates an opaque session token and stores only its hash", () => {
  const store = new InMemorySessionStore([user]);
  const { token, session } = store.createSession(user.id, {
    now: new Date("2026-05-01T10:00:00.000Z"),
    ttlMs: 1000
  });

  assert.notEqual(token, session.tokenHash);
  assert.equal(session.tokenHash, hashSessionToken(token));
  assert.equal(store.sessionCount(), 1);
});

test("looks up a valid session by token", () => {
  const store = new InMemorySessionStore([user]);
  const { token } = store.createSession(user.id, {
    now: new Date("2026-05-01T10:00:00.000Z"),
    ttlMs: 1000
  });

  const result = store.lookupSession(token, {
    now: new Date("2026-05-01T10:00:00.500Z")
  });

  assert.equal(result?.user.id, user.id);
});

test("expires sessions after their ttl", () => {
  const store = new InMemorySessionStore([user]);
  const { token } = store.createSession(user.id, {
    now: new Date("2026-05-01T10:00:00.000Z"),
    ttlMs: 1000
  });

  const result = store.lookupSession(token, {
    now: new Date("2026-05-01T10:00:01.001Z")
  });

  assert.equal(result, undefined);
  assert.equal(store.sessionCount(), 0);
});

test("expires a session on sign out", () => {
  const store = new InMemorySessionStore([user]);
  const { token } = store.createSession(user.id);

  assert.equal(store.expireSession(token), true);
  assert.equal(store.lookupSession(token), undefined);
});

test("rejects unknown users", () => {
  const store = new InMemorySessionStore();

  assert.throws(() => store.createSession(user.id), /unknown user/);
});
