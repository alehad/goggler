import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeMatchedSales } from "../../src/market-insights/price-history.ts";

test("summarizeMatchedSales returns undefined for an empty list", () => {
  assert.equal(summarizeMatchedSales([]), undefined);
});

test("summarizeMatchedSales computes count/average/lowest/highest", () => {
  const summary = summarizeMatchedSales([
    { venueItemId: "a", title: "A", price: { value: 50, currency: "GBP" }, endedAt: "2026-05-01T00:00:00.000Z", won: false },
    { venueItemId: "b", title: "B", price: { value: 70, currency: "GBP" }, endedAt: "2026-05-10T00:00:00.000Z", won: true },
    { venueItemId: "c", title: "C", price: { value: 30, currency: "GBP" }, endedAt: "2026-05-05T00:00:00.000Z", won: false }
  ]);

  assert.deepEqual(summary, {
    count: 3,
    average: 50,
    lowest: { value: 30, endedAt: "2026-05-05T00:00:00.000Z" },
    highest: { value: 70, endedAt: "2026-05-10T00:00:00.000Z" }
  });
});

test("summarizeMatchedSales handles a single sale", () => {
  const summary = summarizeMatchedSales([
    { venueItemId: "a", title: "A", price: { value: 42, currency: "GBP" }, endedAt: "2026-05-01T00:00:00.000Z", won: true }
  ]);

  assert.deepEqual(summary, {
    count: 1,
    average: 42,
    lowest: { value: 42, endedAt: "2026-05-01T00:00:00.000Z" },
    highest: { value: 42, endedAt: "2026-05-01T00:00:00.000Z" }
  });
});
