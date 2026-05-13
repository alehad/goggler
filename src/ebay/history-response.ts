import type { HomeFeed, HomeFeedRelistingCandidate, HomeFeedWatchlistItem } from "./home-feed.ts";
import type { EbayBuyingHistoryItem } from "./trading-client.ts";

export type EbayHistoryResponse = {
  source: "fixture" | "live";
  counts: {
    lost: number;
    won: number;
    eventuallyWon: number;
    neverWon: number;
    watchlist: number;
    watchlistRelistings: number;
    needsAction: number;
    relistings: number;
  };
  lostItems: EbayBuyingHistoryItem[];
  wonItems: EbayBuyingHistoryItem[];
  watchlistItems: HomeFeedWatchlistItem[];
  relistingCandidates: HomeFeedRelistingCandidate[];
  homeFeed: HomeFeed;
  warnings?: string[];
};
