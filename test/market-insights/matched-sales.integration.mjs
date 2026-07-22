import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { config } from "dotenv";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { listMatchedSales, listMatchedSalesSummaries } from "../../src/market-insights/price-history.ts";
import { captureMarketPriceRecords } from "../../src/persistence/market-price-records.ts";
import { createPrismaClient } from "../../src/persistence/prisma.ts";

config({ path: ".env.local" });

let prisma;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
  prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
});

beforeEach(async () => {
  await prisma.marketPriceRecord.deleteMany();
  await prisma.wonItem.deleteMany();
});

after(async () => {
  await prisma?.$disconnect();
});

test("merges a captured sale and a Won purchase of the same listing into one won point", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "listing-001", title: "Blue Note style LP BNJ71001", list: "WatchList", currentPrice: { value: 62.5, currency: "GBP" }, endTime: "2026-05-03T00:00:00.000Z" }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "listing-001",
      title: "Blue Note style LP BNJ71001",
      itemPriceAmount: 62.5,
      currency: "GBP",
      purchasedAt: new Date("2026-05-03T00:00:00.000Z")
    }
  });

  const sales = await listMatchedSales("local-saja", "criteria:BNJ71001", "GBP", DEFAULT_MATCHING_PREFERENCES);

  assert.equal(sales.length, 1);
  assert.equal(sales[0].venueItemId, "listing-001");
  assert.equal(sales[0].won, true);
});

test("includes a Won purchase that was never captured", async () => {
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "listing-002",
      title: "Blue Note style LP BNJ71001",
      itemPriceAmount: 80,
      currency: "GBP",
      purchasedAt: new Date("2026-06-01T00:00:00.000Z")
    }
  });

  const sales = await listMatchedSales("local-saja", "criteria:BNJ71001", "GBP", DEFAULT_MATCHING_PREFERENCES);

  assert.equal(sales.length, 1);
  assert.equal(sales[0].venueItemId, "listing-002");
  assert.equal(sales[0].won, true);
});

test("does not flag an unwon captured sale as won", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "listing-003", title: "Blue Note style LP BNJ71001", list: "WatchList", currentPrice: { value: 55, currency: "GBP" }, endTime: "2026-05-10T00:00:00.000Z" }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const sales = await listMatchedSales("local-saja", "criteria:BNJ71001", "GBP", DEFAULT_MATCHING_PREFERENCES);

  assert.equal(sales.length, 1);
  assert.equal(sales[0].won, false);
});

test("excludes a matching item priced in a different currency", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "listing-004", title: "Blue Note style LP BNJ71001", list: "WatchList", currentPrice: { value: 100, currency: "USD" }, endTime: "2026-05-10T00:00:00.000Z" }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const sales = await listMatchedSales("local-saja", "criteria:BNJ71001", "GBP", DEFAULT_MATCHING_PREFERENCES);

  assert.equal(sales.length, 0);
});

test("listMatchedSalesSummaries computes a summary per requested group and deduplicates repeated groups", async () => {
  await captureMarketPriceRecords(
    [
      { itemId: "listing-010", title: "Blue Note style LP BNJ71001", list: "WatchList", currentPrice: { value: 50, currency: "GBP" }, endTime: "2026-05-01T00:00:00.000Z" },
      { itemId: "listing-011", title: "Blue Note style LP BNJ71001", list: "WatchList", currentPrice: { value: 70, currency: "GBP" }, endTime: "2026-05-05T00:00:00.000Z" }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [{ itemId: "listing-020", title: "Unrelated record BNJ99999", list: "WatchList", currentPrice: { value: 15, currency: "GBP" }, endTime: "2026-05-01T00:00:00.000Z" }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const summaries = await listMatchedSalesSummaries(
    "local-saja",
    [
      { relistingGroupId: "criteria:BNJ71001", currency: "GBP" },
      { relistingGroupId: "criteria:BNJ71001", currency: "GBP" },
      { relistingGroupId: "criteria:BNJ99999", currency: "GBP" },
      { relistingGroupId: "criteria:NEVER-CAPTURED", currency: "GBP" }
    ],
    DEFAULT_MATCHING_PREFERENCES
  );

  assert.deepEqual(summaries["criteria:BNJ71001::GBP"], {
    count: 2,
    average: 60,
    lowest: { value: 50, endedAt: "2026-05-01T00:00:00.000Z" },
    highest: { value: 70, endedAt: "2026-05-05T00:00:00.000Z" }
  });
  assert.equal(summaries["criteria:BNJ99999::GBP"].count, 1);
  assert.equal(summaries["criteria:NEVER-CAPTURED::GBP"], undefined);
});
