import assert from "node:assert/strict";
import { test } from "node:test";
import { getEbayHistorySourceStatus, parseEbayHistorySource } from "../../src/ebay/history-source.ts";

test("defaults fixture history source outside production", () => {
  assert.equal(parseEbayHistorySource(undefined, "development"), "fixture");
  assert.deepEqual(getEbayHistorySourceStatus({}, "development"), {
    ok: true,
    source: "fixture",
    fixture: true
  });
});

test("defaults live history source in production", () => {
  assert.equal(parseEbayHistorySource(undefined, "production"), "live");
  assert.deepEqual(getEbayHistorySourceStatus({}, "production"), {
    ok: true,
    source: "live",
    fixture: false
  });
});

test("rejects fixture history source in production", () => {
  assert.deepEqual(getEbayHistorySourceStatus({ GOGGLER_EBAY_HISTORY_SOURCE: "fixture" }, "production"), {
    ok: false,
    source: "fixture",
    error: "fixture_not_allowed_in_production"
  });
});

test("rejects unknown history source values", () => {
  assert.throws(() => parseEbayHistorySource("demo", "development"), /GOGGLER_EBAY_HISTORY_SOURCE/);
});
