import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { POST as signIn } from "../../app/api/auth/sign-in/route.ts";
import { GET as getEbayConfigStatus } from "../../app/api/auth/ebay/config-status/route.ts";
import { GET as startEbayAuth, HEAD as prewarmEbayAuthStart } from "../../app/api/auth/ebay/start/route.ts";
import { GET as handleEbayCallback } from "../../app/api/auth/ebay/callback/route.ts";
import { GET as getEbaySession } from "../../app/api/auth/ebay/session/route.ts";
import { POST as disconnectEbay } from "../../app/api/auth/ebay/disconnect/route.ts";
import { GET as getBuyingHistory } from "../../app/api/ebay/buying-history/route.ts";
import { readSessionToken } from "../../src/auth/session-cookie.ts";
import { sessionStore } from "../../src/auth/local-auth.ts";
import { getEbayOAuthStateStore } from "../../src/ebay/oauth-state.ts";

const ebayEnv = {
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_CLIENT_ID: "test-client-id",
  EBAY_CLIENT_SECRET: "test-client-secret",
  EBAY_REDIRECT_URI: "runame-value",
  EBAY_OAUTH_SCOPES: "scope-one",
  GOGGLER_AUTH_SECRET: "test-auth-secret-placeholder-32-chars"
};

test("eBay start route requires local auth", async () => {
  setEbayEnv();
  const response = await startEbayAuth(new NextRequest("http://localhost:3000/api/auth/ebay/start"));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "local_auth_required");
});

test("eBay config status route reports missing fields without auth", async () => {
  clearEbayEnv();
  const response = await getEbayConfigStatus();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.config.ready, false);
  assert.ok(body.config.missing.includes("EBAY_CLIENT_ID"));
  assert.equal(JSON.stringify(body).includes("client-secret"), false);
});

test("eBay start route reports config errors for signed-in users", async () => {
  clearEbayEnv();
  const cookie = await signInCookie();
  const response = await startEbayAuth(
    new NextRequest("http://localhost:3000/api/auth/ebay/start", {
      headers: { cookie }
    })
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error, "ebay_config_error");
});

test("eBay start route redirects signed-in users to eBay consent", async () => {
  setEbayEnv();
  const cookie = await signInCookie();
  const response = await startEbayAuth(
    new NextRequest("http://localhost:3000/api/auth/ebay/start", {
      headers: { cookie }
    })
  );

  assert.equal(response.status, 307);
  const location = response.headers.get("location");
  assert.ok(location);

  const url = new URL(location);
  assert.equal(url.origin + url.pathname, "https://auth.sandbox.ebay.com/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "test-client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "runame-value");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "scope-one");
  assert.ok(url.searchParams.get("state"));
});

test("eBay start prewarm validates auth and config without redirecting", async () => {
  setEbayEnv();
  const cookie = await signInCookie();
  const sessionBefore = currentSessionFromCookie(cookie);
  const response = await prewarmEbayAuthStart(
    new NextRequest("http://localhost:3000/api/auth/ebay/start", {
      headers: { cookie },
      method: "HEAD"
    })
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("location"), null);

  const sessionAfter = currentSessionFromCookie(cookie);
  assert.equal(sessionAfter.session.id, sessionBefore.session.id);
});

test("eBay start prewarm requires local auth", async () => {
  setEbayEnv();
  const response = await prewarmEbayAuthStart(
    new NextRequest("http://localhost:3000/api/auth/ebay/start", {
      method: "HEAD"
    })
  );

  assert.equal(response.status, 401);
});

test("eBay start prewarm reports config errors generically", async () => {
  clearEbayEnv();
  const cookie = await signInCookie();
  const response = await prewarmEbayAuthStart(
    new NextRequest("http://localhost:3000/api/auth/ebay/start", {
      headers: { cookie },
      method: "HEAD"
    })
  );

  assert.equal(response.status, 503);
});

test("eBay session route requires local auth", async () => {
  const response = await getEbaySession(new NextRequest("http://localhost:3000/api/auth/ebay/session"));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "local_auth_required");
});

test("eBay session route returns status without token values", async () => {
  const cookie = await signInCookie();
  const response = await getEbaySession(
    new NextRequest("http://localhost:3000/api/auth/ebay/session", {
      headers: { cookie }
    })
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.connection.connected, false);
  assert.equal(body.connection.status, "reauth_required");
  assert.equal(JSON.stringify(body).includes("access_token"), false);
  assert.equal(JSON.stringify(body).includes("refresh_token"), false);
});

test("eBay callback rejects invalid state", async () => {
  setEbayEnv();
  const cookie = await signInCookie();
  const response = await handleEbayCallback(
    new NextRequest("http://localhost:3000/api/auth/ebay/callback?code=auth-code&state=bad-state", {
      headers: { cookie }
    })
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "invalid_oauth_state");
});

test("eBay callback stores token values only in server-side session state", async () => {
  setEbayEnv();
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  const { payload, state } = getEbayOAuthStateStore().createWithPayload({
    userId: session.user.id,
    sessionId: session.session.id
  });
  sessionStore.addPendingEbayOAuthState(session.session.id, payload.id, new Date(payload.expiresAt));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    jsonResponse({
      access_token: "access-token",
      expires_in: 7200,
      refresh_token: "refresh-token",
      refresh_token_expires_in: 47304000,
      token_type: "User Access Token"
    });

  try {
    const callback = await handleEbayCallback(
      new NextRequest(`http://localhost:3000/api/auth/ebay/callback?code=auth-code&state=${encodeURIComponent(state)}`, {
        headers: { cookie }
      })
    );
    assert.equal(callback.status, 307);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const statusResponse = await getEbaySession(
    new NextRequest("http://localhost:3000/api/auth/ebay/session", {
      headers: { cookie }
    })
  );
  const body = await statusResponse.json();

  assert.equal(body.connection.connected, true);
  assert.equal(body.connection.status, "connected_this_session");
  assert.equal(JSON.stringify(body).includes("access-token"), false);
  assert.equal(JSON.stringify(body).includes("refresh-token"), false);
});

test("eBay callback can complete from signed pending state when the browser omits the session cookie", async () => {
  setEbayEnv();
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  const { payload, state } = getEbayOAuthStateStore().createWithPayload({
    userId: session.user.id,
    sessionId: session.session.id
  });
  sessionStore.addPendingEbayOAuthState(session.session.id, payload.id, new Date(payload.expiresAt));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    jsonResponse({
      access_token: "access-token-without-cookie",
      expires_in: 7200,
      token_type: "User Access Token"
    });

  try {
    const callback = await handleEbayCallback(
      new NextRequest(`http://localhost:3000/api/auth/ebay/callback?code=auth-code&state=${encodeURIComponent(state)}`)
    );
    assert.equal(callback.status, 307);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const statusResponse = await getEbaySession(
    new NextRequest("http://localhost:3000/api/auth/ebay/session", {
      headers: { cookie }
    })
  );
  const body = await statusResponse.json();

  assert.equal(body.connection.connected, true);
  assert.equal(JSON.stringify(body).includes("access-token-without-cookie"), false);
});

test("eBay callback rejects replayed cookie-less signed state before exchanging a token", async () => {
  setEbayEnv();
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  const { payload, state } = getEbayOAuthStateStore().createWithPayload({
    userId: session.user.id,
    sessionId: session.session.id
  });
  sessionStore.addPendingEbayOAuthState(session.session.id, payload.id, new Date(payload.expiresAt));

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return jsonResponse({
      access_token: "access-token-for-replay-test",
      expires_in: 7200,
      token_type: "User Access Token"
    });
  };

  try {
    const first = await handleEbayCallback(
      new NextRequest(`http://localhost:3000/api/auth/ebay/callback?code=auth-code&state=${encodeURIComponent(state)}`)
    );
    assert.equal(first.status, 307);

    const second = await handleEbayCallback(
      new NextRequest(`http://localhost:3000/api/auth/ebay/callback?code=auth-code&state=${encodeURIComponent(state)}`)
    );
    const body = await second.json();
    assert.equal(second.status, 400);
    assert.equal(body.error, "invalid_oauth_state");
    assert.equal(body.reason, "replayed");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 1);
});

test("eBay disconnect route requires local auth", async () => {
  const response = await disconnectEbay(
    new NextRequest("http://localhost:3000/api/auth/ebay/disconnect", {
      headers: { origin: "http://localhost:3000" }
    })
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "local_auth_required");
});

test("eBay buying history route requires local auth", async () => {
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "fixture";
  const response = await getBuyingHistory(new NextRequest("http://localhost:3000/api/ebay/buying-history"));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "local_auth_required");
});

test("eBay buying history route requires current-session eBay auth", async () => {
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "fixture";
  const cookie = await signInCookie();
  const response = await getBuyingHistory(
    new NextRequest("http://localhost:3000/api/ebay/buying-history", {
      headers: { cookie }
    })
  );
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error, "ebay_reauth_required");
});

test("eBay buying history route serves fixture history after eBay connection", async () => {
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "fixture";
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  authorizeEbaySession(session.session.id);

  const response = await getBuyingHistory(
    new NextRequest("http://localhost:3000/api/ebay/buying-history", {
      headers: { cookie }
    })
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.source, "fixture");
  assert.deepEqual(body.counts, {
    lost: 10,
    won: 7,
    eventuallyWon: 4,
    neverWon: 6,
    watchlist: 6,
    watchlistRelistings: 2,
    needsAction: 2,
    relistings: 4
  });
  assert.equal(body.lostItems.length, 10);
  assert.equal(body.wonItems.length, 7);
  assert.equal(body.watchlistItems.length, 6);
  assert.equal(body.homeFeed.rows.slice(0, 6).every((row) => row.section === "watchlist"), true);
  assert.equal(JSON.stringify(body).includes("access-token"), false);
});

test("eBay buying history route rejects fixture history in production", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "fixture";
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  authorizeEbaySession(session.session.id);

  try {
    const response = await getBuyingHistory(
      new NextRequest("http://localhost:3000/api/ebay/buying-history", {
        headers: { cookie }
      })
    );
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.error, "fixture_not_allowed_in_production");
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test("eBay buying history route reports live history as not implemented", async () => {
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "live";
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  authorizeEbaySession(session.session.id);

  const response = await getBuyingHistory(
    new NextRequest("http://localhost:3000/api/ebay/buying-history", {
      headers: { cookie }
    })
  );
  const body = await response.json();

  assert.equal(response.status, 501);
  assert.equal(body.error, "live_history_not_implemented");
});

async function signInCookie() {
  const response = await signIn(
    new NextRequest("http://localhost:3000/api/auth/sign-in", {
      headers: { origin: "http://localhost:3000" }
    })
  );
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  return cookie.split(";")[0];
}

function currentSessionFromCookie(cookie) {
  const token = readSessionToken(cookie);
  const session = sessionStore.lookupSession(token);
  assert.ok(session);
  return session;
}

function authorizeEbaySession(sessionId) {
  sessionStore.setEbayAuthorization(sessionId, {
    accessToken: "access-token",
    tokenType: "User Access Token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scopes: ["scope-one"],
    authorizedAt: new Date()
  });
}

function setEbayEnv() {
  for (const [key, value] of Object.entries(ebayEnv)) {
    process.env[key] = value;
  }
}

function clearEbayEnv() {
  for (const key of Object.keys(ebayEnv)) {
    delete process.env[key];
  }
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" }
  });
}
