import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEbayConsentUrl, getEbayConfigStatus, loadEbayConfig } from "../../src/ebay/config.ts";

const env = {
  EBAY_ENVIRONMENT: "sandbox",
  GOGGLER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
  EBAY_CLIENT_ID: "client-id",
  EBAY_CLIENT_SECRET: "client-secret",
  EBAY_REDIRECT_URI: "runame-value",
  EBAY_OAUTH_SCOPES: "scope-one scope-two"
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

test("loads production eBay endpoints", () => {
  const config = loadEbayConfig({
    ...env,
    EBAY_ENVIRONMENT: "production"
  });

  assert.equal(config.authorizeUrl, "https://auth.ebay.com/oauth2/authorize");
  assert.equal(config.tokenUrl, "https://api.ebay.com/identity/v1/oauth2/token");
  assert.equal(config.tradingApiUrl, "https://api.ebay.com/ws/api.dll");
});

test("requires OAuth app credentials and scopes", () => {
  assert.throws(() => loadEbayConfig({ ...env, EBAY_CLIENT_ID: undefined }), /EBAY_CLIENT_ID/);
  assert.throws(() => loadEbayConfig({ ...env, EBAY_OAUTH_SCOPES: "" }), /EBAY_OAUTH_SCOPES/);
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
  assert.deepEqual(status.missing, ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_REDIRECT_URI", "EBAY_OAUTH_SCOPES"]);
  assert.deepEqual(status.invalid, ["EBAY_ENVIRONMENT", "GOGGLER_AUTH_SECRET"]);
});
