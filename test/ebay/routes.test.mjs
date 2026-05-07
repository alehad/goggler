import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { POST as signIn } from "../../app/api/auth/sign-in/route.ts";
import { GET as startEbayAuth } from "../../app/api/auth/ebay/start/route.ts";
import { GET as handleEbayCallback } from "../../app/api/auth/ebay/callback/route.ts";
import { GET as getEbaySession } from "../../app/api/auth/ebay/session/route.ts";
import { POST as disconnectEbay } from "../../app/api/auth/ebay/disconnect/route.ts";
import { readSessionToken } from "../../src/auth/session-cookie.ts";
import { sessionStore } from "../../src/auth/local-auth.ts";
import { getEbayOAuthStateStore } from "../../src/ebay/oauth-state.ts";

const ebayEnv = {
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_CLIENT_ID: "client-id",
  EBAY_CLIENT_SECRET: "client-secret",
  EBAY_REDIRECT_URI: "runame-value",
  EBAY_OAUTH_SCOPES: "scope-one",
  GOGGLER_AUTH_SECRET: "test-secret-with-at-least-32-characters"
};

test("eBay start route requires local auth", async () => {
  setEbayEnv();
  const response = await startEbayAuth(new NextRequest("http://localhost:3000/api/auth/ebay/start"));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "local_auth_required");
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
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "runame-value");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "scope-one");
  assert.ok(url.searchParams.get("state"));
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
    Response.json({
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

function setEbayEnv() {
  for (const [key, value] of Object.entries(ebayEnv)) {
    process.env[key] = value;
  }
}
