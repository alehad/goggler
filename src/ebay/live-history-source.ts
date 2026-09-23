import { fetchEbayItemNativePrice } from "./browse-client.ts";
import type { EbayConfig } from "./config.ts";
import { buildHomeFeed, type HomeFeedWatchlistItem } from "./home-feed.ts";
import { rebuildHistoryResponse } from "./history-assembly.ts";
import type { EbayHistoryResponse } from "./history-response.ts";
import { PARTIAL_SNAPSHOT_BATCH_SIZE, type BuyingHistoryStreamEvent } from "./history-stream.ts";
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
  fetchGetOrdersPages,
  EbayTradingApiError,
  type EbayBuyingHistoryItem,
  type EbayBuyerOrdersPages,
  type EbayBuyingListKind,
  type EbayMoney
} from "./trading-client.ts";

const WATCHLIST_PRICE_LOOKUP_CONCURRENCY = 8;
/**
 * GetOrders rejects EntriesPerPage above 100 (eBay error 10007), unlike
 * GetMyeBayBuying which accepts up to 200 — so it can't share the same
 * entriesPerPage value used for WatchList/LostList/WonList.
 */
const GET_ORDERS_MAX_ENTRIES_PER_PAGE = 100;

export type FetchLiveEbayHistoryOptions = {
  fetch?: typeof fetch;
  entriesPerPage?: number;
  maxPagesPerList?: number;
  maxGetOrdersPages?: number;
  getOrdersWindowDays?: number;
  getOrdersWindowEndDaysAgo?: number;
  discoverRelistings?: boolean;
  matchingPreferences?: MatchingPreferences;
  now?: Date;
  onEvent?: (event: BuyingHistoryStreamEvent) => void;
};

export async function fetchLiveEbayHistoryResponse(
  config: EbayConfig,
  accessToken: string,
  options: FetchLiveEbayHistoryOptions = {}
): Promise<EbayHistoryResponse> {
  const entriesPerPage = options.entriesPerPage ?? 200;
  const maxPages = options.maxPagesPerList ?? 10;
  const getOrdersWindowDays = options.getOrdersWindowDays ?? 30;
  const getOrdersWindowEndDaysAgo = options.getOrdersWindowEndDaysAgo ?? 60;
  const matchingPreferences = options.matchingPreferences ?? DEFAULT_MATCHING_PREFERENCES;
  const now = options.now ?? new Date();
  const fetchOptions = { fetch: options.fetch };
  const onEvent = options.onEvent;

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

  const warnings = [watchList, lostList, wonList].flatMap((page) =>
    page.truncated ? [`${page.list} truncated after ${page.pagesFetched} pages`] : []
  );
  const ordersSupplement = await fetchBuyerOrdersSupplement(
    config,
    accessToken,
    {
      entriesPerPage: Math.min(entriesPerPage, GET_ORDERS_MAX_ENTRIES_PER_PAGE),
      maxPages: options.maxGetOrdersPages ?? maxPages,
      now,
      windowDays: getOrdersWindowDays,
      windowEndDaysAgo: getOrdersWindowEndDaysAgo
    },
    fetchOptions,
    warnings
  );
  const mergedWon = mergeWonPurchases(wonList.items, ordersSupplement?.items ?? []);
  const lostItems = withRelistingGroups(lostList.items, matchingPreferences);
  const wonItems = withRelistingGroups(mergedWon.items, matchingPreferences);
  const lostGroups = new Set(lostItems.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value)));
  const activeWatchListItems = watchList.items.filter((item) => isActiveListing(item, now));
  const endedWatchlistItemsBeforeNativePrices = withRelistingGroups(
    watchList.items.filter((item) => !isActiveListing(item, now)),
    matchingPreferences
  );

  /**
   * Builds the full response shape from whatever's known right now — used
   * both for the final return and, when `onEvent` is supplied, for `partial`
   * checkpoint snapshots mid-fetch. Safe to call with not-yet-fully-enriched
   * `watchlistItems`/`endedWatchlistItems`: any item not yet resolved simply
   * carries its live-fetched (non-native) price via the existing
   * `nativePrice ?? item.currentPrice` fallback already used by
   * `toWatchlistItem`/`mergeNativePrices`.
   */
  function assembleResponse(
    watchlistItems: HomeFeedWatchlistItem[],
    endedWatchlistItems: EbayBuyingHistoryItem[],
    relistingCandidates: EbayHistoryResponse["relistingCandidates"]
  ): EbayHistoryResponse {
    const homeFeed = buildHomeFeed({ lostItems, wonItems, watchlistItems, relistingCandidates });
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
      endedWatchlistItems,
      relistingCandidates,
      homeFeed,
      warnings: warnings.length > 0 ? warnings : undefined,
      diagnostics: {
        purchases: {
          wonListCount: wonList.items.length,
          getOrdersCount: ordersSupplement?.items.length,
          mergedWonCount: wonItems.length,
          overlapCount: mergedWon.overlapCount,
          wonListTruncated: wonList.truncated,
          getOrdersTruncated: ordersSupplement?.truncated,
          getOrdersWindowDays,
          getOrdersWindowEndDaysAgo
        }
      }
    };
  }

  const nativePricesTotal = endedWatchlistItemsBeforeNativePrices.length + activeWatchListItems.length;
  let nativePricesCompleted = 0;
  const endedPricesSoFar = new Map<string, EbayMoney | undefined>();
  const activePricesSoFar = new Map<string, EbayMoney | undefined>();

  function reportNativePriceProgress(): void {
    if (!onEvent || nativePricesTotal === 0) {
      return;
    }
    onEvent({ type: "progress", stage: "native_prices", completed: nativePricesCompleted, total: nativePricesTotal });
    if (nativePricesCompleted % PARTIAL_SNAPSHOT_BATCH_SIZE === 0 || nativePricesCompleted === nativePricesTotal) {
      const partialWatchlistItems = activeWatchListItems.map((item, index) =>
        toWatchlistItem(
          item,
          index + 1,
          groupForHistoryTitle(item.title, matchingPreferences),
          lostGroups,
          activePricesSoFar.get(item.itemId)
        )
      );
      const partialEndedWatchlistItems = mergeNativePrices(endedWatchlistItemsBeforeNativePrices, endedPricesSoFar);
      onEvent({ type: "partial", history: assembleResponse(partialWatchlistItems, partialEndedWatchlistItems, []) });
    }
  }

  const endedNativePrices = await fetchNativeWatchlistPrices(config, endedWatchlistItemsBeforeNativePrices, fetchOptions, (item, price) => {
    endedPricesSoFar.set(item.itemId, price);
    nativePricesCompleted += 1;
    reportNativePriceProgress();
  });
  const endedWatchlistItems = mergeNativePrices(endedWatchlistItemsBeforeNativePrices, endedNativePrices);
  const nativeWatchlistPrices = await fetchNativeWatchlistPrices(config, activeWatchListItems, fetchOptions, (item, price) => {
    activePricesSoFar.set(item.itemId, price);
    nativePricesCompleted += 1;
    reportNativePriceProgress();
  });
  const watchlistItems = activeWatchListItems.map((item, index) =>
    toWatchlistItem(
      item,
      index + 1,
      groupForHistoryTitle(item.title, matchingPreferences),
      lostGroups,
      nativeWatchlistPrices.get(item.itemId)
    )
  );
  const relistingCandidates = options.discoverRelistings === false
    ? []
    : await discoverRelistingCandidates(config, lostItems, wonItems, matchingPreferences, fetchOptions, warnings);

  return assembleResponse(watchlistItems, endedWatchlistItems, relistingCandidates);
}

export async function fetchEndedWatchlistItems(
  config: EbayConfig,
  accessToken: string,
  options: FetchLiveEbayHistoryOptions = {}
): Promise<EbayBuyingHistoryItem[]> {
  const entriesPerPage = options.entriesPerPage ?? 200;
  const maxPages = options.maxPagesPerList ?? 10;
  const matchingPreferences = options.matchingPreferences ?? DEFAULT_MATCHING_PREFERENCES;
  const now = options.now ?? new Date();

  const watchList = await fetchGetMyeBayBuyingPages(
    config,
    accessToken,
    { list: "WatchList", entriesPerPage, maxPages },
    { fetch: options.fetch }
  );

  const endedItems = withRelistingGroups(
    watchList.items.filter((item) => !isActiveListing(item, now)),
    matchingPreferences
  );
  const nativePrices = await fetchNativeWatchlistPrices(config, endedItems, { fetch: options.fetch });
  return mergeNativePrices(endedItems, nativePrices);
}

export async function refreshLiveHistoryDerivedData(
  config: EbayConfig,
  history: EbayHistoryResponse,
  matchingPreferences: MatchingPreferences,
  fetchOptions: { fetch?: typeof fetch } = {},
  onEvent?: (event: BuyingHistoryStreamEvent) => void
): Promise<EbayHistoryResponse> {
  if (history.source !== "live") {
    return history;
  }

  const warnings = [...(history.warnings ?? [])];
  const lostGroups = new Set(
    history.lostItems.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value))
  );
  const watchlistItems = history.watchlistItems.map((item) => {
    const relistingGroupId = groupForHistoryTitle(item.title, matchingPreferences);
    const matchedLostItem = relistingGroupId !== undefined && lostGroups.has(relistingGroupId);
    return {
      ...item,
      relistingGroupId: matchedLostItem ? relistingGroupId : undefined,
      matchConfidence: matchedLostItem ? 100 : undefined,
      matchSignals: matchedLostItem ? ["matching preference"] : []
    };
  });
  const relistingCandidates = await discoverRelistingCandidates(
    config,
    history.lostItems,
    history.wonItems,
    matchingPreferences,
    fetchOptions,
    warnings,
    (candidatesSoFar, completed, total) => {
      onEvent?.({ type: "progress", stage: "relistings", completed, total });
      if (completed % PARTIAL_SNAPSHOT_BATCH_SIZE === 0 || completed === total) {
        onEvent?.({
          type: "partial",
          history: rebuildHistoryResponse(history, { watchlistItems, relistingCandidates: candidatesSoFar })
        });
      }
    }
  );

  return {
    ...rebuildHistoryResponse(history, { watchlistItems, relistingCandidates }),
    warnings: warnings.length > 0 ? Array.from(new Set(warnings)) : undefined
  };
}

async function fetchBuyerOrdersSupplement(
  config: EbayConfig,
  accessToken: string,
  input: {
    entriesPerPage: number;
    maxPages: number;
    now: Date;
    windowDays: number;
    windowEndDaysAgo: number;
  },
  fetchOptions: { fetch?: typeof fetch },
  warnings: string[]
): Promise<EbayBuyerOrdersPages | undefined> {
  const createTimeTo = new Date(input.now.getTime() - input.windowEndDaysAgo * 24 * 60 * 60 * 1000);
  const createTimeFrom = new Date(createTimeTo.getTime() - input.windowDays * 24 * 60 * 60 * 1000);

  try {
    const orders = await fetchGetOrdersPages(
      config,
      accessToken,
      {
        createTimeFrom,
        createTimeTo,
        entriesPerPage: input.entriesPerPage,
        maxPages: input.maxPages
      },
      fetchOptions
    );

    if (orders.truncated) {
      warnings.push(`GetOrders truncated after ${orders.pagesFetched} pages`);
    }

    return orders;
  } catch (error) {
    console.warn("GetOrders buyer purchases unavailable", {
      type: error instanceof EbayTradingApiError ? "trading_api_error" : "unexpected_error",
      hasAck: error instanceof EbayTradingApiError && error.ack !== undefined,
      hasStatus: error instanceof EbayTradingApiError && error.status !== undefined,
      errorCodes: error instanceof EbayTradingApiError ? error.errorCodes : undefined
    });
    warnings.push("GetOrders buyer purchases unavailable");
    return undefined;
  }
}

function mergeWonPurchases(
  wonListItems: EbayBuyingHistoryItem[],
  getOrdersItems: EbayBuyingHistoryItem[]
): { items: EbayBuyingHistoryItem[]; overlapCount: number } {
  const byKey = new Map<string, EbayBuyingHistoryItem>();
  let overlapCount = 0;

  for (const item of wonListItems) {
    byKey.set(wonPurchaseKey(item), item);
  }

  for (const item of getOrdersItems) {
    const key = wonPurchaseKey(item);
    const existing = byKey.get(key);

    if (existing) {
      overlapCount += 1;
      byKey.set(key, {
        ...item,
        ...existing,
        currentPrice: existing.currentPrice ?? item.currentPrice,
        endTime: existing.endTime ?? item.endTime,
        sellerUserId: existing.sellerUserId ?? item.sellerUserId,
        conditionDisplayName: existing.conditionDisplayName ?? item.conditionDisplayName,
        categoryId: existing.categoryId ?? item.categoryId,
        categoryName: existing.categoryName ?? item.categoryName,
        imageUrl: existing.imageUrl ?? item.imageUrl,
        itemWebUrl: existing.itemWebUrl ?? item.itemWebUrl
      });
      continue;
    }

    byKey.set(key, item);
  }

  return { items: Array.from(byKey.values()), overlapCount };
}

function wonPurchaseKey(item: EbayBuyingHistoryItem): string {
  if (item.itemId) {
    return `item:${item.itemId}`;
  }

  return [
    item.title.toLocaleLowerCase("en-GB").replace(/\s+/g, " ").trim(),
    item.currentPrice ? `${item.currentPrice.currency}:${item.currentPrice.value}` : "",
    item.endTime ?? ""
  ].join("|");
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
  warnings: string[],
  onSearchDone?: (candidatesSoFar: EbayHistoryResponse["relistingCandidates"], completed: number, total: number) => void
) {
  if (liveRelistingSearchRequests({ lostItems, wonItems, matchingPreferences }).length === 0) {
    return [];
  }

  try {
    const appToken = await getCachedBrowseApplicationAccessToken(config, fetchOptions);
    return await fetchLiveRelistingCandidates(
      config,
      appToken.accessToken,
      { lostItems, wonItems, matchingPreferences },
      { ...fetchOptions, onSearchDone }
    );
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

function mergeNativePrices(
  items: EbayBuyingHistoryItem[],
  nativePrices: Map<string, EbayMoney | undefined>
): EbayBuyingHistoryItem[] {
  return items.map((item) => ({
    ...item,
    currentPrice: nativePrices.get(item.itemId) ?? item.currentPrice
  }));
}

export async function fetchNativeWatchlistPrices(
  config: EbayConfig,
  items: EbayBuyingHistoryItem[],
  fetchOptions: { fetch?: typeof fetch },
  onItemDone?: (item: EbayBuyingHistoryItem, price: EbayMoney | undefined) => void
): Promise<Map<string, EbayMoney | undefined>> {
  const result = new Map<string, EbayMoney | undefined>();
  if (items.length === 0) {
    return result;
  }

  let appToken: EbayApplicationAuthorization;
  try {
    appToken = await getCachedBrowseApplicationAccessToken(config, fetchOptions);
  } catch {
    for (const item of items) {
      onItemDone?.(item, undefined);
    }
    return result;
  }

  await mapWithConcurrency(
    items,
    WATCHLIST_PRICE_LOOKUP_CONCURRENCY,
    async (item) => {
      let price: EbayMoney | undefined;
      try {
        price = await fetchEbayItemNativePrice(config, appToken.accessToken, item.itemId, fetchOptions);
      } catch {
        price = undefined;
      }
      result.set(item.itemId, price);
      return price;
    },
    onItemDone
  );

  return result;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  onItemDone?: (item: T, result: R) => void
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      const item = items[current];
      const result = await fn(item);
      onItemDone?.(item, result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

function toWatchlistItem(
  item: EbayBuyingHistoryItem,
  watchlistPosition: number,
  relistingGroupId: string | undefined,
  lostGroups: Set<string>,
  nativePrice: EbayMoney | undefined
): HomeFeedWatchlistItem {
  const matchedLostItem = relistingGroupId !== undefined && lostGroups.has(relistingGroupId);

  return {
    itemId: item.itemId,
    title: item.title,
    watchlistPosition,
    currentPrice: nativePrice ?? item.currentPrice,
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
