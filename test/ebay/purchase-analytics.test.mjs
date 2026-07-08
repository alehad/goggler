import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPurchaseChartPoints } from "../../src/ebay/purchase-analytics.ts";

test("builds chart points from priced won items", () => {
  const points = buildPurchaseChartPoints([
    wonItem("won-001", 10, "2026-01-03T10:00:00.000Z"),
    wonItem("won-002", 25, "2026-01-01T10:00:00.000Z"),
    wonItem("won-003", 40, "2026-01-02T10:00:00.000Z")
  ]);

  assert.deepEqual(
    points.map((point) => point.itemId),
    ["won-002", "won-003", "won-001"]
  );
});

test("omits invalid prices from chart points", () => {
  const points = buildPurchaseChartPoints([
    wonItem("won-001", 18, "2026-01-01T10:00:00.000Z"),
    { ...wonItem("won-002", 0, "2026-01-02T10:00:00.000Z"), currentPrice: undefined },
    wonItem("won-003", -1, "2026-01-03T10:00:00.000Z")
  ]);

  assert.deepEqual(points.map((point) => point.itemId), ["won-001"]);
});

test("sorts chart points by purchase date and omits missing dates", () => {
  const points = buildPurchaseChartPoints([
    wonItem("won-later", 30, "2026-01-03T10:00:00.000Z"),
    wonItem("won-missing-date", 20, undefined),
    wonItem("won-earlier", 10, "2026-01-01T10:00:00.000Z")
  ]);

  assert.deepEqual(
    points.map((point) => point.itemId),
    ["won-earlier", "won-later"]
  );
});

test("keeps each chart point's own currency for mixed-currency won items", () => {
  const points = buildPurchaseChartPoints([
    { ...wonItem("won-usd", 205.2, "2026-01-01T10:00:00.000Z"), currentPrice: { value: 205.2, currency: "USD" } },
    wonItem("won-gbp", 40, "2026-01-02T10:00:00.000Z")
  ]);

  assert.deepEqual(
    points.map((point) => point.price),
    [
      { value: 205.2, currency: "USD" },
      { value: 40, currency: "GBP" }
    ]
  );
});

test("returns no chart points when no valid paid prices exist", () => {
  const points = buildPurchaseChartPoints([{ ...wonItem("won-001", 0, "2026-01-01T10:00:00.000Z"), currentPrice: undefined }]);

  assert.deepEqual(points, []);
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
