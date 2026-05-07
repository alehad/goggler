import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEbayConsentUrl, loadEbayConfig } from "../../src/ebay/config.ts";

const env = {
  EBAY_ENVIRONMENT: "sandbox",
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
