import type { EbayConfig } from "../ebay/config.ts";
import type { EbayHistoryResponse } from "../ebay/history-response.ts";
import { fetchNativeWatchlistPrices } from "../ebay/live-history-source.ts";
import { catalogueIdForTitle, relistingGroupForTitle, type MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem, EbayMoney } from "../ebay/trading-client.ts";
import {
  captureMarketPriceRecords,
  listAllMarketPriceRecords,
  listCapturedVenueItemIds,
  listMarketPriceRecordsByGroup
} from "../persistence/market-price-records.ts";
import { listAllWonItems, listWonItemsForGroup } from "../persistence/won-items.ts";

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
 *
 * Returns the union of eBay's live watchlist fetch (ended items) and every
 * MarketPriceRecord already captured for this user — the same
 * "persisted history outlives what eBay's live fetch currently returns"
 * pattern already used for WonItem, so a captured item stays visible even
 * after it drops out of eBay's live watchlist.
 */
export async function listCaptureCandidates(
  history: EbayHistoryResponse,
  userId: string
): Promise<PriceHistoryCandidate[]> {
  const liveEndedItems = history.endedWatchlistItems;
  const liveIds = new Set(liveEndedItems.map((item) => item.itemId));

  const [capturedIds, allCaptured] = await Promise.all([
    listCapturedVenueItemIds(
      userId,
      liveEndedItems.map((item) => item.itemId)
    ),
    listAllMarketPriceRecords(userId)
  ]);

  const liveCandidates: PriceHistoryCandidate[] = liveEndedItems.map((item) => ({
    ...item,
    captured: capturedIds.has(item.itemId)
  }));

  const historicalOnlyCandidates: PriceHistoryCandidate[] = allCaptured
    .filter((record) => !liveIds.has(record.itemId))
    .map((record) => ({ ...record, captured: true }));

  return [...liveCandidates, ...historicalOnlyCandidates];
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

  const lowest = sales.reduce((lowest, sale) => (sale.price.value <= lowest.price.value ? sale : lowest));
  const highest = sales.reduce((highest, sale) => (sale.price.value >= highest.price.value ? sale : highest));
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

type RelistingGroupPoint = {
  value: number;
  currency: string;
  endedAt: string;
  title: string;
  itemId: string;
  won: boolean;
};

export type GroupTrend = {
  relistingGroupId: string;
  title: string;
  currency: string;
  saleCount: number;
  earliest: { value: number; endedAt: string; itemId: string; won: boolean };
  latest: { value: number; endedAt: string; itemId: string; won: boolean };
  percentChange: number;
};

export type GroupDeal = {
  relistingGroupId: string;
  title: string;
  currency: string;
  // How many dated sales the averageValue is drawn from. When this is 1, the "average" is just
  // the user's own purchase — mathematically valid (the average of one value is that value),
  // but not an independent market reference: callers should say so (e.g. "based on 1 sale")
  // rather than imply the same confidence as a multi-sale average.
  saleCount: number;
  wonItemId: string;
  paidValue: number;
  paidEndedAt: string;
  averageValue: number;
  differenceValue: number;
  dealPercent: number;
};

/**
 * Groups every won/captured sale the user has across their whole history by
 * relisting group + currency, tagging each point with whether it was actually
 * won. Mirrors the same matching-preferences-based grouping already used
 * privately inside won-items.ts and market-price-records.ts, computed here
 * directly since listAllWonItems doesn't carry a persisted relistingGroupId
 * the way listAllMarketPriceRecords does.
 */
async function groupSalesByRelistingGroup(
  userId: string,
  matchingPreferences: MatchingPreferences
): Promise<Map<string, RelistingGroupPoint[]>> {
  const [wonItems, capturedItems] = await Promise.all([
    listAllWonItems(userId),
    listAllMarketPriceRecords(userId)
  ]);

  const wonItemIds = new Set(wonItems.map((item) => item.itemId));
  // A listing that was captured and later won carries the same venueItemId in both tables —
  // without this filter it would be counted as two separate sale points (inflating saleCount,
  // skewing averageValue, and producing duplicate rows), when it's really one real-world sale.
  // The WonItem copy is kept since it's the authoritative purchase record.
  const capturedItemsExcludingWon = capturedItems.filter((item) => !wonItemIds.has(item.itemId));
  const grouped = new Map<string, RelistingGroupPoint[]>();

  for (const item of [...wonItems, ...capturedItemsExcludingWon]) {
    const groupId = groupForHistoryTitle(item.title, matchingPreferences);
    if (!groupId || !item.currentPrice || !item.endTime) {
      continue;
    }

    const key = `${groupId}::${item.currentPrice.currency}`;
    const points = grouped.get(key) ?? [];
    points.push({
      value: item.currentPrice.value,
      currency: item.currentPrice.currency,
      endedAt: item.endTime,
      title: item.title,
      itemId: item.itemId,
      won: wonItemIds.has(item.itemId)
    });
    grouped.set(key, points);
  }

  return grouped;
}

function relistingGroupIdFromKey(key: string): string {
  return key.slice(0, key.lastIndexOf("::"));
}

/**
 * Ranks how each relisting group's price has moved from its earliest to its
 * latest dated point. Note that the earliest/latest point is not necessarily
 * something the user won — it's just the chronologically first/last dated
 * sale in that group, which may be an unwon watchlist item that simply ended
 * at that price. Each point's `won` field says which is which; callers must
 * not describe a non-won point as something the user paid or purchased.
 */
export async function computeGroupTrends(
  userId: string,
  matchingPreferences: MatchingPreferences
): Promise<GroupTrend[]> {
  const grouped = await groupSalesByRelistingGroup(userId, matchingPreferences);

  const trends: GroupTrend[] = [];
  for (const [key, points] of grouped) {
    if (points.length < 2) {
      continue;
    }

    const sorted = [...points].sort((a, b) => Date.parse(a.endedAt) - Date.parse(b.endedAt));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    if (earliest.value === 0) {
      continue;
    }

    trends.push({
      relistingGroupId: relistingGroupIdFromKey(key),
      title: latest.title,
      currency: latest.currency,
      saleCount: sorted.length,
      earliest: { value: earliest.value, endedAt: earliest.endedAt, itemId: earliest.itemId, won: earliest.won },
      latest: { value: latest.value, endedAt: latest.endedAt, itemId: latest.itemId, won: latest.won },
      percentChange: ((latest.value - earliest.value) / earliest.value) * 100
    });
  }

  return trends;
}

/**
 * For each of the user's own won purchases, compares the price they actually
 * paid against the average price across every dated sale (won or not) in
 * that same relisting group — i.e. how good a deal that specific purchase
 * was relative to what the item typically sells for. This is a distinct
 * question from computeGroupTrends (price movement over time): a purchase
 * can be a great deal (well below average) even in a group whose price is
 * trending up, or a bad one even in a group trending down.
 *
 * When a purchase is the only dated sale in its group, the average is just
 * that purchase's own price (mathematically correct — the average of one
 * value is that value) and saleCount is 1, not an "unavailable"/null result:
 * callers should treat saleCount as the confidence signal (a saleCount of 1
 * isn't an independent market reference) rather than hiding the number.
 */
export async function computeGroupDeals(
  userId: string,
  matchingPreferences: MatchingPreferences
): Promise<GroupDeal[]> {
  const grouped = await groupSalesByRelistingGroup(userId, matchingPreferences);

  const deals: GroupDeal[] = [];
  for (const [key, points] of grouped) {
    const average = points.reduce((sum, point) => sum + point.value, 0) / points.length;
    if (average === 0) {
      continue;
    }

    for (const point of points) {
      if (!point.won) {
        continue;
      }

      deals.push({
        relistingGroupId: relistingGroupIdFromKey(key),
        title: point.title,
        currency: point.currency,
        saleCount: points.length,
        wonItemId: point.itemId,
        paidValue: point.value,
        paidEndedAt: point.endedAt,
        averageValue: average,
        differenceValue: point.value - average,
        dealPercent: ((average - point.value) / average) * 100
      });
    }
  }

  return deals;
}

function groupForHistoryTitle(title: string, matchingPreferences: MatchingPreferences): string | undefined {
  const catalogueId = catalogueIdForTitle(title, matchingPreferences.criteriaText);
  return catalogueId ? `criteria:${catalogueId}` : relistingGroupForTitle(title, matchingPreferences);
}

/**
 * Persists price-history records for items the client already has displayed
 * (title, seller, condition, end time, etc. — all sourced from an
 * authenticated eBay fetch when the page loaded). The one field never
 * trusted from the client is price: each item's current native price is
 * independently resolved from eBay by item id at capture time, and an item
 * whose price can't be resolved is skipped rather than persisted with an
 * unverified value.
 */
export async function captureItems(
  config: EbayConfig,
  userId: string,
  items: EbayBuyingHistoryItem[],
  matchingPreferences: MatchingPreferences,
  options: { fetch?: typeof fetch } = {}
): Promise<CaptureResult> {
  if (items.length === 0) {
    return { captured: [], skipped: [] };
  }

  const nativePrices = await fetchNativeWatchlistPrices(config, items, { fetch: options.fetch });
  const verifiedItems = items.flatMap((item) => {
    const price = nativePrices.get(item.itemId);
    return price ? [{ ...item, currentPrice: price }] : [];
  });

  const { captured } = await captureMarketPriceRecords(verifiedItems, userId, matchingPreferences);
  const capturedIds = new Set(captured);
  const skipped = items.map((item) => item.itemId).filter((itemId) => !capturedIds.has(itemId));

  return { captured, skipped };
}
