import { resolveSellerDetails } from "../ebay/seller-profile.ts";
import { fetchGetMyeBayBuyingPages } from "../ebay/trading-client.ts";
import { getMatchingPreferencesForUser } from "../persistence/matching-preferences.ts";
import { buildPurchaseChartPoints } from "../ebay/purchase-analytics.ts";
import { assembleAnalyticsHistory, listAssembledStoredHistory } from "./assembled-history.ts";
import type { EbayConfig } from "../ebay/config.ts";
import type { EbayHistoryResponse } from "../ebay/history-response.ts";
import { fetchNativeWatchlistPrices } from "../ebay/live-history-source.ts";
import { type MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem, EbayMoney } from "../ebay/trading-client.ts";
import {
  captureMarketPriceRecords,
  listAllMarketPriceRecords,
} from "../persistence/market-price-records.ts";

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

/** Complete ended history, reconciled by listing authority before matching. */
export async function listCaptureCandidates(
  history: EbayHistoryResponse,
  userId: string
): Promise<PriceHistoryCandidate[]> {
  const captured = await listAllMarketPriceRecords(userId);
  const preferences = await getMatchingPreferencesForUser(userId);
  return assembleAnalyticsHistory([
    ...(history.wonItems ?? []), ...(history.lostItems ?? []), ...history.endedWatchlistItems, ...captured
  ], new Set(captured.map(item => item.itemId)), preferences);

}

/**
 * Matched observations use the shared Won > Lost > Watched assembly.
 * Identity reconciliation precedes group/currency filtering, including missing prices.
 */
export async function listMatchedSales(
  userId: string,
  relistingGroupId: string,
  currency: string,
  matchingPreferences: MatchingPreferences
): Promise<MatchedSalePoint[]> {
  const items = await listAssembledStoredHistory(userId, matchingPreferences);
  return items.flatMap((item): MatchedSalePoint[] => {
    if (item.relistingGroupId !== relistingGroupId || item.currentPrice?.currency !== currency) return [];
    return [{ venueItemId: item.itemId, title: item.title, price: item.currentPrice,
      endedAt: item.endTime, won: item.won }];
  }).sort((a, b) => Date.parse(a.endedAt ?? "") - Date.parse(b.endedAt ?? ""));
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
  return (await listMatchedSalesOverview(userId, groups, matchingPreferences)).summaries;
}

export type PurchasePriceComparison = { differenceValue: number; differencePercent?: number };

export async function listMatchedSalesOverview(userId: string, groups: MatchedSalesGroupKey[], matchingPreferences: MatchingPreferences) {
  const uniqueGroups = new Map(groups.map(group => [matchedSalesSummaryKey(group), group]));
  const items = await listAssembledStoredHistory(userId, matchingPreferences);
  const summaries: Record<string, MatchedSalesSummary | undefined> = Object.fromEntries([...uniqueGroups].map(([key, group]) => {
    const sales = items.flatMap((item): MatchedSalePoint[] =>
      item.relistingGroupId === group.relistingGroupId && item.currentPrice?.currency === group.currency
        ? [{ venueItemId: item.itemId, title: item.title, price: item.currentPrice, endedAt: item.endTime, won: item.won }]
        : []);
    return [key, summarizeMatchedSales(sales)];
  }));
  const comparisons: Record<string, PurchasePriceComparison> = {};
  for (const item of items) {
    if (!item.won || !item.currentPrice || !item.relistingGroupId) continue;
    const summary = summaries[matchedSalesSummaryKey({ relistingGroupId: item.relistingGroupId, currency: item.currentPrice.currency })];
    if (!summary || summary.count <= 1) continue;
    const differenceValue = item.currentPrice.value - summary.average;
    comparisons[item.itemId] = { differenceValue, differencePercent: summary.average !== 0 ? differenceValue / summary.average * 100 : undefined };
  }
  return { summaries, comparisons };
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
  const items = await listAssembledStoredHistory(userId, matchingPreferences);
  const grouped = new Map<string, RelistingGroupPoint[]>();
  for (const item of items) {
    if (!item.relistingGroupId || !item.currentPrice || !item.endTime) continue;
    const key = `${item.relistingGroupId}::${item.currentPrice.currency}`;
    const points = grouped.get(key) ?? [];
    points.push({ value: item.currentPrice.value, currency: item.currentPrice.currency,
      endedAt: item.endTime, title: item.title, itemId: item.itemId, won: item.won });
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

/** Client input is selection only. Eligibility, metadata, outcome and prices
 * are resolved from server-owned per-user facts and authenticated eBay data. */
export async function captureItems(
  config: EbayConfig,
  userId: string,
  items: Pick<EbayBuyingHistoryItem, "itemId">[],
  matchingPreferences: MatchingPreferences,
  options: { fetch?: typeof fetch; accessToken?: string } = {}
): Promise<CaptureResult> {
  if (items.length === 0) {
    return { captured: [], skipped: [] };
  }

  const stored = await listAssembledStoredHistory(userId, matchingPreferences);
  const capturedIdsBefore = new Set(stored.filter(item => item.captured).map(item => item.itemId));
  const authoritative = new Map(stored.filter(item => item.list !== "WatchList").map(item => [item.itemId, item]));
  const unknownSelections = items.filter(item => !authoritative.has(item.itemId) && !capturedIdsBefore.has(item.itemId));
  let eligibleWatched: EbayBuyingHistoryItem[] = [];
  if (unknownSelections.length > 0) {
    if (!options.accessToken) throw new Error("Capture requires active-session eBay authorization");
    const watched = await fetchGetMyeBayBuyingPages(config, options.accessToken, { list: "WatchList", entriesPerPage: 200, maxPages: 10 }, { fetch: options.fetch });
    const selectedIds = new Set(unknownSelections.map(item => item.itemId));
    const now = Date.now();
    eligibleWatched = watched.items.filter(item => selectedIds.has(item.itemId) && item.endTime && Number.isFinite(Date.parse(item.endTime)) && Date.parse(item.endTime) <= now);
  }
  const nativePrices = await fetchNativeWatchlistPrices(config, eligibleWatched, { fetch: options.fetch });
  const watchedById = new Map(eligibleWatched.map(item => [item.itemId, item]));
  const verifiedItems = items.flatMap((selection): EbayBuyingHistoryItem[] => {
    const fact = authoritative.get(selection.itemId);
    if (fact) return fact.currentPrice && fact.currentPrice.value > 0 ? [fact] : [];
    const watched = watchedById.get(selection.itemId);
    const price = nativePrices.get(selection.itemId);
    return watched && price ? [{ ...watched, currentPrice: price }] : [];
  });

  const { captured: newlyCaptured } = await captureMarketPriceRecords(verifiedItems.filter(item => !capturedIdsBefore.has(item.itemId)), userId, matchingPreferences);
  const captured = [...items.filter(item => capturedIdsBefore.has(item.itemId)).map(item => item.itemId), ...newlyCaptured];
  const capturedIds = new Set(captured);
  const skipped = items.map((item) => item.itemId).filter((itemId) => !capturedIds.has(itemId));

  return { captured, skipped };
}

export async function assembleHistoryAnalytics(history: EbayHistoryResponse, userId: string, preferences: MatchingPreferences) {
  const captured = await listAllMarketPriceRecords(userId);
  const capturedIds = new Set(captured.map(item => item.itemId));
  const analyticsItems = assembleAnalyticsHistory([
    ...history.wonItems, ...history.lostItems, ...history.endedWatchlistItems, ...captured
  ], capturedIds, preferences);
  const evidence = [...history.wonItems, ...history.lostItems, ...history.watchlistItems, ...history.endedWatchlistItems, ...captured, ...history.relistingCandidates];
  const wonItems = resolveSellerDetails(history.wonItems, evidence);
  const lostItems = resolveSellerDetails(history.lostItems, evidence).map(item => ({ ...item, eventuallyWon: analyticsItems.find(row => row.itemId === item.itemId)?.eventuallyWon ?? false }));
  const decorateRows = (rows: typeof history.homeFeed.rows) => rows.map(row => {
    const [seller] = resolveSellerDetails([{ itemId: row.sourceItemId ?? row.id, sellerUserId: row.sellerUserId, sellerUsername: row.sellerUsername }], evidence);
    return { ...row, sellerUsername: seller.sellerUsername, sellerDisplayName: seller.sellerDisplayName, sellerProfileUrl: seller.sellerProfileUrl };
  });
  return { ...history, wonItems, lostItems, analyticsItems, endedWatchlistItems: analyticsItems,
    watchlistItems: resolveSellerDetails(history.watchlistItems, evidence),
    relistingCandidates: resolveSellerDetails(history.relistingCandidates, evidence),
    homeFeed: { ...history.homeFeed, rows: decorateRows(history.homeFeed.rows), ebayRows: decorateRows(history.homeFeed.ebayRows), relistingRows: decorateRows(history.homeFeed.relistingRows) },
    purchaseChartPoints: buildPurchaseChartPoints(wonItems)
  };
}
