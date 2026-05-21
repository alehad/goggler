import type { EbayConfig } from "./config.ts";
import { buildHomeFeed, type HomeFeedWatchlistItem } from "./home-feed.ts";
import type { EbayHistoryResponse } from "./history-response.ts";
import { fetchLiveRelistingCandidates, liveRelistingSearchRequests } from "./live-relisting-discovery.ts";
import {
  DEFAULT_MATCHING_PREFERENCES,
  catalogueIdForTitle,
  relistingGroupForTitle,
  type MatchingPreferences
} from "./matching-preferences.ts";
import { EBAY_BROWSE_SCOPE, getEbayApplicationAccessToken, type EbayApplicationAuthorization } from "./oauth-client.ts";
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
    toWatchlistItem(item, index + 1, groupForHistoryTitle(item.title, matchingPreferences), lostGroups)
  );
  const warnings = [watchList, lostList, wonList].flatMap((page) =>
    page.truncated ? [`${page.list} truncated after ${page.pagesFetched} pages`] : []
  );
  const relistingCandidates = await discoverRelistingCandidates(config, lostItems, wonItems, matchingPreferences, fetchOptions, warnings);
  const homeFeed = buildHomeFeed({
    lostItems,
    wonItems,
    watchlistItems,
    relistingCandidates
  });
  const wonGroups = new Set(wonItems.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value)));

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
    relistingCandidates,
    homeFeed,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

function withRelistingGroups(items: EbayBuyingHistoryItem[], matchingPreferences: MatchingPreferences): EbayBuyingHistoryItem[] {
  return items.map((item) => ({
    ...item,
    relistingGroupId: groupForHistoryTitle(item.title, matchingPreferences)
  }));
}

async function discoverRelistingCandidates(
  config: EbayConfig,
  lostItems: EbayBuyingHistoryItem[],
  wonItems: EbayBuyingHistoryItem[],
  matchingPreferences: MatchingPreferences,
  fetchOptions: { fetch?: typeof fetch },
  warnings: string[]
) {
  if (liveRelistingSearchRequests({ lostItems, wonItems, matchingPreferences }).length === 0) {
    return [];
  }

  try {
    const appToken = await getCachedBrowseApplicationAccessToken(config, fetchOptions);
    return await fetchLiveRelistingCandidates(config, appToken.accessToken, { lostItems, wonItems, matchingPreferences }, fetchOptions);
  } catch {
    warnings.push("Live relisting search unavailable");
    return [];
  }
}

const browseApplicationTokenCache = new Map<string, EbayApplicationAuthorization>();

async function getCachedBrowseApplicationAccessToken(
  config: EbayConfig,
  fetchOptions: { fetch?: typeof fetch }
): Promise<EbayApplicationAuthorization> {
  const cacheKey = `${config.tokenUrl}|${config.clientId}|${EBAY_BROWSE_SCOPE}`;
  const cached = browseApplicationTokenCache.get(cacheKey);
  if (cached && cached.expiresAt.getTime() - 60_000 > Date.now()) {
    return cached;
  }

  const appToken = await getEbayApplicationAccessToken(config, { fetch: fetchOptions.fetch, scope: EBAY_BROWSE_SCOPE });
  browseApplicationTokenCache.set(cacheKey, appToken);
  return appToken;
}

function groupForHistoryTitle(title: string, matchingPreferences: MatchingPreferences): string | undefined {
  const catalogueId = catalogueIdForTitle(title, matchingPreferences.criteriaText);
  return catalogueId ? `criteria:${catalogueId}` : relistingGroupForTitle(title, matchingPreferences);
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
    categoryId: item.categoryId,
    categoryName: item.categoryName,
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
