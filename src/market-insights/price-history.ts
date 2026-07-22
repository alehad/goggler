import type { EbayConfig } from "../ebay/config.ts";
import type { EbayHistoryResponse } from "../ebay/history-response.ts";
import { fetchEndedWatchlistItems } from "../ebay/live-history-source.ts";
import type { MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem, EbayMoney } from "../ebay/trading-client.ts";
import {
  captureMarketPriceRecords,
  listCapturedVenueItemIds,
  listMarketPriceRecordsByGroup
} from "../persistence/market-price-records.ts";
import { listWonItemsForGroup } from "../persistence/won-items.ts";

export type PriceHistoryCandidate = EbayBuyingHistoryItem & { captured: boolean };

export type CaptureResult = {
  captured: string[];
  skipped: string[];
};

export type MatchedSalePoint = {
  venueItemId: string;
  title: string;
  price: EbayMoney;
  endedAt: string | undefined;
  won: boolean;
};

export type MatchedSalesSummary = {
  count: number;
  average: number;
  lowest: { value: number; endedAt: string | undefined };
  highest: { value: number; endedAt: string | undefined };
};

export type MatchedSalesGroupKey = {
  relistingGroupId: string;
  currency: string;
};

/**
 * The only place that knows historical price candidates currently come from
 * ended eBay watchlist items. Callers (API routes, UI data fetching) only
 * ever see this module's exports, so the underlying source can change later
 * (e.g. a commercial Marketplace Insights integration) without touching them.
 */
export async function listCaptureCandidates(
  history: EbayHistoryResponse,
  userId: string
): Promise<PriceHistoryCandidate[]> {
  const endedItems = history.endedWatchlistItems;
  if (endedItems.length === 0) {
    return [];
  }

  const capturedIds = await listCapturedVenueItemIds(
    userId,
    endedItems.map((item) => item.itemId)
  );

  return endedItems.map((item) => ({ ...item, captured: capturedIds.has(item.itemId) }));
}

/**
 * A "matched sale" can come from either the captured price-history table or
 * the user's own Won purchases (even ones never watched, so never captured).
 * This is the only place that merges those two sources.
 */
export async function listMatchedSales(
  userId: string,
  relistingGroupId: string,
  currency: string,
  matchingPreferences: MatchingPreferences
): Promise<MatchedSalePoint[]> {
  const [captured, wonItems] = await Promise.all([
    listMarketPriceRecordsByGroup(userId, relistingGroupId, currency),
    listWonItemsForGroup(userId, relistingGroupId, currency, matchingPreferences)
  ]);

  const wonVenueItemIds = new Set(wonItems.map((won) => won.venueItemId));
  const capturedVenueItemIds = new Set(captured.map((record) => record.venueItemId));

  const points: MatchedSalePoint[] = [
    ...captured.map((record) => ({ ...record, won: wonVenueItemIds.has(record.venueItemId) })),
    ...wonItems
      .filter((won) => !capturedVenueItemIds.has(won.venueItemId))
      .map((won) => ({ ...won, won: true }))
  ];

  return points.sort((a, b) => Date.parse(a.endedAt ?? "") - Date.parse(b.endedAt ?? ""));
}

/**
 * Pure reduction over already-fetched matched sales. The only place that
 * computes count/average/lowest/highest, so both the single-item Analytics
 * view and the batch Purchases-tab summary agree on the same numbers.
 */
export function summarizeMatchedSales(sales: MatchedSalePoint[]): MatchedSalesSummary | undefined {
  if (sales.length === 0) {
    return undefined;
  }

  const lowest = sales.reduce((lowest, sale) => (sale.price.value < lowest.price.value ? sale : lowest));
  const highest = sales.reduce((highest, sale) => (sale.price.value > highest.price.value ? sale : highest));
  const average = sales.reduce((sum, sale) => sum + sale.price.value, 0) / sales.length;

  return {
    count: sales.length,
    average,
    lowest: { value: lowest.price.value, endedAt: lowest.endedAt },
    highest: { value: highest.price.value, endedAt: highest.endedAt }
  };
}

/**
 * Batch counterpart to listMatchedSales for the Purchases tab, where many
 * cards each need their own group's summary in one round trip instead of
 * one matched-sales fetch per card.
 */
export async function listMatchedSalesSummaries(
  userId: string,
  groups: MatchedSalesGroupKey[],
  matchingPreferences: MatchingPreferences
): Promise<Record<string, MatchedSalesSummary | undefined>> {
  const uniqueGroups = new Map(groups.map((group) => [matchedSalesSummaryKey(group), group]));

  const entries = await Promise.all(
    [...uniqueGroups.entries()].map(async ([key, group]) => {
      const sales = await listMatchedSales(userId, group.relistingGroupId, group.currency, matchingPreferences);
      return [key, summarizeMatchedSales(sales)] as const;
    })
  );

  return Object.fromEntries(entries);
}

export function matchedSalesSummaryKey(group: MatchedSalesGroupKey): string {
  return `${group.relistingGroupId}::${group.currency}`;
}

export async function captureItems(
  config: EbayConfig,
  accessToken: string,
  userId: string,
  venueItemIds: string[],
  matchingPreferences: MatchingPreferences,
  options: { fetch?: typeof fetch } = {}
): Promise<CaptureResult> {
  if (venueItemIds.length === 0) {
    return { captured: [], skipped: [] };
  }

  const requestedIds = new Set(venueItemIds);
  const endedItems = await fetchEndedWatchlistItems(config, accessToken, {
    matchingPreferences,
    fetch: options.fetch
  });
  const eligibleItems = endedItems.filter((item) => requestedIds.has(item.itemId));

  const { captured } = await captureMarketPriceRecords(eligibleItems, userId, matchingPreferences);
  const capturedIds = new Set(captured);
  const skipped = venueItemIds.filter((itemId) => !capturedIds.has(itemId));

  return { captured, skipped };
}
