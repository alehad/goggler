import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPurchaseAnalytics } from "../../src/ebay/purchase-analytics.ts";

test("calculates average, lowest, and highest paid prices", () => {
  const analytics = buildPurchaseAnalytics([
    wonItem("won-001", 10, "2026-01-03T10:00:00.000Z"),
    wonItem("won-002", 25, "2026-01-01T10:00:00.000Z"),
    wonItem("won-003", 40, "2026-01-02T10:00:00.000Z")
  ]);

  assert.deepEqual(analytics.stats.average, { value: 25, currency: "GBP" });
  assert.deepEqual(analytics.stats.lowest, { value: 10, currency: "GBP" });
  assert.deepEqual(analytics.stats.highest, { value: 40, currency: "GBP" });
  assert.equal(analytics.stats.count, 3);
});

test("omits invalid prices from stats and chart points", () => {
  const analytics = buildPurchaseAnalytics([
    wonItem("won-001", 18, "2026-01-01T10:00:00.000Z"),
    { ...wonItem("won-002", 0, "2026-01-02T10:00:00.000Z"), currentPrice: undefined },
    wonItem("won-003", -1, "2026-01-03T10:00:00.000Z")
  ]);

  assert.equal(analytics.stats.count, 1);
  assert.deepEqual(analytics.chartPoints.map((point) => point.itemId), ["won-001"]);
});

test("sorts chart points by purchase date and omits missing dates", () => {
  const analytics = buildPurchaseAnalytics([
    wonItem("won-later", 30, "2026-01-03T10:00:00.000Z"),
    wonItem("won-missing-date", 20, undefined),
    wonItem("won-earlier", 10, "2026-01-01T10:00:00.000Z")
  ]);

  assert.deepEqual(
    analytics.chartPoints.map((point) => point.itemId),
    ["won-earlier", "won-later"]
  );
});

test("returns empty stats when no valid paid prices exist", () => {
  const analytics = buildPurchaseAnalytics([{ ...wonItem("won-001", 0, "2026-01-01T10:00:00.000Z"), currentPrice: undefined }]);

  assert.deepEqual(analytics.stats, { count: 0 });
  assert.deepEqual(analytics.chartPoints, []);
});

function wonItem(itemId, value, endTime) {
  return {
    itemId,
    title: itemId,
    list: "WonList",
    currentPrice: { value, currency: "GBP" },
    endTime
  };
}
