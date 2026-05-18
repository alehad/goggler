import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { POST as signIn } from "../../app/api/auth/sign-in/route.ts";
import { GET as getEbayConfigStatus } from "../../app/api/auth/ebay/config-status/route.ts";
import { GET as startEbayAuth, HEAD as prewarmEbayAuthStart } from "../../app/api/auth/ebay/start/route.ts";
import { GET as handleEbayCallback } from "../../app/api/auth/ebay/callback/route.ts";
import { GET as getEbaySession } from "../../app/api/auth/ebay/session/route.ts";
import { POST as disconnectEbay } from "../../app/api/auth/ebay/disconnect/route.ts";
import { GET as getBuyingHistory, POST as postBuyingHistory } from "../../app/api/ebay/buying-history/route.ts";
import { readSessionToken } from "../../src/auth/session-cookie.ts";
import { sessionStore } from "../../src/auth/local-auth.ts";
import { getEbayOAuthStateStore } from "../../src/ebay/oauth-state.ts";

const ebayEnv = {
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_SANDBOX_CLIENT_ID: "test-client-id",
  EBAY_SANDBOX_CLIENT_SECRET: "test-client-secret",
  EBAY_SANDBOX_REDIRECT_URI: "runame-value",
  EBAY_SANDBOX_OAUTH_SCOPES: "scope-one",
  GOGGLER_AUTH_SECRET: "test-auth-secret-placeholder-32-chars"
};

test("eBay start route creates the internal local session when missing", async () => {
  setEbayEnv();
  const response = await startEbayAuth(new NextRequest("http://localhost:3000/api/auth/ebay/start"));

  assert.equal(response.status, 307);
  assert.ok(response.headers.get("set-cookie"));
  assert.ok(response.headers.get("location")?.startsWith("https://auth.sandbox.ebay.com/oauth2/authorize"));
});

test("eBay config status route reports missing fields without auth", async () => {
  clearEbayEnv();
  const response = await getEbayConfigStatus();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.config.ready, false);
  assert.ok(body.config.missing.includes("EBAY_SANDBOX_CLIENT_ID"));
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

test("eBay start route redirects production users to production eBay consent", async () => {
  setEbayEnv({
    EBAY_ENVIRONMENT: "production",
    EBAY_PRODUCTION_CLIENT_ID: "production-client-id",
    EBAY_PRODUCTION_CLIENT_SECRET: "production-client-secret",
    EBAY_PRODUCTION_REDIRECT_URI: "production-runame",
    EBAY_PRODUCTION_OAUTH_SCOPES: "production-scope"
  });
  const cookie = await signInCookie();
  const response = await startEbayAuth(
    new NextRequest("https://example.ngrok-free.dev/api/auth/ebay/start", {
      headers: { cookie }
    })
  );

  assert.equal(response.status, 307);
  const location = response.headers.get("location");
  assert.ok(location);

  const url = new URL(location);
  assert.equal(url.origin + url.pathname, "https://auth.ebay.com/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "production-client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "production-runame");
  assert.equal(url.searchParams.get("scope"), "production-scope");
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

test("eBay start prewarm creates the internal local session when missing", async () => {
  setEbayEnv();
  const response = await prewarmEbayAuthStart(
    new NextRequest("http://localhost:3000/api/auth/ebay/start", {
      method: "HEAD"
    })
  );

  assert.equal(response.status, 204);
  assert.ok(response.headers.get("set-cookie"));
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

test("eBay session route creates the internal local session when missing", async () => {
  const response = await getEbaySession(
    new NextRequest("http://localhost:3000/api/auth/ebay/session", {
      headers: {
        "x-forwarded-host": "example.ngrok-free.dev",
        "x-forwarded-proto": "https"
      }
    })
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.connection.connected, false);
  assert.equal(body.connection.status, "reauth_required");
  assert.ok(response.headers.get("set-cookie"));
  assert.match(response.headers.get("set-cookie") ?? "", /;\s*Secure/);
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

test("eBay callback stores best-effort public eBay identity without exposing token values", async () => {
  setEbayEnv({
    EBAY_SANDBOX_OAUTH_SCOPES: "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly"
  });
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  const { payload, state } = getEbayOAuthStateStore().createWithPayload({
    userId: session.user.id,
    sessionId: session.session.id
  });
  sessionStore.addPendingEbayOAuthState(session.session.id, payload.id, new Date(payload.expiresAt));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/commerce/identity/v1/user/")) {
      return jsonResponse({
        userId: "immutable-ebay-user-id",
        username: "ebay_saja"
      });
    }

    return jsonResponse({
      access_token: "identity-access-token",
      expires_in: 7200,
      token_type: "User Access Token"
    });
  };

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

  assert.equal(body.connection.identity.userId, "immutable-ebay-user-id");
  assert.equal(body.connection.identity.displayName, "ebay_saja");
  assert.equal(JSON.stringify(body).includes("identity-access-token"), false);
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

test("eBay buying history route creates internal local auth and requires eBay auth", async () => {
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "fixture";
  const response = await getBuyingHistory(new NextRequest("http://localhost:3000/api/ebay/buying-history"));
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error, "ebay_reauth_required");
  assert.ok(response.headers.get("set-cookie"));
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

test("eBay buying history route rejects matching preference updates from invalid origins", async () => {
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "fixture";
  const response = await postBuyingHistory(
    new NextRequest("http://localhost:3000/api/ebay/buying-history", {
      body: JSON.stringify({ exactTitleMatch: false, criteriaText: String.raw`TBM\s*\d{1,4}` }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    })
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, "invalid_origin");
});

test("eBay buying history route accepts matching preferences from same origin", async () => {
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "fixture";
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  authorizeEbaySession(session.session.id);

  const response = await postBuyingHistory(
    new NextRequest("http://localhost:3000/api/ebay/buying-history", {
      body: JSON.stringify({
        exactTitleMatch: false,
        criteriaText: String.raw`TBM\s*\d{1,4}; PAP\s*\d{1,4}`
      }),
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin: "http://localhost:3000"
      },
      method: "POST"
    })
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.source, "fixture");
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

test("eBay buying history route serves mocked live history after eBay connection", async () => {
  setEbayEnv();
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "live";
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  authorizeEbaySession(session.session.id);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const list = String(init.body).match(/<(WatchList|LostList|WonList)>/)?.[1];
    return new Response(liveResponseXml(list), {
      headers: { "Content-Type": "text/xml" }
    });
  };

  try {
    const response = await getBuyingHistory(
      new NextRequest("http://localhost:3000/api/ebay/buying-history", {
        headers: { cookie }
      })
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, "live");
    assert.equal(body.counts.watchlist, 1);
    assert.equal(body.homeFeed.rows[0].section, "watchlist");
    assert.equal(JSON.stringify(body).includes("access-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("eBay buying history route hides upstream live eBay failure details", async () => {
  setEbayEnv();
  process.env.GOGGLER_EBAY_HISTORY_SOURCE = "live";
  const cookie = await signInCookie();
  const session = currentSessionFromCookie(cookie);
  authorizeEbaySession(session.session.id);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<GetMyeBayBuyingResponse><Ack>Failure</Ack></GetMyeBayBuyingResponse>", { status: 200 });

  try {
    const response = await getBuyingHistory(
      new NextRequest("http://localhost:3000/api/ebay/buying-history", {
        headers: { cookie }
      })
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 502);
    assert.deepEqual(body, { error: "live_history_error" });
    assert.equal(serialized.includes("Failure"), false);
    assert.equal(serialized.includes("access-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

function setEbayEnv(overrides = {}) {
  for (const [key, value] of Object.entries(ebayEnv)) {
    process.env[key] = value;
  }
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

function clearEbayEnv() {
  for (const key of [
    ...Object.keys(ebayEnv),
    "EBAY_PRODUCTION_CLIENT_ID",
    "EBAY_PRODUCTION_CLIENT_SECRET",
    "EBAY_PRODUCTION_REDIRECT_URI",
    "EBAY_PRODUCTION_OAUTH_SCOPES"
  ]) {
    delete process.env[key];
  }
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" }
  });
}

function liveResponseXml(listName) {
  const title = listName === "WatchList" ? "Quad 33 preamp and 303 power amp pair" : `${listName} item`;
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <${listName}>
    <PaginationResult>
      <TotalNumberOfPages>1</TotalNumberOfPages>
      <TotalNumberOfEntries>1</TotalNumberOfEntries>
    </PaginationResult>
    <PageNumber>1</PageNumber>
    <ItemArray>
      <Item>
        <ItemID>${listName}-001</ItemID>
        <Title>${title}</Title>
        ${listName === "WatchList" ? "<ListingDetails><EndTime>2030-05-14T20:30:00.000Z</EndTime></ListingDetails>" : ""}
        <SellingStatus><CurrentPrice currencyID="GBP">123.00</CurrentPrice></SellingStatus>
      </Item>
    </ItemArray>
  </${listName}>
</GetMyeBayBuyingResponse>`;
}
