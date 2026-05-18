import type { EbayConfig } from "./config.ts";
import { buildHomeFeed, type HomeFeedWatchlistItem } from "./home-feed.ts";
import type { EbayHistoryResponse } from "./history-response.ts";
import {
  DEFAULT_MATCHING_PREFERENCES,
  relistingGroupForTitle,
  type MatchingPreferences
} from "./matching-preferences.ts";
import {
  fetchGetMyeBayBuyingPages,
  type EbayBuyingHistoryItem,
  type EbayBuyingListKind
} from "./trading-client.ts";

export type FetchLiveEbayHistoryOptions = {
  fetch?: typeof fetch;
  entriesPerPage?: number;
  maxPagesPerList?: number;
  matchingPreferences?: MatchingPreferences;
  now?: Date;
};

export async function fetchLiveEbayHistoryResponse(
  config: EbayConfig,
  accessToken: string,
  options: FetchLiveEbayHistoryOptions = {}
): Promise<EbayHistoryResponse> {
  const entriesPerPage = options.entriesPerPage ?? 50;
  const maxPages = options.maxPagesPerList ?? 3;
  const matchingPreferences = options.matchingPreferences ?? DEFAULT_MATCHING_PREFERENCES;
  const now = options.now ?? new Date();
  const fetchOptions = { fetch: options.fetch };

  const [watchList, lostList, wonList] = await Promise.all(
    (["WatchList", "LostList", "WonList"] satisfies EbayBuyingListKind[]).map((list) =>
      fetchGetMyeBayBuyingPages(
        config,
        accessToken,
        {
          list,
          entriesPerPage,
          maxPages
        },
        fetchOptions
      )
    )
  );

  const lostItems = withRelistingGroups(lostList.items, matchingPreferences);
  const wonItems = withRelistingGroups(wonList.items, matchingPreferences);
  const lostGroups = new Set(lostItems.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value)));
  const activeWatchListItems = watchList.items.filter((item) => isActiveListing(item, now));
  const watchlistItems = activeWatchListItems.map((item, index) =>
    toWatchlistItem(item, index + 1, relistingGroupForTitle(item.title, matchingPreferences), lostGroups)
  );
  const homeFeed = buildHomeFeed({
    lostItems,
    wonItems,
    watchlistItems,
    relistingCandidates: []
  });
  const wonGroups = new Set(wonItems.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value)));
  const warnings = [watchList, lostList, wonList].flatMap((page) =>
    page.truncated ? [`${page.list} truncated after ${page.pagesFetched} pages`] : []
  );

  return {
    source: "live",
    counts: {
      lost: lostItems.length,
      won: wonItems.length,
      eventuallyWon: lostItems.filter((item) => item.relistingGroupId && wonGroups.has(item.relistingGroupId)).length,
      neverWon: lostItems.filter((item) => !item.relistingGroupId || !wonGroups.has(item.relistingGroupId)).length,
      watchlist: watchlistItems.length,
      watchlistRelistings: homeFeed.counts.watchlistRelistings,
      needsAction: homeFeed.counts.needsAction,
      relistings: homeFeed.counts.relistings
    },
    lostItems,
    wonItems,
    watchlistItems,
    relistingCandidates: [],
    homeFeed,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

function withRelistingGroups(items: EbayBuyingHistoryItem[], matchingPreferences: MatchingPreferences): EbayBuyingHistoryItem[] {
  return items.map((item) => ({
    ...item,
    relistingGroupId: relistingGroupForTitle(item.title, matchingPreferences)
  }));
}

function toWatchlistItem(
  item: EbayBuyingHistoryItem,
  watchlistPosition: number,
  relistingGroupId: string | undefined,
  lostGroups: Set<string>
): HomeFeedWatchlistItem {
  const matchedLostItem = relistingGroupId !== undefined && lostGroups.has(relistingGroupId);

  return {
    itemId: item.itemId,
    title: item.title,
    watchlistPosition,
    currentPrice: item.currentPrice ?? { value: 0, currency: "GBP" },
    endsAt: item.endTime,
    sellerUserId: item.sellerUserId,
    conditionDisplayName: item.conditionDisplayName,
    imageUrl: item.imageUrl,
    itemWebUrl: item.itemWebUrl,
    relistingGroupId: matchedLostItem ? relistingGroupId : undefined,
    matchConfidence: matchedLostItem ? 100 : undefined,
    matchSignals: matchedLostItem ? ["matching preference"] : []
  };
}

function isActiveListing(item: EbayBuyingHistoryItem, now: Date): boolean {
  if (!item.endTime) {
    return false;
  }

  const endTime = Date.parse(item.endTime);
  return Number.isFinite(endTime) && endTime > now.getTime();
}
