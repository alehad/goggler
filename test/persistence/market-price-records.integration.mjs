import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { config } from "dotenv";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { captureMarketPriceRecords, listCapturedVenueItemIds } from "../../src/persistence/market-price-records.ts";
import { createPrismaClient } from "../../src/persistence/prisma.ts";

config({ path: ".env.local" });

let prisma;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
  prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
});

beforeEach(async () => {
  await prisma.marketPriceRecord.deleteMany();
});

after(async () => {
  await prisma?.$disconnect();
});

test("captures ended watchlist items into price history", async () => {
  const result = await captureMarketPriceRecords(
    [endedItem("ended-001", "Blue Note style LP BNJ71001", 62.5)],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  assert.deepEqual(result.captured, ["ended-001"]);
  const stored = await prisma.marketPriceRecord.findFirstOrThrow({
    where: { userId: "local-saja", venueItemId: "ended-001" }
  });
  assert.equal(stored.title, "Blue Note style LP BNJ71001");
  assert.equal(stored.soldPriceAmount.toNumber(), 62.5);
  assert.equal(stored.soldPriceCurrency, "GBP");
  assert.equal(stored.relistingGroupId, "criteria:BNJ71001");
});

test("re-capturing an already-captured item updates the existing row instead of duplicating it", async () => {
  await captureMarketPriceRecords(
    [endedItem("ended-001", "Original title BNJ71001", 50)],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [endedItem("ended-001", "Updated title BNJ71001", 55)],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  assert.equal(await prisma.marketPriceRecord.count({ where: { userId: "local-saja", venueItemId: "ended-001" } }), 1);
  const stored = await prisma.marketPriceRecord.findFirstOrThrow({
    where: { userId: "local-saja", venueItemId: "ended-001" }
  });
  assert.equal(stored.title, "Updated title BNJ71001");
  assert.equal(stored.soldPriceAmount.toNumber(), 55);
});

test("listCapturedVenueItemIds returns exactly the captured set for the requesting user", async () => {
  await captureMarketPriceRecords(
    [endedItem("ended-001", "Saja item", 20)],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [endedItem("ended-001", "Other user item", 25)],
    "other-user",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const captured = await listCapturedVenueItemIds("local-saja", ["ended-001", "ended-002"], prisma);
  assert.deepEqual([...captured], ["ended-001"]);

  const otherUserCaptured = await listCapturedVenueItemIds("other-user", ["ended-001"], prisma);
  assert.deepEqual([...otherUserCaptured], ["ended-001"]);
});

function endedItem(itemId, title, value) {
  return {
    itemId,
    title,
    list: "WatchList",
    currentPrice: { value, currency: "GBP" },
    endTime: "2026-05-03T02:21:00.000Z"
  };
}
