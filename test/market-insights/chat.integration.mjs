import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { config as loadDotenv } from "dotenv";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { answerAnalyticsQuestion, queryItems, rankDeals, rankTrends, summarizeItems } from "../../src/market-insights/chat.ts";
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

test("queryItems filters by price range, sorts, and applies the limit", async () => {
  await seedCaptured([
    { itemId: "cheap", title: "Cheap widget", value: 10 },
    { itemId: "mid", title: "Mid widget", value: 50 },
    { itemId: "top", title: "Top widget", value: 90 }
  ]);

  const { items, searchTextIgnored } = await queryItems("local-saja", { minPrice: 20, sortBy: "price", sortDirection: "desc", limit: 5 });
  assert.deepEqual(
    items.map((item) => item.itemId),
    ["top", "mid"]
  );
  assert.equal(searchTextIgnored, false);
});

test("queryItems narrows by case-insensitive title search text", async () => {
  await seedCaptured([
    { itemId: "match", title: "Rare Widget Pro", value: 10 },
    { itemId: "no-match", title: "Something else", value: 10 }
  ]);

  const { items, searchTextIgnored } = await queryItems("local-saja", { searchText: "widget", limit: 20 });
  assert.deepEqual(
    items.map((item) => item.itemId),
    ["match"]
  );
  assert.equal(searchTextIgnored, false);
});

test("queryItems retries without searchText when it matches nothing, and reports that it did", async () => {
  await seedCaptured([
    { itemId: "cheap", title: "Cheap widget", value: 10 },
    { itemId: "expensive", title: "Expensive widget", value: 500 }
  ]);

  const { items, searchTextIgnored } = await queryItems("local-saja", {
    searchText: "record",
    sortBy: "price",
    sortDirection: "desc",
    limit: 5
  });

  assert.equal(searchTextIgnored, true);
  assert.deepEqual(
    items.map((item) => item.itemId),
    ["expensive", "cheap"]
  );
});

test("queryItems does not retry when other filters (not searchText) are why nothing matched", async () => {
  await seedCaptured([{ itemId: "cheap", title: "Cheap widget", value: 10 }]);

  const { items, searchTextIgnored } = await queryItems("local-saja", { minPrice: 1000, limit: 5 });
  assert.equal(items.length, 0);
  assert.equal(searchTextIgnored, false);
});

test("summarizeItems groups by currency and computes count/average/lowest/highest", async () => {
  await seedCaptured([
    { itemId: "gbp-low", title: "GBP low", value: 10, currency: "GBP" },
    { itemId: "gbp-high", title: "GBP high", value: 30, currency: "GBP" },
    { itemId: "usd-only", title: "USD only", value: 100, currency: "USD" }
  ]);

  const summaries = await summarizeItems("local-saja", {});
  const gbp = summaries.find((summary) => summary.currency === "GBP");
  const usd = summaries.find((summary) => summary.currency === "USD");

  assert.equal(gbp?.count, 2);
  assert.equal(gbp?.average, 20);
  assert.equal(gbp?.lowest.itemId, "gbp-low");
  assert.equal(gbp?.highest.itemId, "gbp-high");
  assert.equal(usd?.count, 1);
});

test("rankTrends filters by direction and limits results", async () => {
  await captureMarketPriceRecords(
    [
      { itemId: "up-1", title: "Rising ABC-100 v1", list: "WatchList", currentPrice: { value: 10, currency: "GBP" }, endTime: "2026-01-01T00:00:00.000Z" },
      { itemId: "up-2", title: "Rising ABC-100 v2", list: "WatchList", currentPrice: { value: 20, currency: "GBP" }, endTime: "2026-02-01T00:00:00.000Z" },
      { itemId: "down-1", title: "Falling XYZ-200 v1", list: "WatchList", currentPrice: { value: 20, currency: "GBP" }, endTime: "2026-01-01T00:00:00.000Z" },
      { itemId: "down-2", title: "Falling XYZ-200 v2", list: "WatchList", currentPrice: { value: 10, currency: "GBP" }, endTime: "2026-02-01T00:00:00.000Z" }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );

  const rising = await rankTrends("local-saja", DEFAULT_MATCHING_PREFERENCES, { direction: "up", limit: 5 });
  assert.equal(rising.length, 1);
  assert.equal(rising[0].relistingGroupId, "criteria:ABC100");

  const falling = await rankTrends("local-saja", DEFAULT_MATCHING_PREFERENCES, { direction: "down", limit: 5 });
  assert.equal(falling.length, 1);
  assert.equal(falling[0].relistingGroupId, "criteria:XYZ200");
});

test("rankDeals never attributes an unwon item's price as a purchase, and ranks by deal vs group average", async () => {
  await captureMarketPriceRecords(
    [
      { itemId: "unwon-a", title: "Widget RANK-500 A", list: "WatchList", currentPrice: { value: 10, currency: "GBP" }, endTime: "2026-01-01T00:00:00.000Z" },
      { itemId: "unwon-b", title: "Widget RANK-500 B", list: "WatchList", currentPrice: { value: 20, currency: "GBP" }, endTime: "2026-02-01T00:00:00.000Z" }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "rank-won",
      title: "Widget RANK-500 C",
      itemPriceAmount: 3,
      currency: "GBP",
      purchasedAt: new Date("2026-03-01T00:00:00.000Z")
    }
  });

  const { deals: best } = await rankDeals("local-saja", DEFAULT_MATCHING_PREFERENCES, { limit: 5 });
  assert.equal(best.length, 1);
  assert.equal(best[0].wonItemId, "rank-won");
  assert.equal(best[0].paidValue, 3);
});

test("rankDeals sorts deterministically by the requested field, so the model never has to reorder rows itself", async () => {
  await captureMarketPriceRecords(
    [
      { itemId: "sort-unwon-1", title: "Widget SORT-600 A", list: "WatchList", currentPrice: { value: 40, currency: "GBP" }, endTime: "2026-01-01T00:00:00.000Z" },
      { itemId: "sort-unwon-2", title: "Widget SORT-700 A", list: "WatchList", currentPrice: { value: 10, currency: "GBP" }, endTime: "2026-01-01T00:00:00.000Z" }
    ],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await prisma.wonItem.createMany({
    data: [
      {
        userId: "local-saja",
        venue: "ebay",
        venueItemId: "sort-won-cheap",
        title: "Widget SORT-600 B",
        itemPriceAmount: 20,
        currency: "GBP",
        purchasedAt: new Date("2026-02-01T00:00:00.000Z")
      },
      {
        userId: "local-saja",
        venue: "ebay",
        venueItemId: "sort-won-expensive",
        title: "Widget SORT-700 B",
        itemPriceAmount: 90,
        currency: "GBP",
        purchasedAt: new Date("2026-02-01T00:00:00.000Z")
      }
    ]
  });

  const { deals: ascending } = await rankDeals("local-saja", DEFAULT_MATCHING_PREFERENCES, {
    sortBy: "paidValue",
    sortDirection: "asc",
    limit: 5
  });
  assert.deepEqual(
    ascending.map((deal) => deal.wonItemId),
    ["sort-won-cheap", "sort-won-expensive"]
  );

  const { deals: descending } = await rankDeals("local-saja", DEFAULT_MATCHING_PREFERENCES, {
    sortBy: "paidValue",
    sortDirection: "desc",
    limit: 5
  });
  assert.deepEqual(
    descending.map((deal) => deal.wonItemId),
    ["sort-won-expensive", "sort-won-cheap"]
  );
});

test("rankDeals reports a single-sale purchase's own price as its average, not as missing data", async () => {
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "solo-won",
      title: "Widget SOLO-800",
      itemPriceAmount: 50,
      currency: "GBP",
      purchasedAt: new Date("2026-01-01T00:00:00.000Z")
    }
  });

  const { deals } = await rankDeals("local-saja", DEFAULT_MATCHING_PREFERENCES, { limit: 10 });
  const solo = deals.find((deal) => deal.wonItemId === "solo-won");
  assert.ok(solo, "a purchase with no other dated sale in its group must still appear");
  assert.equal(solo.saleCount, 1);
  assert.equal(solo.averageValue, 50);
  assert.equal(solo.differenceValue, 0);
  assert.equal(solo.dealPercent, 0);
});

test("rankDeals narrows by searchText and reports when it matched nothing", async () => {
  await captureMarketPriceRecords(
    [{ itemId: "artist-unwon", title: "Artist Alpha CAT-100 Pressing A", list: "WatchList", currentPrice: { value: 40, currency: "GBP" }, endTime: "2026-01-01T00:00:00.000Z" }],
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
  await prisma.wonItem.create({
    data: {
      userId: "local-saja",
      venue: "ebay",
      venueItemId: "artist-won",
      title: "Artist Alpha CAT-100 Pressing B",
      itemPriceAmount: 10,
      currency: "GBP",
      purchasedAt: new Date("2026-02-01T00:00:00.000Z")
    }
  });

  const { deals: matched, searchTextIgnored: matchedIgnored } = await rankDeals("local-saja", DEFAULT_MATCHING_PREFERENCES, {
    searchText: "Artist Alpha",
    limit: 5
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].wonItemId, "artist-won");
  assert.equal(matchedIgnored, false);

  const { deals: fallback, searchTextIgnored } = await rankDeals("local-saja", DEFAULT_MATCHING_PREFERENCES, {
    searchText: "record",
    limit: 5
  });
  assert.equal(searchTextIgnored, true);
  assert.equal(fallback.length, 1);
});

test("answerAnalyticsQuestion round-trips a tool call into itemIds and never sends the raw item dataset to the model", async () => {
  await seedCaptured([
    { itemId: "cheap", title: "Cheap widget", value: 10 },
    { itemId: "expensive", title: "Expensive widget", value: 500 }
  ]);

  const mock = mockAnthropicFetch([
    {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "query_items",
          input: { sortBy: "price", sortDirection: "desc", limit: 1 }
        }
      ],
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 }
    },
    {
      id: "msg_2",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "Your highest paid item is Expensive widget at 500 GBP." }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 }
    }
  ]);

  const client = new Anthropic({ apiKey: "test-key", fetch: mock.fetch });
  const result = await answerAnalyticsQuestion("local-saja", "what's the highest paid item?", DEFAULT_MATCHING_PREFERENCES, client);

  assert.equal(result.answer, "Your highest paid item is Expensive widget at 500 GBP.");
  assert.deepEqual(result.itemIds, ["expensive"]);

  assert.equal(mock.requests.length, 2);

  // The first request (before any tool has run) must contain only the question and tool
  // schemas — never the user's actual item records.
  const firstRequestBody = JSON.stringify(mock.requests[0].body);
  assert.ok(!firstRequestBody.includes("Cheap widget"));
  assert.ok(!firstRequestBody.includes("Expensive widget"));
  assert.equal(mock.requests[0].body.messages.length, 1);
  assert.equal(mock.requests[0].body.messages[0].content, "what's the highest paid item?");

  // The follow-up request legitimately carries the tool's own (already-filtered) result.
  const secondRequestBody = JSON.stringify(mock.requests[1].body);
  assert.ok(secondRequestBody.includes("Expensive widget"));
});

async function seedCaptured(items) {
  await captureMarketPriceRecords(
    items.map((item) => ({
      itemId: item.itemId,
      title: item.title,
      list: "WatchList",
      currentPrice: { value: item.value, currency: item.currency ?? "GBP" },
      endTime: "2026-01-01T00:00:00.000Z"
    })),
    "local-saja",
    DEFAULT_MATCHING_PREFERENCES,
    prisma
  );
}

function mockAnthropicFetch(scriptedResponses) {
  const requests = [];
  let call = 0;
  return {
    requests,
    fetch: async (url, init) => {
      requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const response = scriptedResponses[call];
      call += 1;
      return Response.json(response);
    }
  };
}
