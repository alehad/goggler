import assert from "node:assert/strict";
import { test } from "node:test";
import { safeEbayImageUrl, safeEbayItemUrl, safePublicHttpsUrl } from "../../src/http/safe-external-url.ts";

test("allows public https URLs while stripping credentials and hashes", () => {
  assert.equal(safePublicHttpsUrl("https://user:pass@example.com/image.jpg#tracking"), "https://example.com/image.jpg");
});

test("rejects unsafe public URL schemes and private hosts", () => {
  assert.equal(safePublicHttpsUrl("javascript:alert(1)"), undefined);
  assert.equal(safePublicHttpsUrl("data:image/svg+xml,<svg></svg>"), undefined);
  assert.equal(safePublicHttpsUrl("http://example.com/image.jpg"), undefined);
  assert.equal(safePublicHttpsUrl("https://localhost/image.jpg"), undefined);
  assert.equal(safePublicHttpsUrl("https://app.localhost/image.jpg"), undefined);
  assert.equal(safePublicHttpsUrl("https://192.168.1.2/image.jpg"), undefined);
  assert.equal(safePublicHttpsUrl("https://2130706433/image.jpg"), undefined);
  assert.equal(safePublicHttpsUrl("https://0x7f000001/image.jpg"), undefined);
  assert.equal(safePublicHttpsUrl("https://017700000001/image.jpg"), undefined);
  assert.equal(safePublicHttpsUrl("https://[::1]/image.jpg"), undefined);
  assert.equal(safePublicHttpsUrl("https://[fd00::1]/image.jpg"), undefined);
});

test("allows only trusted eBay item URLs for item links", () => {
  assert.equal(safeEbayItemUrl("https://www.ebay.co.uk/itm/123?mkcid=1#tracking"), "https://www.ebay.co.uk/itm/123");
  assert.equal(safeEbayItemUrl("https://www.ebay.com/itm/123"), "https://www.ebay.com/itm/123");
});

test("rejects non-eBay item URLs", () => {
  assert.equal(safeEbayItemUrl("https://example.com/itm/123"), undefined);
  assert.equal(safeEbayItemUrl("javascript:alert(1)"), undefined);
  assert.equal(safeEbayItemUrl("http://www.ebay.co.uk/itm/123"), undefined);
});

test("allows only trusted eBay image hosts for rendered listing images", () => {
  assert.equal(safeEbayImageUrl("https://i.ebayimg.com/images/g/item.jpg#tracking"), "https://i.ebayimg.com/images/g/item.jpg");
  assert.equal(safeEbayImageUrl("https://ir.ebaystatic.com/image.jpg"), "https://ir.ebaystatic.com/image.jpg");
  assert.equal(safeEbayImageUrl("https://example.com/image.jpg"), undefined);
  assert.equal(safeEbayImageUrl("data:image/svg+xml,<svg></svg>"), undefined);
});
