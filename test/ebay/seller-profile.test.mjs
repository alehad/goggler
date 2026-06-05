import assert from "node:assert/strict";
import { test } from "node:test";
import { ebaySellerProfileUrl } from "../../src/ebay/seller-profile.ts";

test("builds first-party eBay seller profile URLs", () => {
  assert.equal(ebaySellerProfileUrl("record-seller"), "https://www.ebay.co.uk/usr/record-seller");
});

test("trims and encodes seller profile URL path segments", () => {
  assert.equal(ebaySellerProfileUrl(" seller name/uk "), "https://www.ebay.co.uk/usr/seller%20name%2Fuk");
});

test("omits seller profile URLs for missing seller names", () => {
  assert.equal(ebaySellerProfileUrl(undefined), undefined);
  assert.equal(ebaySellerProfileUrl("   "), undefined);
});
