import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import {
  EBAY_BROWSE_SCOPE,
  EBAY_MARKETPLACE_INSIGHTS_SCOPE,
  exchangeEbayAuthorizationCode,
  getEbayApplicationAccessToken
} from "../../src/ebay/oauth-client.ts";

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_SANDBOX_CLIENT_ID: "client-id",
  EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
  EBAY_SANDBOX_REDIRECT_URI: "runame-value",
  EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
});

test("exchanges an eBay authorization code for session-scoped token metadata", async () => {
  let request;
  const authorization = await exchangeEbayAuthorizationCode(config, "auth-code", {
    now: new Date("2026-05-07T10:00:00.000Z"),
    fetch: async (url, init) => {
      request = { url, init };
      return jsonResponse({
        access_token: "access-token",
        expires_in: 7200,
        refresh_token: "refresh-token",
        refresh_token_expires_in: 47304000,
        token_type: "User Access Token"
      });
    }
  });

  assert.equal(request.url, "https://api.sandbox.ebay.com/identity/v1/oauth2/token");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
  assert.equal(request.init.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(request.init.body.get("grant_type"), "authorization_code");
  assert.equal(request.init.body.get("code"), "auth-code");
  assert.equal(request.init.body.get("redirect_uri"), "runame-value");
  assert.equal(authorization.accessToken, "access-token");
  assert.equal(authorization.refreshToken, "refresh-token");
  assert.equal(authorization.expiresAt.toISOString(), "2026-05-07T12:00:00.000Z");
  assert.deepEqual(authorization.scopes, ["scope-one"]);
});

test("normalizes eBay token exchange failures", async () => {
  await assert.rejects(
    () =>
      exchangeEbayAuthorizationCode(config, "auth-code", {
        fetch: async () => new Response("nope", { status: 401 })
      }),
    /status 401/
  );
});

test("requests an eBay application token for marketplace insights", async () => {
  let request;
  const authorization = await getEbayApplicationAccessToken(config, {
    now: new Date("2026-05-07T10:00:00.000Z"),
    fetch: async (url, init) => {
      request = { url, init };
      return jsonResponse({
        access_token: "app-access-token",
        expires_in: 7200,
        token_type: "Application Access Token"
      });
    }
  });

  assert.equal(request.url, "https://api.sandbox.ebay.com/identity/v1/oauth2/token");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
  assert.equal(request.init.body.get("grant_type"), "client_credentials");
  assert.equal(request.init.body.get("scope"), EBAY_MARKETPLACE_INSIGHTS_SCOPE);
  assert.equal(authorization.accessToken, "app-access-token");
  assert.equal(authorization.expiresAt.toISOString(), "2026-05-07T12:00:00.000Z");
  assert.deepEqual(authorization.scopes, [EBAY_MARKETPLACE_INSIGHTS_SCOPE]);
});

test("requests an eBay application token for browse search", async () => {
  let request;
  const authorization = await getEbayApplicationAccessToken(config, {
    scope: EBAY_BROWSE_SCOPE,
    fetch: async (url, init) => {
      request = { url, init };
      return jsonResponse({
        access_token: "browse-app-token",
        expires_in: 7200,
        token_type: "Application Access Token"
      });
    }
  });

  assert.equal(request.init.body.get("grant_type"), "client_credentials");
  assert.equal(request.init.body.get("scope"), EBAY_BROWSE_SCOPE);
  assert.equal(authorization.accessToken, "browse-app-token");
  assert.deepEqual(authorization.scopes, [EBAY_BROWSE_SCOPE]);
});

test("rejects unsupported eBay application token scopes before making a request", async () => {
  let fetchCalls = 0;
  await assert.rejects(
    () =>
      getEbayApplicationAccessToken(config, {
        scope: "https://api.ebay.com/oauth/api_scope/not.allowed",
        fetch: async () => {
          fetchCalls += 1;
          return jsonResponse({});
        }
      }),
    /scope is not allowed/
  );

  assert.equal(fetchCalls, 0);
});

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" }
  });
}
