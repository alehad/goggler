import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mockLostBidItems,
  mockRelistingCandidates,
  mockWatchlistItems,
  mockWonItems
} from "../../src/ebay/buying-history-fixtures.ts";
import { buildHomeFeed, filterHomeFeedRows, searchHomeFeedRows } from "../../src/ebay/home-feed.ts";

test("builds Home feed with eBay watchlist items first in watchlist order", () => {
  const feed = buildFixtureFeed();

  assert.equal(feed.counts.watchlist, 6);
  assert.equal(feed.counts.watchlistRelistings, 2);
  assert.equal(feed.counts.needsAction, 2);
  assert.equal(feed.counts.won, 7);
  assert.equal(feed.ebayRows.every((row) => row.modelList === "ebay"), true);
  assert.equal(feed.relistingRows.every((row) => row.modelList === "relisting_candidate"), true);
  assert.equal(feed.rows.slice(0, 6).every((row) => row.section === "watchlist"), true);
  assert.deepEqual(
    feed.rows.slice(0, 6).map((row) => row.sourceItemId),
    mockWatchlistItems.map((item) => item.itemId)
  );
});

test("tags watchlist items independently from previous bidding history", () => {
  const feed = buildFixtureFeed();
  const watchlistRows = filterHomeFeedRows(feed.rows, "onWatchlist");

  assert.equal(watchlistRows.length, 6);
  assert.equal(watchlistRows.filter((row) => row.tags.includes("Relisting candidate")).length, 2);
  assert.equal(watchlistRows.filter((row) => !row.tags.includes("Lost bid")).length, 4);
});

test("filters relisted items that are not already on the eBay watchlist as needs action", () => {
  const feed = buildFixtureFeed();
  const needsActionRows = filterHomeFeedRows(feed.rows, "needsAction");

  assert.equal(needsActionRows.length, 2);
  assert.equal(needsActionRows.every((row) => row.actions.includes("add_to_watchlist")), true);
  assert.equal(needsActionRows.every((row) => row.actions.includes("open_on_ebay")), true);
  assert.equal(needsActionRows.every((row) => row.itemWebUrl?.startsWith("https://www.ebay.co.uk/itm/")), true);
  assert.equal(needsActionRows.every((row) => row.tags.includes("Not watched")), true);
});

test("tags active rows by listing format when buying options are available", () => {
  const feed = buildHomeFeed({
    lostItems: mockLostBidItems,
    wonItems: mockWonItems,
    watchlistItems: [],
    relistingCandidates: [
      { ...mockRelistingCandidates[0], matchSignals: ["AUCTION"] },
      { ...mockRelistingCandidates[1], matchSignals: ["FIXED_PRICE"] }
    ]
  });

  const needsActionRows = filterHomeFeedRows(feed.rows, "needsAction");
  assert.equal(needsActionRows.some((row) => row.tags.includes("Auction")), true);
  assert.equal(needsActionRows.some((row) => row.tags.includes("Buy now")), true);
});

test("filters relistings by listing format", () => {
  const feed = buildHomeFeed({
    lostItems: mockLostBidItems,
    wonItems: mockWonItems,
    watchlistItems: [],
    relistingCandidates: [
      { ...mockRelistingCandidates[0], matchSignals: ["AUCTION"] },
      { ...mockRelistingCandidates[1], matchSignals: ["FIXED_PRICE"] }
    ]
  });

  const allRelistings = filterHomeFeedRows(feed.rows, "relistings");
  const auctionRelistings = filterHomeFeedRows(feed.rows, "relistings", "auction");
  const buyNowRelistings = filterHomeFeedRows(feed.rows, "relistings", "buyNow");
  const allRows = filterHomeFeedRows(feed.rows, "all", "auction");

  assert.equal(allRelistings.length, 2);
  assert.equal(auctionRelistings.length, 1);
  assert.equal(auctionRelistings[0].tags.includes("Auction"), true);
  assert.equal(buyNowRelistings.length, 1);
  assert.equal(buyNowRelistings[0].tags.includes("Buy now"), true);
  assert.equal(allRows.length, feed.rows.length);
});

test("omits eBay open action when an active row has no trusted item URL", () => {
  const feed = buildHomeFeed({
    lostItems: mockLostBidItems,
    wonItems: mockWonItems,
    watchlistItems: mockWatchlistItems.map((item) => ({ ...item, itemWebUrl: undefined })),
    relistingCandidates: mockRelistingCandidates.map((item) => ({ ...item, itemWebUrl: undefined }))
  });

  assert.equal(feed.rows.filter((row) => row.actions.includes("open_on_ebay")).length, 0);
});

test("filters won and never-won Home rows", () => {
  const feed = buildFixtureFeed();

  assert.equal(filterHomeFeedRows(feed.rows, "won").length, 7);
  assert.equal(filterHomeFeedRows(feed.rows, "neverWon").length, 6);
  assert.equal(filterHomeFeedRows(feed.rows, "relistings").length, 2);
  assert.equal(feed.rows.filter((row) => row.section === "resolved").length, 4);
});

test("keeps never-won eBay history separate from relisting candidates", () => {
  const feed = buildHomeFeed({
    lostItems: mockLostBidItems,
    wonItems: mockWonItems,
    watchlistItems: [],
    relistingCandidates: mockRelistingCandidates
  });

  const neverWonRows = filterHomeFeedRows(feed.rows, "neverWon");
  const relistingRows = filterHomeFeedRows(feed.rows, "relistings");

  assert.equal(neverWonRows.length, 6);
  assert.equal(neverWonRows.every((row) => row.modelList === "ebay" && row.section === "unresolved"), true);
  assert.equal(relistingRows.every((row) => row.modelList === "relisting_candidate"), true);
});

test("preserves never-won max bid and final sold price currencies", () => {
  const feed = buildHomeFeed({
    lostItems: [
      {
        ...mockLostBidItems[4],
        currentPrice: { value: 51, currency: "USD" },
        maxBid: { value: 47, currency: "USD" }
      }
    ],
    wonItems: [],
    watchlistItems: [],
    relistingCandidates: []
  });

  const neverWonRow = filterHomeFeedRows(feed.rows, "neverWon")[0];
  assert.deepEqual(neverWonRow.maxBid, { value: 47, currency: "USD" });
  assert.deepEqual(neverWonRow.currentPrice, { value: 51, currency: "USD" });
  assert.deepEqual(neverWonRow.originalLostPrice, { value: 51, currency: "USD" });
});

test("carries won timestamps only onto won Home rows", () => {
  const feed = buildFixtureFeed();
  const wonRow = feed.rows.find((row) => row.section === "won");

  assert.equal(wonRow?.wonAt, mockWonItems[0].endTime);
  assert.equal(feed.rows.filter((row) => row.section !== "won").every((row) => row.wonAt === undefined), true);
});

test("preserves thumbnails for all Home feed item classes", () => {
  const feed = buildFixtureFeed();
  const watchlistRow = feed.rows.find((row) => row.sourceItemId === "sandbox-watch-001");
  const needsActionRow = feed.rows.find((row) => row.sourceItemId === "sandbox-candidate-001");
  const wonRow = feed.rows.find((row) => row.sourceItemId === "sandbox-won-001");
  const unresolvedRow = feed.rows.find((row) => row.section === "unresolved");
  const resolvedRow = feed.rows.find((row) => row.section === "resolved");

  assert.match(watchlistRow?.imageUrl ?? "", /watchlist-1\.jpg$/);
  assert.match(needsActionRow?.imageUrl ?? "", /sandbox-candidate-001\.jpg$/);
  assert.match(wonRow?.imageUrl ?? "", /sandbox-won-001\.jpg$/);
  assert.match(unresolvedRow?.imageUrl ?? "", /sandbox-lost-/);
  assert.match(resolvedRow?.imageUrl ?? "", /sandbox-lost-/);
});

test("searches loaded Home feed rows across titles and status tags", () => {
  const feed = buildFixtureFeed();

  const watchlistResults = searchHomeFeedRows(feed.rows, "watchlist");
  const relistingResults = searchHomeFeedRows(feed.rows, "relisting candidate");
  const neverWonResults = searchHomeFeedRows(feed.rows, "never won");
  const titleResults = searchHomeFeedRows(feed.rows, "Quad");

  assert.equal(watchlistResults.every((row) => row.tags.includes("On eBay watchlist")), true);
  assert.equal(relistingResults.every((row) => row.tags.includes("Relisting candidate")), true);
  assert.equal(neverWonResults.every((row) => row.tags.includes("Never won")), true);
  assert.ok(titleResults.length > 0);
  assert.equal(searchHomeFeedRows(feed.rows, "no such record").length, 0);
});

function buildFixtureFeed() {
  return buildHomeFeed({
    lostItems: mockLostBidItems,
    wonItems: mockWonItems,
    watchlistItems: mockWatchlistItems,
    relistingCandidates: mockRelistingCandidates
  });
}
