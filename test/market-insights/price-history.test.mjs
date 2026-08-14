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

test("summarizeMatchedSales prefers the most recent sale when tied for highest", () => {
  const summary = summarizeMatchedSales([
    { venueItemId: "older", title: "Older tie", price: { value: 103.5, currency: "USD" }, endedAt: "2026-05-24T02:23:00.000Z", won: false },
    { venueItemId: "middle", title: "Not tied", price: { value: 87, currency: "USD" }, endedAt: "2026-07-12T02:06:00.000Z", won: false },
    { venueItemId: "newer", title: "Newer tie", price: { value: 103.5, currency: "USD" }, endedAt: "2026-07-12T02:44:00.000Z", won: false }
  ]);

  assert.deepEqual(summary?.highest, { value: 103.5, endedAt: "2026-07-12T02:44:00.000Z" });
});

test("summarizeMatchedSales prefers the most recent sale when tied for lowest", () => {
  const summary = summarizeMatchedSales([
    { venueItemId: "older", title: "Older tie", price: { value: 30, currency: "GBP" }, endedAt: "2026-05-01T00:00:00.000Z", won: false },
    { venueItemId: "middle", title: "Not tied", price: { value: 70, currency: "GBP" }, endedAt: "2026-05-05T00:00:00.000Z", won: false },
    { venueItemId: "newer", title: "Newer tie", price: { value: 30, currency: "GBP" }, endedAt: "2026-05-10T00:00:00.000Z", won: false }
  ]);

  assert.deepEqual(summary?.lowest, { value: 30, endedAt: "2026-05-10T00:00:00.000Z" });
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
