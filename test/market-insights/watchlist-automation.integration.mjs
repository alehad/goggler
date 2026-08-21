import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { config as loadDotenv } from "dotenv";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { discoverAndWatchLiveAuctions } from "../../src/market-insights/watchlist-automation.ts";
import { captureMarketPriceRecords } from "../../src/persistence/market-price-records.ts";
import { createPrismaClient } from "../../src/persistence/prisma.ts";
import { persistWonItemsAndMerge } from "../../src/persistence/won-items.ts";

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

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_SANDBOX_CLIENT_ID: "watchlist-automation-client-id",
  EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
  EBAY_SANDBOX_REDIRECT_URI: "runame-value",
  EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
});

test("dedups record ids across won items and price history, adds only new live auctions, skips already-watched", async () => {
  await persistWonItemsAndMerge(
    liveHistory([wonItem("won-001", "Kenny Burrell BNJ71001 LP", 35)]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await captureMarketPriceRecords(
    [{ itemId: "history-001", title: "Kenny Burrell BNJ71001 LP", list: "WatchList", currentPrice: { value: 40, currency: "USD" } }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const searchQueries = [];
  const addedItemIds = [];
  const result = await discoverAndWatchLiveAuctions(
    config,
    "local-saja",
    "user-access-token",
    DEFAULT_MATCHING_PREFERENCES,
    {
      fetch: mockEbayFetch({
        onSearch: (query, url) => {
          searchQueries.push(query);
          assert.equal(url.searchParams.get("filter"), "buyingOptions:{AUCTION}");
          return [
            {
              itemId: "v1|110599602777|0",
              legacyItemId: "110599602777",
              title: "Kenny Burrell BNJ71001 LP reissue",
              categoryName: "Records",
              buyingOptions: ["AUCTION"]
            }
          ];
        },
        watchlistItemIds: [],
        onAdd: (itemId) => addedItemIds.push(itemId)
      })
    }
  );

  assert.deepEqual(searchQueries, ["BNJ71001"]);
  assert.equal(result.recordIdsSearched, 1);
  assert.equal(result.candidatesFound, 1);
  assert.equal(result.alreadyWatched, 0);
  // The legacy numeric ID must be used, not the REST-format itemId — Trading API's AddToWatchList
  // only accepts legacy IDs, and would silently fail (Ack=Failure) given the REST format.
  assert.deepEqual(result.added.map((item) => item.itemId), ["110599602777"]);
  assert.deepEqual(addedItemIds, ["110599602777"]);
});

test("skips a candidate that is already on the watchlist", async () => {
  await persistWonItemsAndMerge(
    liveHistory([wonItem("won-001", "Kenny Burrell BNJ71001 LP", 35)]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const addedItemIds = [];
  const result = await discoverAndWatchLiveAuctions(
    config,
    "local-saja",
    "user-access-token",
    DEFAULT_MATCHING_PREFERENCES,
    {
      fetch: mockEbayFetch({
        onSearch: () => [
          {
            itemId: "v1|110599602777|0",
            legacyItemId: "110599602777",
            title: "Kenny Burrell BNJ71001 LP",
            categoryName: "Records",
            buyingOptions: ["AUCTION"]
          }
        ],
        // Watchlist reads (GetMyeBayBuying) always return legacy-format IDs.
        watchlistItemIds: ["110599602777"],
        onAdd: (itemId) => addedItemIds.push(itemId)
      })
    }
  );

  assert.equal(result.candidatesFound, 1);
  assert.equal(result.alreadyWatched, 1);
  assert.deepEqual(result.added, []);
  assert.deepEqual(addedItemIds, []);
});

test("respects the maxAdds cap and isolates a single item's AddToWatchList failure", async () => {
  await persistWonItemsAndMerge(
    liveHistory([
      wonItem("won-001", "Kenny Burrell BNJ71001 LP", 35),
      wonItem("won-002", "Terumasa Hino TBM17 LP", 40)
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const addedItemIds = [];
  const result = await discoverAndWatchLiveAuctions(
    config,
    "local-saja",
    "user-access-token",
    DEFAULT_MATCHING_PREFERENCES,
    {
      maxAdds: 1,
      fetch: mockEbayFetch({
        onSearch: (query) => [restAndLegacyRow(query)],
        watchlistItemIds: [],
        onAdd: (itemId) => addedItemIds.push(itemId)
      })
    }
  );

  assert.equal(result.candidatesFound, 2);
  assert.equal(result.added.length, 1);
  assert.equal(addedItemIds.length, 1);
});

test("isolates a single item's AddToWatchList failure from the rest of the batch", async () => {
  await captureMarketPriceRecords(
    [
      { itemId: "history-001", title: "Kenny Burrell BNJ71001 LP", list: "WatchList", currentPrice: { value: 40, currency: "USD" } },
      { itemId: "history-002", title: "Terumasa Hino TBM17 LP", list: "WatchList", currentPrice: { value: 50, currency: "USD" } }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const result = await discoverAndWatchLiveAuctions(
    config,
    "local-saja",
    "user-access-token",
    DEFAULT_MATCHING_PREFERENCES,
    {
      fetch: mockEbayFetch({
        onSearch: (query) => [restAndLegacyRow(query)],
        watchlistItemIds: [],
        failItemIds: [legacyIdForQuery("BNJ71001")]
      })
    }
  );

  assert.equal(result.candidatesFound, 2);
  assert.equal(result.added.length, 1);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].itemId, legacyIdForQuery("BNJ71001"));
});

test("never runs more than the configured concurrency limit of searches at once", async () => {
  await persistWonItemsAndMerge(
    liveHistory([
      wonItem("won-001", "Kenny Burrell BNJ71001 LP", 35),
      wonItem("won-002", "Terumasa Hino TBM17 LP", 40),
      wonItem("won-003", "OST Bruce Lee ABC1234 LP", 45),
      wonItem("won-004", "Kool & The Gang DEF5678 LP", 20),
      wonItem("won-005", "Herbie Hancock GHI9012 LP", 30),
      wonItem("won-006", "Miles Davis JKL3456 LP", 25),
      wonItem("won-007", "John Coltrane MNO7890 LP", 28)
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  let inFlight = 0;
  let maxInFlight = 0;

  await discoverAndWatchLiveAuctions(config, "local-saja", "user-access-token", DEFAULT_MATCHING_PREFERENCES, {
    searchConcurrency: 3,
    fetch: mockEbayFetch({
      onSearch: async (query) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return [restAndLegacyRow(query)];
      },
      watchlistItemIds: []
    })
  });

  assert.equal(maxInFlight, 3);
});

test("emits progress events as it searches and adds", async () => {
  await persistWonItemsAndMerge(
    liveHistory([wonItem("won-001", "Kenny Burrell BNJ71001 LP", 35)]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const events = [];
  await discoverAndWatchLiveAuctions(config, "local-saja", "user-access-token", DEFAULT_MATCHING_PREFERENCES, {
    onEvent: (event) => events.push(event),
    fetch: mockEbayFetch({
      onSearch: (query) => [restAndLegacyRow(query)],
      watchlistItemIds: []
    })
  });

  assert.deepEqual(events.map((event) => event.type), ["search_started", "search_completed", "added", "done"]);
  assert.equal(events[2].candidate.itemId, legacyIdForQuery("BNJ71001"));
  assert.equal(events[2].candidate.title, "BNJ71001 live auction");
  assert.equal(events[3].result.added.length, 1);
});

test("caps additions per record ID so one seller mass-listing the same record can't consume the whole run's budget", async () => {
  // Mirrors a real scenario found in manual testing: a single seller running many separate
  // auctions of the exact same record (e.g. multiple copies of the same LP pressing).
  await persistWonItemsAndMerge(
    liveHistory([
      wonItem("won-001", "Kenny Burrell BNJ71001 LP", 35),
      wonItem("won-002", "Terumasa Hino TBM17 LP", 40)
    ]),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const result = await discoverAndWatchLiveAuctions(config, "local-saja", "user-access-token", DEFAULT_MATCHING_PREFERENCES, {
    fetch: mockEbayFetch({
      onSearch: (query) => {
        if (query === "BNJ71001") {
          return Array.from({ length: 10 }, (_, index) => ({
            itemId: `v1|rest-BNJ71001-${index}|0`,
            legacyItemId: `legacy-BNJ71001-${index}`,
            title: `Kenny Burrell BNJ71001 LP copy ${index}`,
            categoryName: "Records",
            buyingOptions: ["AUCTION"]
          }));
        }
        return [restAndLegacyRow(query)];
      },
      watchlistItemIds: []
    })
  });

  assert.equal(result.candidatesFound, 11);
  // Default per-record cap (3) leaves room for the other record ID (TBM17) instead of one
  // seller's 10 copies of BNJ71001 consuming the entire run.
  assert.equal(result.added.filter((item) => item.recordId === "BNJ71001").length, 3);
  assert.equal(result.added.filter((item) => item.recordId === "TBM17").length, 1);
  assert.equal(result.skippedPerRecordCap, 7);
});

function legacyIdForQuery(query) {
  return `legacy-${query}`;
}

function restAndLegacyRow(query) {
  return {
    itemId: `v1|rest-${query}|0`,
    legacyItemId: legacyIdForQuery(query),
    title: `${query} live auction`,
    categoryName: "Records",
    buyingOptions: ["AUCTION"]
  };
}

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

function mockEbayFetch({ onSearch, watchlistItemIds, onAdd, failItemIds = [] }) {
  return async (url, init) => {
    const urlText = String(url);

    if (urlText.includes("/identity/v1/oauth2/token")) {
      return Response.json({ access_token: "app-access-token", expires_in: 7200, token_type: "Bearer" });
    }

    if (urlText.includes("/buy/browse/v1/item_summary/search")) {
      const parsedUrl = new URL(urlText);
      const query = parsedUrl.searchParams.get("q");
      const rows = await onSearch(query, parsedUrl);
      return Response.json({ itemSummaries: rows });
    }

    if (urlText.endsWith("/ws/api.dll")) {
      const callName = init.headers["X-EBAY-API-CALL-NAME"];

      if (callName === "GetMyeBayBuying") {
        const items = (watchlistItemIds ?? [])
          .map((itemId) => `<Item><ItemID>${itemId}</ItemID><Title>Watched item</Title></Item>`)
          .join("");
        return new Response(
          `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <WatchList>
    <PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages><TotalNumberOfEntries>${(watchlistItemIds ?? []).length}</TotalNumberOfEntries></PaginationResult>
    <PageNumber>1</PageNumber>
    <ItemArray>${items}</ItemArray>
  </WatchList>
</GetMyeBayBuyingResponse>`,
          { headers: { "Content-Type": "text/xml" } }
        );
      }

      if (callName === "AddToWatchList") {
        const itemIdMatch = init.body.match(/<ItemID>([^<]+)<\/ItemID>/);
        const itemId = itemIdMatch?.[1];
        onAdd?.(itemId);

        if (failItemIds.includes(itemId)) {
          return new Response(
            "<AddToWatchListResponse><Ack>Failure</Ack><Errors><ErrorCode>21916984</ErrorCode></Errors></AddToWatchListResponse>",
            { headers: { "Content-Type": "text/xml" } }
          );
        }

        return new Response("<AddToWatchListResponse><Ack>Success</Ack></AddToWatchListResponse>", {
          headers: { "Content-Type": "text/xml" }
        });
      }
    }

    return new Response("not found", { status: 404 });
  };
}
