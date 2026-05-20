import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import {
  boundedMarketQuery,
  fetchEbayMarketHistory
} from "../../src/ebay/marketplace-insights-client.ts";

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "production",
  EBAY_PRODUCTION_CLIENT_ID: "client-id",
  EBAY_PRODUCTION_CLIENT_SECRET: "client-secret",
  EBAY_PRODUCTION_REDIRECT_URI: "runame-value",
  EBAY_PRODUCTION_OAUTH_SCOPES: "scope-one",
  GOGGLER_AUTH_SECRET: "test-auth-secret-placeholder-32-chars"
});

test("fetches and normalizes 90-day marketplace sales history", async () => {
  let request;
  const history = await fetchEbayMarketHistory(config, "app-token", "TBM2005", {
    fetch: async (url, init) => {
      request = { url: new URL(String(url)), init };
      return jsonResponse({
        itemSales: [
          {
            itemId: "sale-2",
            title: "Record TBM2005",
            price: { value: "42", currency: "USD" },
            itemEndDate: "2026-05-10T10:00:00.000Z",
            image: { imageUrl: "https://i.ebayimg.com/images/g/example/s-l500.jpg" },
            itemWebUrl: "https://www.ebay.com/itm/sale-2"
          },
          {
            itemId: "sale-1",
            title: "Record TBM2005",
            price: { value: "20", currency: "USD" },
            itemEndDate: "2026-04-10T10:00:00.000Z"
          },
          {
            itemId: "ignored",
            title: "Missing price",
            itemEndDate: "2026-04-10T10:00:00.000Z"
          }
        ]
      });
    }
  });

  assert.equal(request.url.origin + request.url.pathname, "https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search");
  assert.equal(request.url.searchParams.get("q"), "TBM2005");
  assert.equal(request.url.searchParams.get("limit"), "50");
  assert.equal(request.init.headers.Authorization, "Bearer app-token");
  assert.equal(request.init.headers["X-EBAY-C-MARKETPLACE-ID"], "EBAY_GB");
  assert.equal(history.lookbackDays, 90);
  assert.deepEqual(history.sales.map((sale) => sale.itemId), ["sale-1", "sale-2"]);
  assert.deepEqual(history.stats.lowest, { value: 20, currency: "USD" });
  assert.deepEqual(history.stats.median, { value: 31, currency: "USD" });
  assert.deepEqual(history.stats.highest, { value: 42, currency: "USD" });
});

test("bounds marketplace search queries", () => {
  assert.equal(boundedMarketQuery("  TBM\u00002005   Blue Note  "), "TBM 2005 Blue Note");
  assert.equal(boundedMarketQuery("x".repeat(130)).length, 120);
});

test("rejects untrusted marketplace insights endpoints", async () => {
  await assert.rejects(
    () =>
      fetchEbayMarketHistory(
        { ...config, marketplaceInsightsApiUrl: "https://example.com/buy/marketplace_insights/v1_beta/item_sales/search" },
        "app-token",
        "TBM2005"
      ),
    /not trusted/
  );
});

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" }
  });
}
