import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { config } from "dotenv";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import {
  captureMarketPriceRecords,
  deleteMarketPriceRecords,
  listAllMarketPriceRecords,
  listCapturedVenueItemIds,
  listMarketPriceRecordsByGroup
} from "../../src/persistence/market-price-records.ts";
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

test("captures a batch spanning multiple transaction chunks (23 items, CAPTURE_BATCH_SIZE=10)", async () => {
  const items = Array.from({ length: 23 }, (_, i) => endedItem(`chunked-${i}`, `Chunked item ${i} BNJ7100${i % 10}`, 10 + i));

  const result = await captureMarketPriceRecords(items, "local-saja", DEFAULT_MATCHING_PREFERENCES, prisma);

  assert.equal(result.captured.length, 23);
  const storedCount = await prisma.marketPriceRecord.count({
    where: { userId: "local-saja", venueItemId: { in: items.map((item) => item.itemId) } }
  });
  assert.equal(storedCount, 23, "every item across all chunks should be persisted, not just the first chunk");
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

test("listMarketPriceRecordsByGroup scopes by user, relisting group, and currency", async () => {
  await captureMarketPriceRecords(
    [
      endedItem("ended-001", "Blue Note style LP BNJ71001", 62.5),
      endedItem("ended-002", "Blue Note style LP BNJ71001", 70)
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [{ ...endedItem("ended-003", "Blue Note style LP BNJ71001", 90), currentPrice: { value: 90, currency: "USD" } }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [endedItem("ended-004", "Unrelated record BNJ99999", 15)],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [endedItem("ended-005", "Blue Note style LP BNJ71001", 200)],
    "other-user",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const sales = await listMarketPriceRecordsByGroup("local-saja", "criteria:BNJ71001", "GBP", prisma);

  assert.deepEqual(
    sales.map((sale) => sale.venueItemId).sort(),
    ["ended-001", "ended-002"]
  );
  assert.equal(sales.every((sale) => sale.price.currency === "GBP"), true);
});

test("listAllMarketPriceRecords returns every captured record for the user, scoped away from other users", async () => {
  await captureMarketPriceRecords(
    [
      endedItem("ended-001", "Blue Note style LP BNJ71001", 62.5),
      endedItem("ended-002", "Unrelated record BNJ99999", 15)
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [endedItem("ended-003", "Other user's record", 20)],
    "other-user",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const records = await listAllMarketPriceRecords("local-saja", prisma);

  assert.deepEqual(
    records.map((record) => record.itemId).sort(),
    ["ended-001", "ended-002"]
  );
  const first = records.find((record) => record.itemId === "ended-001");
  assert.equal(first?.list, "WatchList");
  assert.deepEqual(first?.currentPrice, { value: 62.5, currency: "GBP" });
  assert.equal(first?.relistingGroupId, "criteria:BNJ71001");
});

test("deleteMarketPriceRecords removes only the specified records for the given user", async () => {
  await captureMarketPriceRecords(
    [
      endedItem("ended-001", "Blue Note style LP BNJ71001", 62.5),
      endedItem("ended-002", "Unrelated record BNJ99999", 15),
      endedItem("ended-003", "Another record ABC1234", 30)
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const result = await deleteMarketPriceRecords("local-saja", ["ended-001", "ended-003"], prisma);

  assert.equal(result.deletedCount, 2);
  assert.equal(await prisma.marketPriceRecord.count({ where: { userId: "local-saja" } }), 1);
  const remaining = await prisma.marketPriceRecord.findFirstOrThrow({ where: { userId: "local-saja" } });
  assert.equal(remaining.venueItemId, "ended-002");
});

test("deleteMarketPriceRecords never deletes another user's records, even for the same venueItemId", async () => {
  await captureMarketPriceRecords(
    [endedItem("shared-item-id", "local-saja's record", 62.5)],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [endedItem("shared-item-id", "other-user's record", 40)],
    "other-user",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const result = await deleteMarketPriceRecords("local-saja", ["shared-item-id"], prisma);

  assert.equal(result.deletedCount, 1);
  assert.equal(await prisma.marketPriceRecord.count(), 1);
  const remaining = await prisma.marketPriceRecord.findFirstOrThrow({});
  assert.equal(remaining.userId, "other-user");
});

test("deleteMarketPriceRecords no-ops cleanly on an empty ID list", async () => {
  await captureMarketPriceRecords(
    [endedItem("ended-001", "Blue Note style LP BNJ71001", 62.5)],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const result = await deleteMarketPriceRecords("local-saja", [], prisma);

  assert.equal(result.deletedCount, 0);
  assert.equal(await prisma.marketPriceRecord.count(), 1);
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
