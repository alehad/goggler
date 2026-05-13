import type { EbayConfig } from "./config.ts";
import { buildHomeFeed, type HomeFeedWatchlistItem } from "./home-feed.ts";
import type { EbayHistoryResponse } from "./history-response.ts";
import {
  fetchGetMyeBayBuyingPages,
  type EbayBuyingHistoryItem,
  type EbayBuyingListKind
} from "./trading-client.ts";

export type FetchLiveEbayHistoryOptions = {
  fetch?: typeof fetch;
  entriesPerPage?: number;
  maxPagesPerList?: number;
};

export async function fetchLiveEbayHistoryResponse(
  config: EbayConfig,
  accessToken: string,
  options: FetchLiveEbayHistoryOptions = {}
): Promise<EbayHistoryResponse> {
  const entriesPerPage = options.entriesPerPage ?? 50;
  const maxPages = options.maxPagesPerList ?? 3;
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

  const lostItems = withTitleRelistingGroups(lostList.items);
  const wonItems = withTitleRelistingGroups(wonList.items);
  const lostGroups = new Set(lostItems.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value)));
  const watchlistItems = watchList.items.map((item, index) =>
    toWatchlistItem(item, index + 1, lostGroups.has(titleRelistingGroup(item.title)))
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

function withTitleRelistingGroups(items: EbayBuyingHistoryItem[]): EbayBuyingHistoryItem[] {
  return items.map((item) => ({
    ...item,
    relistingGroupId: titleRelistingGroup(item.title)
  }));
}

function toWatchlistItem(
  item: EbayBuyingHistoryItem,
  watchlistPosition: number,
  matchedLostItem: boolean
): HomeFeedWatchlistItem {
  return {
    itemId: item.itemId,
    title: item.title,
    watchlistPosition,
    currentPrice: item.currentPrice ?? { value: 0, currency: "GBP" },
    endsAt: item.endTime,
    sellerUserId: item.sellerUserId,
    conditionDisplayName: item.conditionDisplayName,
    relistingGroupId: matchedLostItem ? titleRelistingGroup(item.title) : undefined,
    matchConfidence: matchedLostItem ? 100 : undefined,
    matchSignals: matchedLostItem ? ["exact title match"] : []
  };
}

function titleRelistingGroup(title: string): string {
  return `title:${title.trim().toLocaleLowerCase("en-GB").replace(/\s+/g, " ")}`;
}
