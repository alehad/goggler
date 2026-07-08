import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { config } from "dotenv";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { createPrismaClient } from "../../src/persistence/prisma.ts";
import { persistWonItemsAndMerge } from "../../src/persistence/won-items.ts";

config({ path: ".env.local" });

let prisma;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
  prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
});

beforeEach(async () => {
  await prisma.wonItemImportRun.deleteMany();
  await prisma.wonItem.deleteMany();
});

after(async () => {
  await prisma?.$disconnect();
});

test("persists won items idempotently and preserves older rows outside later live windows", async () => {
  const first = await persistWonItemsAndMerge(
    liveHistory([
      wonItem("won-001", "First title", 35, {
        imageUrl: "https://i.ebayimg.com/images/g/first/s-l64.jpg"
      })
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  assert.equal(first.wonItems.length, 1);
  assert.equal(await prisma.wonItem.count(), 1);

  const second = await persistWonItemsAndMerge(
    liveHistory([
      wonItem("won-002", "Second title", 44.5)
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  assert.deepEqual(second.wonItems.map((item) => item.itemId).sort(), ["won-001", "won-002"]);
  assert.equal(await prisma.wonItem.count(), 2);
  assert.equal(await prisma.wonItemImportRun.count({ where: { status: "succeeded" } }), 2);
});

test("updates existing records without erasing stored optional values", async () => {
  await persistWonItemsAndMerge(
    liveHistory([
      wonItem("won-001", "Original title", 35, {
        imageUrl: "https://i.ebayimg.com/images/g/first/s-l64.jpg",
        sellerUserId: "record-seller"
      })
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  await persistWonItemsAndMerge(
    liveHistory([
      wonItem("won-001", "Updated title", 37)
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const stored = await prisma.wonItem.findFirstOrThrow({ where: { userId: "local-saja", venueItemId: "won-001" } });
  assert.equal(stored.title, "Updated title");
  assert.equal(stored.itemPriceAmount.toNumber(), 37);
  assert.equal(stored.imageUrl, "https://i.ebayimg.com/images/g/first/s-l64.jpg");
  assert.equal(stored.sellerUserId, "record-seller");
  assert.equal(await prisma.wonItem.count(), 1);
});

test("isolates persisted won items by owning user", async () => {
  await persistWonItemsAndMerge(
    liveHistory([wonItem("shared-item-id", "Saja item", 20)]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  const otherUserHistory = await persistWonItemsAndMerge(
    liveHistory([wonItem("shared-item-id", "Other user item", 25)]),
    "other-user",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  assert.equal(otherUserHistory.wonItems.length, 1);
  assert.equal(otherUserHistory.wonItems[0].title, "Other user item");
  assert.equal(await prisma.wonItem.count(), 2);
});

test("persistent schema has no OAuth credential or raw upstream payload fields", async () => {
  const schema = await readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  for (const forbidden of ["accessToken", "refreshToken", "authorizationCode", "oauth", "rawXml", "rawPayload", "cookie", "requestHeader"]) {
    assert.equal(schema.toLocaleLowerCase("en-GB").includes(forbidden.toLocaleLowerCase("en-GB")), false, forbidden);
  }
});

function wonItem(itemId, title, value, overrides = {}) {
  return {
    itemId,
    title,
    list: "WonList",
    currentPrice: { value, currency: "USD" },
    endTime: "2026-05-03T02:21:00.000Z",
    ...overrides
  };
}

function liveHistory(wonItems) {
  return {
    source: "live",
    counts: {
      lost: 0,
      won: wonItems.length,
      eventuallyWon: 0,
      neverWon: 0,
      watchlist: 0,
      watchlistRelistings: 0,
      needsAction: 0,
      relistings: 0
    },
    lostItems: [],
    wonItems,
    watchlistItems: [],
    endedWatchlistItems: [],
    relistingCandidates: [],
    homeFeed: {
      rows: [],
      ebayRows: [],
      relistingRows: [],
      counts: {
        watchlist: 0,
        watchlistRelistings: 0,
        needsAction: 0,
        relistings: 0,
        won: wonItems.length,
        neverWon: 0,
        resolved: 0
      }
    }
  };
}
