import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { config } from "dotenv";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { createPrismaClient } from "../../src/persistence/prisma.ts";
import { persistLostItemsAndMerge } from "../../src/persistence/lost-items.ts";

config({ path: ".env.local" });

let prisma;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
  prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
});

beforeEach(async () => {
  await prisma.lostItemImportRun.deleteMany();
  await prisma.lostItem.deleteMany();
});

after(async () => {
  await prisma?.$disconnect();
});

test("persists lost items idempotently and preserves rows outside later live windows", async () => {
  const first = await persistLostItemsAndMerge(
    liveHistory([lostItem("lost-001", "Blue Note BNJ71001", 42, 51)]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  assert.equal(first.lostItems.length, 1);
  assert.equal(await prisma.lostItem.count(), 1);

  const second = await persistLostItemsAndMerge(
    liveHistory([lostItem("lost-002", "Three Blind Mice TBM2541", 35, 48)]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  assert.deepEqual(second.lostItems.map((item) => item.itemId).sort(), ["lost-001", "lost-002"]);
  assert.equal(await prisma.lostItem.count(), 2);
  assert.equal(await prisma.lostItemImportRun.count({ where: { status: "succeeded" } }), 2);
});

test("keeps maximum bid distinct from sold price and preserves omitted optional values", async () => {
  await persistLostItemsAndMerge(
    liveHistory([
      lostItem("lost-001", "Original title BNJ71001", 42, 51, {
        imageUrl: "https://i.ebayimg.com/images/g/lost/s-l64.jpg",
        sellerUserId: "record-seller"
      })
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const updated = await persistLostItemsAndMerge(
    liveHistory([
      lostItem("lost-001", "Updated title BNJ71001", 44, 53, {
        maxBid: { value: 44, currency: "GBP" },
        currentPrice: { value: 53, currency: "USD" }
      })
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const stored = await prisma.lostItem.findFirstOrThrow({ where: { userId: "local-saja", venueItemId: "lost-001" } });
  assert.equal(stored.title, "Updated title BNJ71001");
  assert.equal(stored.maxBidAmount.toNumber(), 44);
  assert.equal(stored.maxBidCurrency, "GBP");
  assert.equal(stored.soldPriceAmount.toNumber(), 53);
  assert.equal(stored.soldPriceCurrency, "USD");
  assert.equal(stored.imageUrl, "https://i.ebayimg.com/images/g/lost/s-l64.jpg");
  assert.equal(stored.sellerUserId, "record-seller");
  assert.deepEqual(updated.lostItems[0].maxBid, { value: 44, currency: "GBP" });
  assert.deepEqual(updated.lostItems[0].currentPrice, { value: 53, currency: "USD" });
});

test("isolates lost items by user and never persists transient lists", async () => {
  await persistLostItemsAndMerge(
    liveHistory([lostItem("shared-id", "Saja lost item", 20, 30)], {
      relistingCandidates: [candidate("candidate-001")],
      watchlistItems: [watchItem("watch-001")]
    }),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  const otherUserHistory = await persistLostItemsAndMerge(
    liveHistory([lostItem("shared-id", "Other user lost item", 25, 35)]),
    "other-user",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  assert.equal(otherUserHistory.lostItems.length, 1);
  assert.equal(otherUserHistory.lostItems[0].title, "Other user lost item");
  assert.equal(await prisma.lostItem.count(), 2);
  assert.equal(await prisma.lostItem.count({ where: { venueItemId: { in: ["candidate-001", "watch-001"] } } }), 0);
});

function lostItem(itemId, title, maxBidValue, soldValue, overrides = {}) {
  return {
    itemId,
    title,
    list: "LostList",
    maxBid: { value: maxBidValue, currency: "USD" },
    currentPrice: { value: soldValue, currency: "USD" },
    endTime: "2026-05-03T02:21:00.000Z",
    ...overrides
  };
}

function watchItem(itemId) {
  return {
    itemId,
    title: "Watch item",
    watchlistPosition: 1,
    currentPrice: { value: 10, currency: "USD" }
  };
}

function candidate(itemId) {
  return {
    ...watchItem(itemId),
    candidateId: itemId
  };
}

function liveHistory(lostItems, overrides = {}) {
  return {
    source: "live",
    counts: {
      lost: lostItems.length,
      won: 0,
      eventuallyWon: 0,
      neverWon: lostItems.length,
      watchlist: overrides.watchlistItems?.length ?? 0,
      watchlistRelistings: 0,
      needsAction: overrides.relistingCandidates?.length ?? 0,
      relistings: overrides.relistingCandidates?.length ?? 0
    },
    lostItems,
    wonItems: [],
    watchlistItems: overrides.watchlistItems ?? [],
    endedWatchlistItems: [],
    relistingCandidates: overrides.relistingCandidates ?? [],
    homeFeed: {
      rows: [],
      ebayRows: [],
      relistingRows: [],
      counts: {
        watchlist: 0,
        watchlistRelistings: 0,
        needsAction: 0,
        relistings: 0,
        won: 0,
        neverWon: lostItems.length,
        resolved: 0
      }
    }
  };
}
