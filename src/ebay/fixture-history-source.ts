import {
  filterLostItemsEventuallyWon,
  filterLostItemsNeverWon,
  mockEndedWatchlistItems,
  mockLostBidItems,
  mockRelistingCandidates,
  mockWatchlistItems,
  mockWonItems
} from "./buying-history-fixtures.ts";
import { buildHomeFeed } from "./home-feed.ts";
import type { EbayHistoryResponse } from "./history-response.ts";

export function getFixtureHistoryResponse(): EbayHistoryResponse {
  const eventuallyWonLostItems = filterLostItemsEventuallyWon(mockLostBidItems, mockWonItems);
  const neverWonLostItems = filterLostItemsNeverWon(mockLostBidItems, mockWonItems);
  const homeFeed = buildHomeFeed({
    lostItems: mockLostBidItems,
    wonItems: mockWonItems,
    watchlistItems: mockWatchlistItems,
    relistingCandidates: mockRelistingCandidates
  });

  return {
    source: "fixture",
    counts: {
      lost: mockLostBidItems.length,
      won: mockWonItems.length,
      eventuallyWon: eventuallyWonLostItems.length,
      neverWon: neverWonLostItems.length,
      watchlist: mockWatchlistItems.length,
      watchlistRelistings: homeFeed.counts.watchlistRelistings,
      needsAction: homeFeed.counts.needsAction,
      relistings: homeFeed.counts.relistings
    },
    lostItems: mockLostBidItems,
    wonItems: mockWonItems,
    watchlistItems: mockWatchlistItems,
    endedWatchlistItems: mockEndedWatchlistItems,
    relistingCandidates: mockRelistingCandidates,
    homeFeed
  };
}
