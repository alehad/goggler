import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import {
  fetchLiveRelistingCandidates,
  liveRelistingSearchRequests
} from "../../src/ebay/live-relisting-discovery.ts";

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_SANDBOX_CLIENT_ID: "client-id",
  EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
  EBAY_SANDBOX_REDIRECT_URI: "runame-value",
  EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
});

test("derives deduped live relisting searches from unresolved lost record ids", () => {
  const requests = liveRelistingSearchRequests(
    {
      lostItems: [
        historyItem("lost-1", "Blue Note BNJ-71001 promo pressing", "176985"),
        historyItem("lost-2", "Blue Note BNJ71001 second copy", "176985"),
        historyItem("lost-3", "Three Blind Mice TBM2541 Japan LP", "176985"),
        historyItem("lost-4", "No catalogue title")
      ],
      wonItems: [historyItem("won-1", "Later won TBM-2541 copy", "176985")],
      matchingPreferences: DEFAULT_MATCHING_PREFERENCES
    },
    10
  );

  assert.deepEqual(
    requests.map((request) => [request.query, request.relistingGroupId]),
    [["BNJ71001", "criteria:BNJ71001"]]
  );
});

test("fetches matching live Browse listings as relisting candidates", async () => {
  const calls = [];
  const candidates = await fetchLiveRelistingCandidates(
    config,
    "app-token",
    {
      lostItems: [historyItem("lost-1", "Blue Note BNJ-71001 promo pressing", "176985")],
      wonItems: [],
      matchingPreferences: DEFAULT_MATCHING_PREFERENCES
    },
    {
      fetch: async (url, init) => {
        calls.push({
          url: String(url),
          token: init.headers.Authorization
        });
        return Response.json({
          total: 2,
          itemSummaries: [
            {
              itemId: "live-1",
              title: "Blue Note BNJ71001 promo pressing live auction",
              price: { value: "42.00", currency: "GBP" },
              itemWebUrl: "https://www.ebay.co.uk/itm/live-1",
              image: { imageUrl: "https://i.ebayimg.com/images/g/live-1/s-l500.jpg" },
              categories: [{ categoryId: "176985", categoryName: "Records" }],
              buyingOptions: ["AUCTION"]
            },
            {
              itemId: "live-2",
              title: "Blue Note BNJ-71001 toy drone",
              price: { value: "55.00", currency: "GBP" },
              categories: [{ categoryId: "11700", categoryName: "Toys & Games" }],
              buyingOptions: ["FIXED_PRICE"]
            }
          ]
        });
      }
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).searchParams.get("q"), "BNJ71001");
  assert.equal(new URL(calls[0].url).searchParams.get("category_ids"), "176985");
  assert.equal(calls[0].token, "Bearer app-token");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].itemId, "live-1");
  assert.equal(candidates[0].relistingGroupId, "criteria:BNJ71001");
  assert.equal(candidates[0].categoryId, "176985");
  assert.deepEqual(candidates[0].matchSignals, ["record id BNJ71001", "live eBay search", "AUCTION"]);
});

test("uses record category fallback when lost history lacks category data", async () => {
  const candidates = await fetchLiveRelistingCandidates(
    config,
    "app-token",
    {
      lostItems: [historyItem("lost-1", "Blue Note BNJ-71001 promo pressing")],
      wonItems: [],
      matchingPreferences: DEFAULT_MATCHING_PREFERENCES
    },
    {
      fetch: async () =>
        Response.json({
          itemSummaries: [
            {
              itemId: "toy-1",
              title: "1/144 Catering Truck Airport ground vehicles Diorama BNJ-71001",
              price: { value: "12.00", currency: "GBP" },
              categories: [{ categoryId: "2624", categoryName: "Toys & Games" }],
              buyingOptions: ["FIXED_PRICE"]
            },
            {
              itemId: "record-1",
              title: "Blue Note BNJ-71001 promo pressing live auction",
              price: { value: "42.00", currency: "GBP" },
              categories: [{ categoryId: "176985", categoryName: "Vinyl Records" }],
              buyingOptions: ["AUCTION"]
            }
          ]
        })
    }
  );

  assert.deepEqual(candidates.map((candidate) => candidate.itemId), ["record-1"]);
});

function historyItem(itemId, title, categoryId) {
  return {
    itemId,
    title,
    currentPrice: { value: 10, currency: "GBP" },
    categoryId,
    categoryName: categoryId ? "Records" : undefined
  };
}
