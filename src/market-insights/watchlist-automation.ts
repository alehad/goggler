import type { EbayConfig } from "../ebay/config.ts";
import { fetchEbayBrowseSearchResponse } from "../ebay/browse-client.ts";
import type { HomeFeedRow } from "../ebay/home-feed.ts";
import { catalogueIdForTitle, type MatchingPreferences } from "../ebay/matching-preferences.ts";
import { getEbayApplicationAccessToken, EBAY_BROWSE_SCOPE } from "../ebay/oauth-client.ts";
import { sameCategory } from "../ebay/relisting-match.ts";
import { fetchAddToWatchList, fetchGetMyeBayBuyingPages, type EbayBuyingHistoryItem } from "../ebay/trading-client.ts";
import { listAllMarketPriceRecords } from "../persistence/market-price-records.ts";
import { listAllWonItems } from "../persistence/won-items.ts";

export const DEFAULT_MAX_WATCHLIST_ADDS = 20;
export const DEFAULT_SEARCH_CONCURRENCY = 5;
export const DEFAULT_MAX_ADDS_PER_RECORD = 3;

export type WatchlistAutomationCandidate = {
  itemId: string;
  title: string;
  recordId: string;
  currentPrice?: { value: number; currency: string };
  endsAt?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  itemWebUrl?: string;
};

export type WatchlistAutomationFailure = WatchlistAutomationCandidate & { reason: string };

export type WatchlistAutomationResult = {
  recordIdsSearched: number;
  candidatesFound: number;
  alreadyWatched: number;
  skippedPerRecordCap: number;
  added: WatchlistAutomationCandidate[];
  failed: WatchlistAutomationFailure[];
};

export type WatchlistAutomationEvent =
  | { type: "search_started"; recordId: string; completed: number; total: number }
  | { type: "search_completed"; recordId: string; candidatesFound: number; completed: number; total: number }
  | { type: "added"; candidate: WatchlistAutomationCandidate }
  | { type: "already_watched"; candidate: WatchlistAutomationCandidate }
  | { type: "skipped_per_record_cap"; candidate: WatchlistAutomationCandidate }
  | { type: "failed"; candidate: WatchlistAutomationCandidate; reason: string }
  | { type: "done"; result: WatchlistAutomationResult };

export async function discoverAndWatchLiveAuctions(
  config: EbayConfig,
  userId: string,
  userAccessToken: string,
  matchingPreferences: MatchingPreferences,
  options: {
    fetch?: typeof fetch;
    maxSearches?: number;
    maxAdds?: number;
    maxAddsPerRecord?: number;
    searchConcurrency?: number;
    onEvent?: (event: WatchlistAutomationEvent) => void;
  } = {}
): Promise<WatchlistAutomationResult> {
  const maxSearches = options.maxSearches ?? Number.POSITIVE_INFINITY;
  const maxAdds = options.maxAdds ?? DEFAULT_MAX_WATCHLIST_ADDS;
  const maxAddsPerRecord = options.maxAddsPerRecord ?? DEFAULT_MAX_ADDS_PER_RECORD;
  const searchConcurrency = options.searchConcurrency ?? DEFAULT_SEARCH_CONCURRENCY;
  const onEvent = options.onEvent ?? (() => {});

  const [wonItems, historyItems] = await Promise.all([
    listAllWonItems(userId),
    listAllMarketPriceRecords(userId)
  ]);

  const sourceByRecordId = recordIdSources([...wonItems, ...historyItems], matchingPreferences.criteriaText, maxSearches);
  if (sourceByRecordId.size === 0) {
    const emptyResult: WatchlistAutomationResult = {
      recordIdsSearched: 0,
      candidatesFound: 0,
      alreadyWatched: 0,
      skippedPerRecordCap: 0,
      added: [],
      failed: []
    };
    onEvent({ type: "done", result: emptyResult });
    return emptyResult;
  }

  const appToken = await getEbayApplicationAccessToken(config, { fetch: options.fetch, scope: EBAY_BROWSE_SCOPE });

  const recordEntries = [...sourceByRecordId.entries()];
  let searchesCompleted = 0;
  const candidateLists = await mapWithConcurrency(recordEntries, searchConcurrency, async ([recordId, sourceItem]) => {
    onEvent({ type: "search_started", recordId, completed: searchesCompleted, total: recordEntries.length });

    const response = await fetchEbayBrowseSearchResponse(config, appToken.accessToken, recordId, {
      fetch: options.fetch,
      categoryIds: sourceItem.categoryId ? [sourceItem.categoryId] : undefined,
      matchingPreferences,
      buyingOptions: ["AUCTION"]
    });

    const matches = response.rows.flatMap((row) => rowToCandidate(row, recordId, sourceItem) ?? []);
    searchesCompleted += 1;
    onEvent({ type: "search_completed", recordId, candidatesFound: matches.length, completed: searchesCompleted, total: recordEntries.length });
    return matches;
  });
  const candidates = candidateLists.flat();

  const watchlist = await fetchGetMyeBayBuyingPages(config, userAccessToken, { list: "WatchList" }, { fetch: options.fetch });
  const watchedItemIds = new Set(watchlist.items.map((item) => item.itemId));

  const added: WatchlistAutomationCandidate[] = [];
  const failed: WatchlistAutomationFailure[] = [];
  const addedPerRecord = new Map<string, number>();
  let alreadyWatched = 0;
  let skippedPerRecordCap = 0;

  for (const candidate of candidates) {
    if (watchedItemIds.has(candidate.itemId)) {
      alreadyWatched += 1;
      onEvent({ type: "already_watched", candidate });
      continue;
    }
    if (added.length >= maxAdds) {
      break;
    }
    if ((addedPerRecord.get(candidate.recordId) ?? 0) >= maxAddsPerRecord) {
      skippedPerRecordCap += 1;
      onEvent({ type: "skipped_per_record_cap", candidate });
      continue;
    }

    try {
      await fetchAddToWatchList(config, userAccessToken, candidate.itemId, { fetch: options.fetch });
      added.push(candidate);
      addedPerRecord.set(candidate.recordId, (addedPerRecord.get(candidate.recordId) ?? 0) + 1);
      onEvent({ type: "added", candidate });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";
      failed.push({ ...candidate, reason });
      onEvent({ type: "failed", candidate, reason });
    }
  }

  const result: WatchlistAutomationResult = {
    recordIdsSearched: sourceByRecordId.size,
    candidatesFound: candidates.length,
    alreadyWatched,
    skippedPerRecordCap,
    added,
    failed
  };
  onEvent({ type: "done", result });
  return result;
}

function rowToCandidate(row: HomeFeedRow, recordId: string, sourceItem: EbayBuyingHistoryItem): WatchlistAutomationCandidate | undefined {
  if (row.relistingGroupId !== `criteria:${recordId}` || !row.legacyItemId) {
    return undefined;
  }
  if (!sameCategory(sourceItem, row)) {
    return undefined;
  }

  return {
    itemId: row.legacyItemId,
    title: row.title,
    recordId,
    currentPrice: row.currentPrice,
    endsAt: row.endsAt,
    sellerUserId: row.sellerUserId,
    conditionDisplayName: row.conditionDisplayName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    imageUrl: row.imageUrl,
    itemWebUrl: row.itemWebUrl
  };
}

function recordIdSources(
  items: EbayBuyingHistoryItem[],
  criteriaText: string,
  maxSearches: number
): Map<string, EbayBuyingHistoryItem> {
  const sources = new Map<string, EbayBuyingHistoryItem>();
  for (const item of items) {
    if (sources.size >= maxSearches) {
      break;
    }

    const recordId = catalogueIdForTitle(item.title, criteriaText);
    if (!recordId || sources.has(recordId)) {
      continue;
    }

    sources.set(recordId, item);
  }

  return sources;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, run));
  return results;
}
