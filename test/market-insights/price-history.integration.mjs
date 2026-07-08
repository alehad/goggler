import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { config as loadDotenv } from "dotenv";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { captureItems, listCaptureCandidates } from "../../src/market-insights/price-history.ts";
import { captureMarketPriceRecords } from "../../src/persistence/market-price-records.ts";
import { createPrismaClient } from "../../src/persistence/prisma.ts";

loadDotenv({ path: ".env.local" });

let prisma;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
  prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
});

beforeEach(async () => {
  await prisma.marketPriceRecord.deleteMany();
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

test("captureItems only persists requested ids present in a fresh live-fetched ended set", async () => {
  const freshConfig = loadEbayConfig({
    EBAY_ENVIRONMENT: "sandbox",
    EBAY_SANDBOX_CLIENT_ID: "capture-id-filter-client-id",
    EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
    EBAY_SANDBOX_REDIRECT_URI: "runame-value",
    EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
  });

  const result = await captureItems(
    freshConfig,
    "session-access-token",
    "local-saja",
    ["watch-ended", "not-really-ended"],
    DEFAULT_MATCHING_PREFERENCES,
    { fetch: mockEbayFetch() }
  );

  assert.deepEqual(result.captured, ["watch-ended"]);
  assert.deepEqual(result.skipped, ["not-really-ended"]);
  const stored = await prisma.marketPriceRecord.findFirstOrThrow({
    where: { userId: "local-saja", venueItemId: "watch-ended" }
  });
  assert.equal(stored.soldPriceAmount.toNumber(), 88);
});

test("captureItems persists the Browse-resolved native price, not eBay's marketplace-converted price", async () => {
  const freshConfig = loadEbayConfig({
    EBAY_ENVIRONMENT: "sandbox",
    EBAY_SANDBOX_CLIENT_ID: "capture-native-price-client-id",
    EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
    EBAY_SANDBOX_REDIRECT_URI: "runame-value",
    EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
  });

  await captureItems(
    freshConfig,
    "session-access-token",
    "local-saja",
    ["watch-ended"],
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

    return new Response(watchListXml(), { headers: { "Content-Type": "text/xml" } });
  };
}

function watchListXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <WatchList>
    <PaginationResult>
      <TotalNumberOfPages>1</TotalNumberOfPages>
      <TotalNumberOfEntries>1</TotalNumberOfEntries>
    </PaginationResult>
    <PageNumber>1</PageNumber>
    <ItemArray>
      <Item>
        <ItemID>watch-ended</ItemID>
        <Title>Ended watchlist item</Title>
        <ListingDetails><EndTime>2020-01-01T00:00:00.000Z</EndTime></ListingDetails>
        <SellingStatus><CurrentPrice currencyID="GBP">88.00</CurrentPrice></SellingStatus>
      </Item>
    </ItemArray>
  </WatchList>
</GetMyeBayBuyingResponse>`;
}
