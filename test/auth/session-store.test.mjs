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

test("stores eBay authorization only against an active session", () => {
  const store = new InMemorySessionStore([user]);
  const { session } = store.createSession(user.id);
  const authorization = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenType: "User Access Token",
    authorizedAt: new Date("2026-05-07T10:00:00.000Z"),
    expiresAt: new Date("2026-05-07T12:00:00.000Z"),
    scopes: ["scope-one"]
  };

  store.setEbayAuthorization(session.id, authorization);

  assert.equal(
    store.getEbayAuthorization(session.id, {
      now: new Date("2026-05-07T10:30:00.000Z")
    }),
    authorization
  );
});

test("does not expose eBay token values through connection status", () => {
  const store = new InMemorySessionStore([user]);
  const { session } = store.createSession(user.id);
  store.setEbayAuthorization(session.id, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenType: "User Access Token",
    authorizedAt: new Date("2026-05-07T10:00:00.000Z"),
    expiresAt: new Date("2026-05-07T12:00:00.000Z"),
    scopes: ["scope-one"]
  });

  const status = store.getEbayConnectionStatus(session.id, {
    now: new Date("2026-05-07T10:30:00.000Z")
  });

  assert.equal(status.connected, true);
  assert.equal(status.status, "connected_this_session");
  assert.equal(JSON.stringify(status).includes("access-token"), false);
  assert.equal(JSON.stringify(status).includes("refresh-token"), false);
});

test("clears eBay authorization when the local session expires", () => {
  const store = new InMemorySessionStore([user]);
  const { token, session } = store.createSession(user.id, {
    now: new Date("2026-05-01T10:00:00.000Z"),
    ttlMs: 1000
  });
  store.setEbayAuthorization(session.id, {
    accessToken: "access-token",
    tokenType: "User Access Token",
    authorizedAt: new Date("2026-05-01T10:00:00.000Z"),
    expiresAt: new Date("2026-05-01T12:00:00.000Z"),
    scopes: ["scope-one"]
  });

  store.lookupSession(token, {
    now: new Date("2026-05-01T10:00:01.001Z")
  });

  assert.equal(store.getEbayAuthorization(session.id), undefined);
});

test("expires eBay authorization independently from the local session", () => {
  const store = new InMemorySessionStore([user]);
  const { session } = store.createSession(user.id, {
    now: new Date("2026-05-01T10:00:00.000Z"),
    ttlMs: 1000 * 60 * 60
  });
  store.setEbayAuthorization(session.id, {
    accessToken: "access-token",
    tokenType: "User Access Token",
    authorizedAt: new Date("2026-05-01T10:00:00.000Z"),
    expiresAt: new Date("2026-05-01T10:00:01.000Z"),
    scopes: ["scope-one"]
  });

  const authorization = store.getEbayAuthorization(session.id, {
    now: new Date("2026-05-01T10:00:01.001Z")
  });

  assert.equal(authorization, undefined);
  assert.equal(store.getEbayConnectionStatus(session.id).status, "reauth_required");
});

test("consumes pending eBay OAuth states once", () => {
  const store = new InMemorySessionStore([user]);
  const { session } = store.createSession(user.id);

  store.addPendingEbayOAuthState(session.id, "state-1", new Date("2026-05-07T10:01:00.000Z"));

  assert.equal(
    store.consumePendingEbayOAuthState(session.id, "state-1", {
      now: new Date("2026-05-07T10:00:30.000Z")
    }),
    true
  );
  assert.equal(
    store.consumePendingEbayOAuthState(session.id, "state-1", {
      now: new Date("2026-05-07T10:00:40.000Z")
    }),
    false
  );
});

test("rejects expired pending eBay OAuth states", () => {
  const store = new InMemorySessionStore([user]);
  const { session } = store.createSession(user.id);

  store.addPendingEbayOAuthState(session.id, "state-1", new Date("2026-05-07T10:01:00.000Z"));

  assert.equal(
    store.consumePendingEbayOAuthState(session.id, "state-1", {
      now: new Date("2026-05-07T10:01:00.001Z")
    }),
    false
  );
});

test("rejects unknown users", () => {
  const store = new InMemorySessionStore();

  assert.throws(() => store.createSession(user.id), /unknown user/);
});
