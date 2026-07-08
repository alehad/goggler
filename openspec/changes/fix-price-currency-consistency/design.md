# Design: Fix price currency consistency

## 1. `browse-client.ts`: prefer native currency when eBay discloses it

`moneyValue()` currently reads only `value`/`currency`(`currencyId`). Update it to prefer `convertedFromValue`/`convertedFromCurrency` when both are present and valid, falling back to `value`/`currency` when they are not (i.e. eBay didn't convert anything, so `value`/`currency` already is native):

```ts
function moneyValue(raw: unknown): EbayMoney | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const money = raw as {
    value?: unknown; currency?: unknown; currencyId?: unknown;
    convertedFromValue?: unknown; convertedFromCurrency?: unknown;
  };

  const nativeValue = numeric(money.convertedFromValue);
  const nativeCurrency = stringValue(money.convertedFromCurrency);
  if (nativeValue !== undefined && nativeCurrency) {
    return { value: nativeValue, currency: nativeCurrency };
  }

  const value = numeric(money.value);
  const currency = stringValue(money.currency) ?? stringValue(money.currencyId);
  return value !== undefined && currency ? { value, currency } : undefined;
}
```

This single change fixes both `price` and `currentBidPrice` parsing in `parseBrowseRow` (used by the Search tab and relisting-candidate discovery), since both already flow through `moneyValue()`.

## 2. New Browse API item lookup for watchlist native price

Add to `browse-client.ts`:

```ts
export async function fetchEbayItemNativePrice(
  config: EbayConfig,
  appAccessToken: string,
  legacyItemId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<EbayMoney | undefined> {
  assertTrustedBrowseItemUrl(config);
  const url = new URL(`${new URL(config.browseApiUrl).origin}/buy/browse/v1/item/get_item_by_legacy_id`);
  url.searchParams.set("legacy_item_id", legacyItemId);

  const response = await (options.fetch ?? fetch)(url, {
    headers: { Authorization: `Bearer ${appAccessToken}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId }
  });

  if (!response.ok) return undefined;
  const body = await response.json();
  return moneyValue((body as { price?: unknown }).price);
}
```

`assertTrustedBrowseItemUrl` mirrors the existing `assertTrustedBrowseApiUrl` host check, just validating the `/buy/browse/v1/item/get_item_by_legacy_id` path instead.

This is why the `moneyValue` fix in step 1 matters for watchlist too: the item-lookup response uses the same `price` shape with `convertedFromValue`/`convertedFromCurrency`, confirmed against the real Green Caterpillar item (`convertedFromValue: "174.50"`, `convertedFromCurrency: "USD"`).

## 3. `live-history-source.ts`: source watchlist price from Browse API, with fallback

`GetMyeBayBuying` cannot be trusted for native currency once an item has bid activity (confirmed: no `ConvertedCurrentPrice` sibling at all for the Green Caterpillar item). So for active watchlist items, look up the native price via Browse API and prefer it over the Trading-API-parsed price:

```ts
const activeWatchListItems = watchList.items.filter((item) => isActiveListing(item, now));
const nativePrices = await fetchNativeWatchlistPrices(config, activeWatchListItems, fetchOptions);
const watchlistItems = activeWatchListItems.map((item, index) =>
  toWatchlistItem(item, index + 1, groupForHistoryTitle(item.title, matchingPreferences), lostGroups, nativePrices.get(item.itemId))
);
```

`fetchNativeWatchlistPrices` gets an application access token via the existing `getCachedBrowseApplicationAccessToken` (already used for relisting discovery) and looks up each item with bounded concurrency (limit 8, to stay well under Browse API rate limits while keeping a ~60-item watchlist refresh to a few seconds):

```ts
async function fetchNativeWatchlistPrices(
  config: EbayConfig,
  items: EbayBuyingHistoryItem[],
  fetchOptions: { fetch?: typeof fetch }
): Promise<Map<string, EbayMoney | undefined>> {
  const result = new Map<string, EbayMoney | undefined>();
  if (items.length === 0) return result;

  let appToken;
  try {
    appToken = await getCachedBrowseApplicationAccessToken(config, fetchOptions);
  } catch {
    return result; // every item falls back to its Trading API price below
  }

  await mapWithConcurrency(items, 8, async (item) => {
    try {
      result.set(item.itemId, await fetchEbayItemNativePrice(config, appToken.accessToken, item.itemId, fetchOptions));
    } catch {
      result.set(item.itemId, undefined);
    }
  });

  return result;
}
```

`toWatchlistItem` becomes:

```diff
- currentPrice: item.currentPrice ?? { value: 0, currency: "GBP" },
+ currentPrice: nativePrice ?? item.currentPrice,
```

No fabrication anywhere: if the Browse lookup fails for an item, its Trading-API-parsed price (real data, just possibly GBP-converted) is used; if that's also absent, `currentPrice` is `undefined` and the row shows unavailable.

`HomeFeedWatchlistItem.currentPrice` (`home-feed.ts`) becomes optional to allow the "both sources failed" case.

## 4. Won tab aggregate stats removal (unchanged from original plan)

- `src/ebay/purchase-analytics.ts`: remove `buildPurchaseStats`, `PurchaseStats`, and the `stats` field from `buildPurchaseAnalytics`/`PurchaseAnalytics`. Keep `buildPurchaseChartPoints`/`PurchaseChartPoint`.
- `app/page.tsx`: remove the three `Metric` cards in the `Won` component and drop `analytics.stats` usage.

## Non-goals reaffirmed

No conversion is performed by our code anywhere. We only ever choose which of eBay's own returned fields to display; when eBay discloses a native currency that differs from the marketplace default, we now show that one instead of the converted one.

## Testing

- `test/ebay/browse-client.test.mjs`: a search-result item with `convertedFromValue`/`convertedFromCurrency` parses to the native price; an item without those fields still parses `price`/`currency` as before (no regression for genuinely-GBP listings).
- New/updated tests for `fetchEbayItemNativePrice`: a successful lookup with `convertedFromValue` returns native price; a non-OK response returns `undefined`.
- `test/ebay/live-history-source.test.mjs`: a watchlist item where the Browse lookup returns a native USD price uses that price; a watchlist item where the Browse lookup fails falls back to the Trading-API-parsed price; a watchlist item with neither source available has `currentPrice: undefined`, not GBP zero.
- `test/ebay/purchase-analytics.test.mjs`: remove stats assertions, keep chart-point assertions.
- `test/ebay/home-feed.test.mjs`: confirm a watchlist row with an undefined `currentPrice` builds without error.
- Manual verification: reconnect to Production eBay and confirm the Green Caterpillar item (and the two other USD-listed items) now show `$`, per the step-4 functional test pause in our workflow.
