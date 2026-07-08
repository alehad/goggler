import { buildHomeFeed } from "./home-feed.ts";
import type { EbayHistoryResponse } from "./history-response.ts";
import type { EbayBuyingHistoryItem } from "./trading-client.ts";

export function rebuildHistoryResponse(
  history: EbayHistoryResponse,
  input: {
    lostItems?: EbayBuyingHistoryItem[];
    wonItems?: EbayBuyingHistoryItem[];
    watchlistItems?: EbayHistoryResponse["watchlistItems"];
    endedWatchlistItems?: EbayBuyingHistoryItem[];
    relistingCandidates?: EbayHistoryResponse["relistingCandidates"];
  }
): EbayHistoryResponse {
  const lostItems = input.lostItems ?? history.lostItems;
  const wonItems = input.wonItems ?? history.wonItems;
  const watchlistItems = input.watchlistItems ?? history.watchlistItems;
  const endedWatchlistItems = input.endedWatchlistItems ?? history.endedWatchlistItems;
  const relistingCandidates = input.relistingCandidates ?? history.relistingCandidates;
  const homeFeed = buildHomeFeed({
    lostItems,
    wonItems,
    watchlistItems,
    relistingCandidates
  });
  const wonGroups = new Set(wonItems.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value)));

  return {
    ...history,
    counts: {
      ...history.counts,
      lost: lostItems.length,
      won: wonItems.length,
      eventuallyWon: lostItems.filter((item) => item.relistingGroupId && wonGroups.has(item.relistingGroupId)).length,
      neverWon: lostItems.filter((item) => !item.relistingGroupId || !wonGroups.has(item.relistingGroupId)).length,
      watchlistRelistings: homeFeed.counts.watchlistRelistings,
      needsAction: homeFeed.counts.needsAction,
      relistings: homeFeed.counts.relistings
    },
    lostItems,
    wonItems,
    watchlistItems,
    endedWatchlistItems,
    relistingCandidates,
    homeFeed
  };
}
