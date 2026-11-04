import { assembleListings } from "./listing-assembly.ts";
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
  const rawLost = input.lostItems ?? history.lostItems;
  const rawWon = input.wonItems ?? history.wonItems;
  const rawWatchlist = input.watchlistItems ?? history.watchlistItems;
  const endedWatchlistItems = input.endedWatchlistItems ?? history.endedWatchlistItems;
  const canonical = assembleListings([...rawWon, ...rawLost, ...rawWatchlist.map(item => ({ ...item, list: "WatchList" as const }))]);
  const wonItems = canonical.filter(item => item.list === "WonList");
  const lostItems = canonical.filter(item => item.list === "LostList");
  const historyIds = new Set([...wonItems, ...lostItems].map(item => item.itemId));
  const watchlistItems = rawWatchlist.filter(item => !historyIds.has(item.itemId));
  const relistingCandidates = (input.relistingCandidates ?? history.relistingCandidates).filter(item => !historyIds.has(item.itemId));
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
      watchlist: watchlistItems.length,
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
