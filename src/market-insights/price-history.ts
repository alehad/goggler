import type { EbayConfig } from "../ebay/config.ts";
import type { EbayHistoryResponse } from "../ebay/history-response.ts";
import { fetchEndedWatchlistItems } from "../ebay/live-history-source.ts";
import type { MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { EbayBuyingHistoryItem } from "../ebay/trading-client.ts";
import { captureMarketPriceRecords, listCapturedVenueItemIds } from "../persistence/market-price-records.ts";

export type PriceHistoryCandidate = EbayBuyingHistoryItem & { captured: boolean };

export type CaptureResult = {
  captured: string[];
  skipped: string[];
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
