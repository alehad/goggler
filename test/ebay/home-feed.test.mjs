import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mockLostBidItems,
  mockRelistingCandidates,
  mockWatchlistItems,
  mockWonItems
} from "../../src/ebay/buying-history-fixtures.ts";
import { buildHomeFeed, filterHomeFeedRows } from "../../src/ebay/home-feed.ts";

test("builds Home feed with eBay watchlist items first in watchlist order", () => {
  const feed = buildFixtureFeed();

  assert.equal(feed.counts.watchlist, 6);
  assert.equal(feed.counts.watchlistRelistings, 2);
  assert.equal(feed.counts.needsAction, 2);
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
  assert.equal(needsActionRows.every((row) => row.tags.includes("Not watched")), true);
});

test("filters resolved and never-won Home rows", () => {
  const feed = buildFixtureFeed();

  assert.equal(filterHomeFeedRows(feed.rows, "resolved").length, 4);
  assert.equal(filterHomeFeedRows(feed.rows, "neverWon").length, 6);
  assert.equal(filterHomeFeedRows(feed.rows, "relistings").length, 4);
});

function buildFixtureFeed() {
  return buildHomeFeed({
    lostItems: mockLostBidItems,
    wonItems: mockWonItems,
    watchlistItems: mockWatchlistItems,
    relistingCandidates: mockRelistingCandidates
  });
}
