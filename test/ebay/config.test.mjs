import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEbayConsentUrl, getEbayConfigStatus, loadEbayConfig } from "../../src/ebay/config.ts";

const env = {
  EBAY_ENVIRONMENT: "sandbox",
  GOGGLER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
  EBAY_SANDBOX_CLIENT_ID: "client-id",
  EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
  EBAY_SANDBOX_REDIRECT_URI: "runame-value",
  EBAY_SANDBOX_OAUTH_SCOPES: "scope-one scope-two"
};

test("loads sandbox eBay configuration with defaults", () => {
  const config = loadEbayConfig(env);

  assert.equal(config.environment, "sandbox");
  assert.equal(config.authorizeUrl, "https://auth.sandbox.ebay.com/oauth2/authorize");
  assert.equal(config.tokenUrl, "https://api.sandbox.ebay.com/identity/v1/oauth2/token");
  assert.equal(config.tradingApiUrl, "https://api.sandbox.ebay.com/ws/api.dll");
  assert.equal(config.marketplaceId, "EBAY_GB");
  assert.equal(config.tradingSiteId, "3");
  assert.deepEqual(config.scopes, ["scope-one", "scope-two"]);
});

test("loads sandbox eBay configuration from sandbox-specific credentials", () => {
  const config = loadEbayConfig({
    EBAY_ENVIRONMENT: "sandbox",
    GOGGLER_AUTH_SECRET: env.GOGGLER_AUTH_SECRET,
    EBAY_SANDBOX_CLIENT_ID: "sandbox-client-id",
    EBAY_SANDBOX_CLIENT_SECRET: "sandbox-client-secret",
    EBAY_SANDBOX_REDIRECT_URI: "sandbox-runame",
    EBAY_SANDBOX_OAUTH_SCOPES: "sandbox-scope"
  });

  assert.equal(config.clientId, "sandbox-client-id");
  assert.equal(config.clientSecret, "sandbox-client-secret");
  assert.equal(config.redirectUri, "sandbox-runame");
  assert.deepEqual(config.scopes, ["sandbox-scope"]);
});

test("loads production eBay endpoints from production-specific credentials", () => {
  const config = loadEbayConfig({
    EBAY_ENVIRONMENT: "production",
    GOGGLER_AUTH_SECRET: env.GOGGLER_AUTH_SECRET,
    EBAY_SANDBOX_CLIENT_ID: "sandbox-client-id",
    EBAY_SANDBOX_CLIENT_SECRET: "sandbox-client-secret",
    EBAY_SANDBOX_REDIRECT_URI: "sandbox-runame",
    EBAY_SANDBOX_OAUTH_SCOPES: "sandbox-scope",
    EBAY_PRODUCTION_CLIENT_ID: "production-client-id",
    EBAY_PRODUCTION_CLIENT_SECRET: "production-client-secret",
    EBAY_PRODUCTION_REDIRECT_URI: "production-runame",
    EBAY_PRODUCTION_OAUTH_SCOPES: "production-scope"
  });

  assert.equal(config.clientId, "production-client-id");
  assert.equal(config.clientSecret, "production-client-secret");
  assert.equal(config.redirectUri, "production-runame");
  assert.deepEqual(config.scopes, ["production-scope"]);
  assert.equal(config.authorizeUrl, "https://auth.ebay.com/oauth2/authorize");
  assert.equal(config.tokenUrl, "https://api.ebay.com/identity/v1/oauth2/token");
  assert.equal(config.tradingApiUrl, "https://api.ebay.com/ws/api.dll");
});

test("does not allow production mode to fall back to sandbox credential variables", () => {
  assert.throws(() => loadEbayConfig({ ...env, EBAY_ENVIRONMENT: "production" }), /EBAY_PRODUCTION_CLIENT_ID/);
});

test("requires OAuth app credentials and scopes", () => {
  assert.throws(() => loadEbayConfig({ ...env, EBAY_SANDBOX_CLIENT_ID: undefined }), /EBAY_SANDBOX_CLIENT_ID/);
  assert.throws(() => loadEbayConfig({ ...env, EBAY_SANDBOX_OAUTH_SCOPES: "" }), /EBAY_SANDBOX_OAUTH_SCOPES/);
});

test("builds eBay user consent URL", () => {
  const url = buildEbayConsentUrl(loadEbayConfig(env), "signed-state");

  assert.equal(url.origin + url.pathname, "https://auth.sandbox.ebay.com/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "runame-value");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "scope-one scope-two");
  assert.equal(url.searchParams.get("state"), "signed-state");
});

test("reports eBay configuration readiness without exposing secrets", () => {
  const status = getEbayConfigStatus(env);

  assert.equal(status.ready, true);
  assert.equal(status.environment, "sandbox");
  assert.equal(status.scopeCount, 2);
  assert.deepEqual(status.missing, []);
  assert.deepEqual(status.invalid, []);
  assert.equal(JSON.stringify(status).includes("client-secret"), false);
  assert.equal(JSON.stringify(status).includes(env.GOGGLER_AUTH_SECRET), false);
});

test("reports missing and invalid eBay configuration", () => {
  const status = getEbayConfigStatus({
    EBAY_ENVIRONMENT: "not-real",
    GOGGLER_AUTH_SECRET: "short"
  });

  assert.equal(status.ready, false);
  assert.deepEqual(status.missing, [
    "EBAY_SANDBOX_CLIENT_ID",
    "EBAY_SANDBOX_CLIENT_SECRET",
    "EBAY_SANDBOX_REDIRECT_URI",
    "EBAY_SANDBOX_OAUTH_SCOPES"
  ]);
  assert.deepEqual(status.invalid, ["EBAY_ENVIRONMENT", "GOGGLER_AUTH_SECRET"]);
});

test("reports production credential gaps without exposing generic sandbox credentials", () => {
  const status = getEbayConfigStatus({
    ...env,
    EBAY_ENVIRONMENT: "production"
  });

  assert.equal(status.ready, false);
  assert.equal(status.environment, "production");
  assert.deepEqual(status.missing, [
    "EBAY_PRODUCTION_CLIENT_ID",
    "EBAY_PRODUCTION_CLIENT_SECRET",
    "EBAY_PRODUCTION_REDIRECT_URI",
    "EBAY_PRODUCTION_OAUTH_SCOPES"
  ]);
  assert.deepEqual(status.invalid, []);
  assert.equal(JSON.stringify(status).includes("client-secret"), false);
});
