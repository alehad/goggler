# Design: Fix price-history capture silently dropping valid items

## 1. `captureItems` (`src/market-insights/price-history.ts`)

Signature changes from taking `venueItemIds: string[]` + the user's Trading API `accessToken`, to taking the caller-supplied item objects directly and only the app's own eBay config:

```ts
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
```

`fetchNativeWatchlistPrices` (currently private to `src/ebay/live-history-source.ts`) is exported — it's already exactly "resolve a native Browse-API price per item id, using the app's own client-credentials token, with bounded concurrency," which is precisely what's needed here. No new eBay-client code.

The `accessToken`/`fetchEndedWatchlistItems` dependency is dropped entirely — `captureItems` no longer touches the Trading API at all, only the Browse API via the app-level token (same mechanism `fetchNativeWatchlistPrices` already uses elsewhere, unrelated to the user's own eBay session).

**What's still never trusted from the client**: price. Every other field (title, seller, condition, end time, image, item URL) comes from what the Analytics tab already has, which was itself fetched from eBay via the user's own session when the page loaded — legitimate data, just not re-verified a second time, because only price needs that (per the original capture-security intent — see spec deltas below).

## 2. API route (`app/api/market-insights/capture/route.ts`)

- Drops the `requireSessionEbayAccessToken` gate — capture no longer needs the user's eBay session to be valid, since it never calls the Trading API.
- Body shape changes from `{ venueItemIds: string[] }` to `{ items: EbayBuyingHistoryItemLike[] }`, where each item is validated field-by-field (required `itemId`/`title`/`list` strings, optional string/number fields for the rest, bounded string lengths, array capped at the existing `MAX_CAPTURE_ITEM_IDS = 200`) — same defensive-parsing posture as the existing `matched-sales/summary` batch route.

## 3. Client (`app/page.tsx`)

- `captureVenueItemIds`/`captureOne`/`captureAllVisible` in `Analytics` change from collecting item **ids** to collecting the full item **objects** already in `items`/`filteredItems` (all the data is already there — this is exactly the point of the fix).
- `captureVenueItemIds` reads `result.skipped` (now representing "price could not be independently verified for this item just now," a rarer and more meaningful case than before) and shows a message identifying the skipped items by title, instead of silently ignoring it.

## Testing

- Rewrite `test/market-insights/price-history.integration.mjs`'s `captureItems` tests: no more `GetMyeBayBuying` XML mocking or `accessToken` param; mock only the Browse `get_item_by_legacy_id` price lookup (client-credentials token exchange + per-item price). Cover: item captured when price resolves; item skipped when price lookup 404s; native (non-marketplace-converted) price is what gets persisted, not a client-supplied value.
- Manual: reproduce the original report if possible (or a similar multi-item relisting group) — capture all visible, confirm none are silently dropped; confirm the eBay session no longer needs to be fresh for capture to work.
