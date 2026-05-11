import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterLostItemsEventuallyWon,
  filterLostItemsNeverWon,
  mockLostBidItems,
  mockRelistingCandidates,
  mockWatchlistItems,
  mockWonItems
} from "../../src/ebay/buying-history-fixtures.ts";

test("models the target local buying-history scenario", () => {
  assert.equal(mockLostBidItems.length, 10);
  assert.equal(mockWonItems.length, 7);
  assert.equal(filterLostItemsEventuallyWon(mockLostBidItems, mockWonItems).length, 4);
  assert.equal(filterLostItemsNeverWon(mockLostBidItems, mockWonItems).length, 6);
});

test("models the target eBay watchlist scenario", () => {
  assert.equal(mockWatchlistItems.length, 6);
  assert.equal(mockWatchlistItems.filter((item) => item.relistingGroupId).length, 2);
  assert.deepEqual(
    mockWatchlistItems.map((item) => item.watchlistPosition),
    [1, 2, 3, 4, 5, 6]
  );
  assert.equal(mockRelistingCandidates.length, 2);
});

test("marks relisted wins by a shared relisting group instead of reusing eBay item IDs", () => {
  const lostIds = new Set(mockLostBidItems.map((item) => item.itemId));
  const wonIds = new Set(mockWonItems.map((item) => item.itemId));
  const sharedRelistingGroups = filterLostItemsEventuallyWon(mockLostBidItems, mockWonItems).map(
    (item) => item.relistingGroupId
  );

  assert.equal([...wonIds].some((itemId) => lostIds.has(itemId)), false);
  assert.deepEqual(sharedRelistingGroups, [
    "relist-rega-planar-3",
    "relist-naim-nait-5si",
    "relist-linn-kan-walnut",
    "relist-technics-1200-mk2"
  ]);
});
