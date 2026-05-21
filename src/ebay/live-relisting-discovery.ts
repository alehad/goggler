import type { EbayConfig } from "./config.ts";
import { fetchEbayBrowseSearchResponse } from "./browse-client.ts";
import type { HomeFeedRelistingCandidate } from "./home-feed.ts";
import { catalogueIdForTitle, type MatchingPreferences } from "./matching-preferences.ts";
import type { EbayBuyingHistoryItem } from "./trading-client.ts";

export const DEFAULT_MAX_RELISTING_SEARCHES = 12;
export const DEFAULT_RELISTING_SEARCH_LIMIT = 10;

export type LiveRelistingDiscoveryInput = {
  lostItems: EbayBuyingHistoryItem[];
  wonItems: EbayBuyingHistoryItem[];
  matchingPreferences: MatchingPreferences;
};

export type LiveRelistingSearchRequest = {
  query: string;
  relistingGroupId: string;
  lostItem: EbayBuyingHistoryItem;
};

export async function fetchLiveRelistingCandidates(
  config: EbayConfig,
  appAccessToken: string,
  input: LiveRelistingDiscoveryInput,
  options: {
    fetch?: typeof fetch;
    maxSearches?: number;
    limitPerSearch?: number;
  } = {}
): Promise<HomeFeedRelistingCandidate[]> {
  const requests = liveRelistingSearchRequests(input, options.maxSearches ?? DEFAULT_MAX_RELISTING_SEARCHES);
  const responses: Array<{
    request: LiveRelistingSearchRequest;
    response: Awaited<ReturnType<typeof fetchEbayBrowseSearchResponse>>;
  }> = [];
  for (const request of requests) {
    responses.push({
      request,
      response: await fetchEbayBrowseSearchResponse(config, appAccessToken, request.query, {
        fetch: options.fetch,
        categoryIds: request.lostItem.categoryId ? [request.lostItem.categoryId] : undefined,
        limit: options.limitPerSearch ?? DEFAULT_RELISTING_SEARCH_LIMIT,
        matchingPreferences: input.matchingPreferences
      })
    });
  }

  return responses.flatMap(({ request, response }) =>
    response.rows.flatMap((row): HomeFeedRelistingCandidate[] => {
      if (row.relistingGroupId !== request.relistingGroupId || !row.currentPrice || !row.sourceItemId) {
        return [];
      }

      if (!sameCategory(request.lostItem, row)) {
        return [];
      }

      return [
        {
          candidateId: `${request.query}-${row.sourceItemId}`,
          itemId: row.sourceItemId,
          title: row.title,
          currentPrice: row.currentPrice,
          endsAt: row.endsAt,
          sellerUserId: row.sellerUserId,
          conditionDisplayName: row.conditionDisplayName,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          imageUrl: row.imageUrl,
          itemWebUrl: row.itemWebUrl,
          relistingGroupId: request.relistingGroupId,
          matchConfidence: 95,
          matchSignals: [`record id ${request.query}`, "live eBay search", ...row.matchSignals]
        }
      ];
    })
  );
}

export function liveRelistingSearchRequests(
  input: LiveRelistingDiscoveryInput,
  maxSearches = DEFAULT_MAX_RELISTING_SEARCHES
): LiveRelistingSearchRequest[] {
  if (maxSearches <= 0) {
    return [];
  }

  const wonRecordIds = recordIdsForItems(input.wonItems, input.matchingPreferences.criteriaText);
  const seenRecordIds = new Set<string>();
  const requests: LiveRelistingSearchRequest[] = [];

  for (const lostItem of input.lostItems) {
    const recordId = catalogueIdForTitle(lostItem.title, input.matchingPreferences.criteriaText);
    if (!recordId || wonRecordIds.has(recordId) || seenRecordIds.has(recordId)) {
      continue;
    }

    seenRecordIds.add(recordId);
    requests.push({
      query: recordId,
      relistingGroupId: `criteria:${recordId}`,
      lostItem
    });

    if (requests.length >= maxSearches) {
      break;
    }
  }

  return requests;
}

function recordIdsForItems(items: EbayBuyingHistoryItem[], criteriaText: string): Set<string> {
  return new Set(items.flatMap((item) => catalogueIdForTitle(item.title, criteriaText) ?? []));
}

function sameCategory(lostItem: EbayBuyingHistoryItem, row: { categoryId?: string; categoryName?: string }): boolean {
  if (lostItem.categoryId) {
    return row.categoryId === lostItem.categoryId;
  }

  if (lostItem.categoryName) {
    return normalizedCategoryName(row.categoryName) === normalizedCategoryName(lostItem.categoryName);
  }

  return isRecordCategory(row);
}

function normalizedCategoryName(value: string | undefined): string | undefined {
  return value?.trim().toLocaleLowerCase("en-GB").replace(/\s+/g, " ");
}

function isRecordCategory(row: { categoryId?: string; categoryName?: string }): boolean {
  const categoryName = normalizedCategoryName(row.categoryName);
  return Boolean(categoryName && /\b(vinyl|record|records|lp|lps)\b/.test(categoryName));
}
