import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { config as loadDotenv } from "dotenv";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { captureItems, computeGroupDeals, computeGroupTrends, listCaptureCandidates } from "../../src/market-insights/price-history.ts";
import { captureMarketPriceRecords } from "../../src/persistence/market-price-records.ts";
import { createPrismaClient } from "../../src/persistence/prisma.ts";

loadDotenv({ path: ".env.local" });

let prisma;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
  prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.GOGGLER_DB_TARGET = "local";
});

beforeEach(async () => {
  await prisma.marketPriceRecord.deleteMany();
  await prisma.wonItem.deleteMany();
});

after(async () => {
  await prisma?.$disconnect();
});

test("listCaptureCandidates marks ended watchlist items already captured for this user", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "ended-001", title: "Already captured", list: "WatchList", currentPrice: { value: 10, currency: "GBP" } }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const history = {
    endedWatchlistItems: [
      { itemId: "ended-001", title: "Already captured", list: "WatchList", currentPrice: { value: 10, currency: "GBP" } },
      { itemId: "ended-002", title: "Not yet captured", list: "WatchList", currentPrice: { value: 20, currency: "GBP" } }
    ]
  };

  const candidates = await listCaptureCandidates(history, "local-saja");
  assert.deepEqual(
    candidates.map((candidate) => [candidate.itemId, candidate.captured]),
    [
      ["ended-001", true],
      ["ended-002", false]
    ]
  );
});

test("listCaptureCandidates includes a captured item no longer present in the live watchlist fetch", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "aged-out", title: "No longer live", list: "WatchList", currentPrice: { value: 45, currency: "GBP" }, endTime: "2026-01-01T00:00:00.000Z" }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const history = {
    endedWatchlistItems: [
      { itemId: "still-live", title: "Still on the live watchlist", list: "WatchList", currentPrice: { value: 20, currency: "GBP" } }
    ]
  };

  const candidates = await listCaptureCandidates(history, "local-saja");
  assert.deepEqual(
    candidates.map((candidate) => [candidate.itemId, candidate.captured]).sort(),
    [
      ["aged-out", true],
      ["still-live", false]
    ]
  );
});

test("listCaptureCandidates returns historical captures even when the live fetch has no ended items", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "only-in-db", title: "Only in the database", list: "WatchList", currentPrice: { value: 33, currency: "GBP" } }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const candidates = await listCaptureCandidates({ endedWatchlistItems: [] }, "local-saja");
  assert.deepEqual(candidates.map((candidate) => candidate.itemId), ["only-in-db"]);
  assert.equal(candidates[0].captured, true);
});

test("listCaptureCandidates does not duplicate an item that is both live-fetched and captured", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "both", title: "Live and captured", list: "WatchList", currentPrice: { value: 15, currency: "GBP" } }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const history = {
    endedWatchlistItems: [
      { itemId: "both", title: "Live and captured", list: "WatchList", currentPrice: { value: 15, currency: "GBP" } }
    ]
  };

  const candidates = await listCaptureCandidates(history, "local-saja");
  assert.equal(candidates.filter((candidate) => candidate.itemId === "both").length, 1);
  assert.equal(candidates.find((candidate) => candidate.itemId === "both")?.captured, true);
});

test("captureItems only persists items whose price can be independently verified from eBay", async () => {
  const freshConfig = loadEbayConfig({
    EBAY_ENVIRONMENT: "sandbox",
    EBAY_SANDBOX_CLIENT_ID: "capture-id-filter-client-id",
    EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
    EBAY_SANDBOX_REDIRECT_URI: "runame-value",
    EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
  });

  const result = await captureItems(
    freshConfig,
    "local-saja",
    [
      { itemId: "watch-ended", title: "Ended watchlist item", list: "WatchList", endTime: "2020-01-01T00:00:00.000Z" },
      { itemId: "not-really-ended", title: "Cannot be verified", list: "WatchList" }
    ],
    DEFAULT_MATCHING_PREFERENCES,
    { fetch: mockEbayFetch({ "watch-ended": { value: "88.00", currency: "GBP" } }) }
  );

  assert.deepEqual(result.captured, ["watch-ended"]);
  assert.deepEqual(result.skipped, ["not-really-ended"]);
  const stored = await prisma.marketPriceRecord.findFirstOrThrow({
    where: { userId: "local-saja", venueItemId: "watch-ended" }
  });
  assert.equal(stored.soldPriceAmount.toNumber(), 88);
});

test("captureItems persists the Browse-resolved native price, not eBay's marketplace-converted price, and ignores any client-supplied price", async () => {
  const freshConfig = loadEbayConfig({
    EBAY_ENVIRONMENT: "sandbox",
    EBAY_SANDBOX_CLIENT_ID: "capture-native-price-client-id",
    EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
    EBAY_SANDBOX_REDIRECT_URI: "runame-value",
    EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
  });

  await captureItems(
    freshConfig,
    "local-saja",
    [
      {
        itemId: "watch-ended",
        title: "Ended watchlist item",
        list: "WatchList",
        endTime: "2020-01-01T00:00:00.000Z",
        currentPrice: { value: 1, currency: "XXX" }
      }
    ],
    DEFAULT_MATCHING_PREFERENCES,
    {
      fetch: mockEbayFetch({
        "watch-ended": { value: "117.86", currency: "USD" }
      })
    }
  );

  const stored = await prisma.marketPriceRecord.findFirstOrThrow({
    where: { userId: "local-saja", venueItemId: "watch-ended" }
  });
  assert.equal(stored.soldPriceAmount.toNumber(), 117.86);
  assert.equal(stored.soldPriceCurrency, "USD");
});

test("computeGroupTrends computes percent change from earliest to latest sale, merging captured and won items in the same group", async () => {
  await captureMarketPriceRecords(
    [
      {
        itemId: "cap-1",
        title: "Widget ABC-123 v1",
        list: "WatchList",
        currentPrice: { value: 100, currency: "GBP" },
        endTime: "2026-01-01T00:00:00.000Z"
      }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "won-1",
      title: "Widget ABC-123 v2",
      itemPriceAmount: 150,
      currency: "GBP",
      purchasedAt: new Date("2026-03-01T00:00:00.000Z")
    }
  });

  const trends = await computeGroupTrends("local-saja", DEFAULT_MATCHING_PREFERENCES);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].relistingGroupId, "criteria:ABC123");
  assert.equal(trends[0].currency, "GBP");
  assert.equal(trends[0].saleCount, 2);
  assert.deepEqual(trends[0].earliest, { value: 100, endedAt: "2026-01-01T00:00:00.000Z", itemId: "cap-1", won: false });
  assert.equal(trends[0].latest.value, 150);
  assert.equal(trends[0].latest.itemId, "won-1");
  assert.equal(trends[0].latest.won, true);
  assert.equal(trends[0].percentChange, 50);
});

test("computeGroupTrends excludes groups with fewer than two dated sales", async () => {
  await captureMarketPriceRecords(
    [
      {
        itemId: "lonely",
        title: "Widget XYZ-999",
        list: "WatchList",
        currentPrice: { value: 20, currency: "GBP" },
        endTime: "2026-01-01T00:00:00.000Z"
      }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const trends = await computeGroupTrends("local-saja", DEFAULT_MATCHING_PREFERENCES);
  assert.equal(trends.length, 0);
});

test("computeGroupTrends keeps sales in the same relisting group but different currencies as separate trends", async () => {
  await captureMarketPriceRecords(
    [
      {
        itemId: "gbp-1",
        title: "Widget DEF-456 v1",
        list: "WatchList",
        currentPrice: { value: 10, currency: "GBP" },
        endTime: "2026-01-01T00:00:00.000Z"
      },
      {
        itemId: "gbp-2",
        title: "Widget DEF-456 v2",
        list: "WatchList",
        currentPrice: { value: 20, currency: "GBP" },
        endTime: "2026-02-01T00:00:00.000Z"
      },
      {
        itemId: "usd-1",
        title: "Widget DEF-456 v3",
        list: "WatchList",
        currentPrice: { value: 30, currency: "USD" },
        endTime: "2026-01-01T00:00:00.000Z"
      },
      {
        itemId: "usd-2",
        title: "Widget DEF-456 v4",
        list: "WatchList",
        currentPrice: { value: 15, currency: "USD" },
        endTime: "2026-02-01T00:00:00.000Z"
      }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const trends = await computeGroupTrends("local-saja", DEFAULT_MATCHING_PREFERENCES);
  assert.equal(trends.length, 2);

  const gbpTrend = trends.find((trend) => trend.currency === "GBP");
  const usdTrend = trends.find((trend) => trend.currency === "USD");
  assert.equal(gbpTrend?.percentChange, 100);
  assert.equal(usdTrend?.percentChange, -50);
});

test("computeGroupDeals compares the won price against the group average, not the earliest/latest point", async () => {
  await captureMarketPriceRecords(
    [
      { itemId: "deal-a", title: "Widget DEAL-100 A", list: "WatchList", currentPrice: { value: 10, currency: "GBP" }, endTime: "2026-01-01T00:00:00.000Z" },
      { itemId: "deal-b", title: "Widget DEAL-100 B", list: "WatchList", currentPrice: { value: 20, currency: "GBP" }, endTime: "2026-02-01T00:00:00.000Z" }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "deal-won",
      title: "Widget DEAL-100 C",
      itemPriceAmount: 6,
      currency: "GBP",
      purchasedAt: new Date("2026-03-01T00:00:00.000Z")
    }
  });

  const deals = await computeGroupDeals("local-saja", DEFAULT_MATCHING_PREFERENCES);
  assert.equal(deals.length, 1);
  assert.equal(deals[0].wonItemId, "deal-won");
  assert.equal(deals[0].paidValue, 6);
  assert.equal(deals[0].averageValue, 12);
  assert.equal(deals[0].saleCount, 3);
  assert.equal(deals[0].dealPercent, 50);
});

test("computeGroupDeals returns one entry per won purchase when a group has more than one", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "multi-unwon", title: "Widget MULTI-200 B", list: "WatchList", currentPrice: { value: 30, currency: "GBP" }, endTime: "2026-02-01T00:00:00.000Z" }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await prisma.wonItem.createMany({
    data: [
      {
        userId: "local-saja",
        venue: "ebay",
        venueItemId: "multi-a",
        title: "Widget MULTI-200 A",
        itemPriceAmount: 10,
        currency: "GBP",
        purchasedAt: new Date("2026-01-01T00:00:00.000Z")
      },
      {
        userId: "local-saja",
        venue: "ebay",
        venueItemId: "multi-c",
        title: "Widget MULTI-200 C",
        itemPriceAmount: 50,
        currency: "GBP",
        purchasedAt: new Date("2026-03-01T00:00:00.000Z")
      }
    ]
  });

  const deals = await computeGroupDeals("local-saja", DEFAULT_MATCHING_PREFERENCES);
  assert.equal(deals.length, 2);

  const dealA = deals.find((deal) => deal.wonItemId === "multi-a");
  const dealC = deals.find((deal) => deal.wonItemId === "multi-c");
  assert.equal(dealA?.averageValue, 30);
  assert.ok(Math.abs((dealA?.dealPercent ?? 0) - 66.6666666666667) < 0.001);
  assert.ok(Math.abs((dealC?.dealPercent ?? 0) - -66.6666666666667) < 0.001);
});

test("computeGroupDeals still lists a won item with no other dated sale, with its own price as the average (saleCount 1)", async () => {
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "lonely-won",
      title: "Widget LONELY-300",
      itemPriceAmount: 15,
      currency: "GBP",
      purchasedAt: new Date("2026-01-01T00:00:00.000Z")
    }
  });

  const deals = await computeGroupDeals("local-saja", DEFAULT_MATCHING_PREFERENCES);
  const lonely = deals.find((deal) => deal.wonItemId === "lonely-won");
  assert.ok(lonely, "the lonely won item must still appear in the results");
  assert.equal(lonely.paidValue, 15);
  assert.equal(lonely.saleCount, 1);
  assert.equal(lonely.averageValue, 15);
  assert.equal(lonely.differenceValue, 0);
  assert.equal(lonely.dealPercent, 0);
});

test("computeGroupDeals and computeGroupTrends count a listing that was both captured and later won only once", async () => {
  await captureMarketPriceRecords(
    [
      {
        itemId: "dup-item",
        title: "Widget DUP-900 A",
        list: "WatchList",
        currentPrice: { value: 40, currency: "GBP" },
        endTime: "2026-01-01T00:00:00.000Z"
      },
      {
        itemId: "other-item",
        title: "Widget DUP-900 B",
        list: "WatchList",
        currentPrice: { value: 60, currency: "GBP" },
        endTime: "2026-02-01T00:00:00.000Z"
      }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  // The exact same listing (same venueItemId) was later won — same real-world sale, must not
  // be double-counted just because it exists in both the WonItem and MarketPriceRecord tables.
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "dup-item",
      title: "Widget DUP-900 A",
      itemPriceAmount: 40,
      currency: "GBP",
      purchasedAt: new Date("2026-01-01T00:00:00.000Z")
    }
  });

  const trends = await computeGroupTrends("local-saja", DEFAULT_MATCHING_PREFERENCES);
  const trend = trends.find((t) => t.relistingGroupId === "criteria:DUP900");
  assert.equal(trend?.saleCount, 2);

  const deals = await computeGroupDeals("local-saja", DEFAULT_MATCHING_PREFERENCES);
  const matchingDeals = deals.filter((deal) => deal.wonItemId === "dup-item");
  assert.equal(matchingDeals.length, 1, "the won+captured duplicate must produce exactly one deal entry");
  assert.equal(matchingDeals[0].saleCount, 2);
  assert.equal(matchingDeals[0].averageValue, 50);
});

function mockEbayFetch(nativePricesByItemId = {}) {
  return async (url) => {
    const urlText = String(url);
    if (urlText.includes("/identity/v1/oauth2/token")) {
      return Response.json({ access_token: "app-access-token", expires_in: 7200, token_type: "Bearer" });
    }

    if (urlText.includes("/buy/browse/v1/item/get_item_by_legacy_id")) {
      const legacyItemId = new URL(urlText).searchParams.get("legacy_item_id");
      const nativePrice = nativePricesByItemId[legacyItemId];
      if (!nativePrice) {
        return new Response("not found", { status: 404 });
      }
      return Response.json({
        price: { value: "88.00", currency: "GBP", convertedFromValue: nativePrice.value, convertedFromCurrency: nativePrice.currency }
      });
    }

    return new Response("not found", { status: 404 });
  };
}
