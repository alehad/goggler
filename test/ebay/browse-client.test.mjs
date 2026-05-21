import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import { fetchEbayBrowseSearchResponse, boundedBrowseQuery } from "../../src/ebay/browse-client.ts";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "production",
  EBAY_PRODUCTION_CLIENT_ID: "client-id",
  EBAY_PRODUCTION_CLIENT_SECRET: "client-secret",
  EBAY_PRODUCTION_REDIRECT_URI: "runame-value",
  EBAY_PRODUCTION_OAUTH_SCOPES: "scope-one",
  GOGGLER_AUTH_SECRET: "test-auth-secret-placeholder-32-chars"
});

test("fetches and normalizes live eBay Browse search rows", async () => {
  let request;
  const response = await fetchEbayBrowseSearchResponse(config, "app-token", "KENNY BURRELL", {
    matchingPreferences: DEFAULT_MATCHING_PREFERENCES,
    fetch: async (url, init) => {
      request = { url: new URL(String(url)), init };
      return jsonResponse({
        total: 1,
        itemSummaries: [
          {
            itemId: "v1|123|0",
            title: "Kenny Burrell BNJ71001 LP",
            price: { value: "24.50", currency: "GBP" },
            itemEndDate: "2026-05-23T10:00:00.000Z",
            itemWebUrl: "https://www.ebay.co.uk/itm/123",
            image: { imageUrl: "https://i.ebayimg.com/images/g/example/s-l500.jpg" },
            categories: [{ categoryId: "176985", categoryName: "Records" }],
            seller: { username: "record-seller" },
            condition: "Used",
            buyingOptions: ["AUCTION"]
          }
        ]
      });
    }
  });

  assert.equal(request.url.origin + request.url.pathname, "https://api.ebay.com/buy/browse/v1/item_summary/search");
  assert.equal(request.url.searchParams.get("q"), "KENNY BURRELL");
  assert.equal(request.url.searchParams.get("limit"), "50");
  assert.equal(request.url.searchParams.get("filter"), "buyingOptions:{AUCTION|FIXED_PRICE}");
  assert.equal(request.init.headers.Authorization, "Bearer app-token");
  assert.equal(request.init.headers["X-EBAY-C-MARKETPLACE-ID"], "EBAY_GB");
  assert.equal(response.source, "live");
  assert.equal(response.query, "KENNY BURRELL");
  assert.equal(response.total, 1);
  assert.equal(response.rows[0].section, "search_result");
  assert.equal(response.rows[0].title, "Kenny Burrell BNJ71001 LP");
  assert.deepEqual(response.rows[0].currentPrice, { value: 24.5, currency: "GBP" });
  assert.equal(response.rows[0].sellerUserId, "record-seller");
  assert.equal(response.rows[0].categoryId, "176985");
  assert.equal(response.rows[0].categoryName, "Records");
  assert.equal(response.rows[0].imageUrl, "https://i.ebayimg.com/images/g/example/s-l500.jpg");
  assert.equal(response.rows[0].itemWebUrl, "https://www.ebay.co.uk/itm/123");
  assert.equal(response.rows[0].relistingGroupId, "criteria:BNJ71001");
  assert.deepEqual(response.rows[0].tags, ["Live eBay listing"]);
  assert.equal(JSON.stringify(response).includes("app-token"), false);
});

test("can constrain live eBay Browse search to trusted category ids", async () => {
  let requestUrl;
  await fetchEbayBrowseSearchResponse(config, "app-token", "BNJ71001", {
    categoryIds: ["176985", "not-a-category", "176985"],
    matchingPreferences: DEFAULT_MATCHING_PREFERENCES,
    fetch: async (url) => {
      requestUrl = new URL(String(url));
      return jsonResponse({ itemSummaries: [] });
    }
  });

  assert.equal(requestUrl.searchParams.get("category_ids"), "176985");
});

test("drops unsafe live eBay Browse URLs before returning rows", async () => {
  const response = await fetchEbayBrowseSearchResponse(config, "app-token", "KENNY BURRELL", {
    matchingPreferences: DEFAULT_MATCHING_PREFERENCES,
    fetch: async () =>
      jsonResponse({
        itemSummaries: [
          {
            itemId: "v1|123|0",
            title: "Kenny Burrell BNJ71001 LP",
            price: { value: "24.50", currency: "GBP" },
            itemWebUrl: "https://example.test/itm/123",
            image: { imageUrl: "https://localhost/image.jpg" }
          }
        ]
      })
  });

  assert.equal(response.rows[0].itemWebUrl, undefined);
  assert.equal(response.rows[0].imageUrl, undefined);
  assert.deepEqual(response.rows[0].actions, []);
});

test("bounds live Browse search queries", () => {
  assert.equal(boundedBrowseQuery("  KENNY\u0000  BURRELL  "), "KENNY BURRELL");
  assert.equal(boundedBrowseQuery("x".repeat(130)).length, 120);
});

test("rejects untrusted Browse API endpoints", async () => {
  await assert.rejects(
    () =>
      fetchEbayBrowseSearchResponse(
        { ...config, browseApiUrl: "https://example.com/buy/browse/v1/item_summary/search" },
        "app-token",
        "KENNY BURRELL",
        { matchingPreferences: DEFAULT_MATCHING_PREFERENCES }
      ),
    /not trusted/
  );
});

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" }
  });
}
