# Design: Market insights trend charting (stage 2)

## 1. Matched-sales read path

`src/persistence/market-price-records.ts` gains a query scoped to a group and currency:

```ts
export async function listMarketPriceRecordsByGroup(
  userId: string,
  relistingGroupId: string,
  currency: string,
  prisma = getPrismaClient()
): Promise<MarketPriceRecordRow[]> {
  // findMany where { userId, relistingGroupId, soldPriceCurrency: currency }, orderBy endedAt asc
}
```

`src/market-insights/price-history.ts` gains the merge logic — the only place that knows a "matched sale" can come from either the captured table or the user's own Won history:

```ts
export type MatchedSalePoint = {
  venueItemId: string;
  title: string;
  price: EbayMoney;
  date: string; // ISO
  won: boolean;
};

export async function listMatchedSales(
  userId: string,
  relistingGroupId: string,
  currency: string,
  matchingPreferences: MatchingPreferences
): Promise<MatchedSalePoint[]> {
  const captured = await listMarketPriceRecordsByGroup(userId, relistingGroupId, currency);
  const wonItems = await listWonItemsForGroup(userId, relistingGroupId, currency, matchingPreferences);

  const capturedVenueItemIds = new Set(captured.map((record) => record.venueItemId));
  const points: MatchedSalePoint[] = captured.map((record) => ({
    venueItemId: record.venueItemId,
    title: record.title,
    price: { value: record.soldPriceAmount, currency: record.soldPriceCurrency },
    date: record.endedAt,
    won: wonItems.some((won) => won.venueItemId === record.venueItemId)
  }));

  for (const won of wonItems) {
    if (!capturedVenueItemIds.has(won.venueItemId)) {
      points.push({ venueItemId: won.venueItemId, title: won.title, price: won.price, date: won.purchasedAt, won: true });
    }
  }

  return points.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
```

`listWonItemsForGroup` lives alongside this function (or in `src/persistence/won-items.ts` as a new export) and fetches the user's `WonItem` rows, computing `relistingGroupId` per row the same way `live-history-source.ts`/`persistence/won-items.ts` already do (`catalogueIdForTitle`/`relistingGroupForTitle`) — no schema change to `WonItem`, since a personal collector's won-item count is small enough to filter in memory rather than needing a stored, indexed column.

**Why cross-check Won history beyond captured records**: a win only becomes a captured `MarketPriceRecord` if the item happened to be on the watchlist when it ended. A win on an item never watched is real purchase data that should still show as "my price paid" and still highlight on the chart — this is the "Cross-check full Won history too" choice from the design discussion.

**Currency scoping**: both queries filter to the *selected item's own currency*. A sale of "the same" catalogue item in a different currency is simply not part of this result set — never converted in, never silently blended into the average.

## 2. API route

`app/api/market-insights/matched-sales/route.ts` — `GET`, query params `relistingGroupId` and `currency`. Read-only, no eBay call, so no eBay access-token requirement — only the app's own session (`getOrCreateCurrentUser`), matching the read-only nature of `GET /api/ebay/buying-history`. No CSRF check (GET, no side effects, same as the existing buying-history `GET` handler).

## 3. Chart reuse

`src/ebay/purchase-analytics.ts`'s `PurchaseChartPoint` gains an optional field:

```diff
export type PurchaseChartPoint = {
  itemId: string;
  title: string;
  price: EbayMoney;
  timestamp: number;
  date: string;
+ won?: boolean;
};
```

`PurchaseChart` (`app/page.tsx`) renders a `won` modifier class on the point group; CSS adds a distinct fill for `.purchase-point.won circle` (using `--bad`, the existing red token) separate from the `.selected` highlight (size/stroke change) so a won-and-selected point stays visually unambiguous. The Won tab's own chart never sets `won`, so it renders unchanged.

## 4. Analytics tab UI

- New search `<input>` above the filter row; client-side `.filter()` over the already-loaded `endedWatchlistItems` by title (and seller), applied together with the existing All/Captured/Not-captured segmented filter. No new eBay fetch.
- Chart moves above the item list. Selecting a row (click, any status) sets `selectedItemId`; a `useEffect` fetches `GET /api/market-insights/matched-sales?relistingGroupId=...&currency=...` using the selected item's own `relistingGroupId`/currency and maps the response into `PurchaseChartPoint[]` for `PurchaseChart`.
- If the selected item has no `relistingGroupId` (title didn't match any configured pattern), the fetch is skipped and the chart shows its empty state with a message explaining why.
- If the selected item isn't itself captured yet, it still drives the chart (by group id), but contributes no point of its own until captured — matches the stage-1 principle that only persisted data is "history."
- Five `Metric` cards (already used everywhere else in the app) above/beside the chart: Sales (count), My price paid (value + date detail), Average, Lowest (value + date detail), Highest (value + date detail). "My price paid" uses the most recent won point if there is more than one.

## Testing

- `test/persistence/market-price-records.integration.mjs`: `listMarketPriceRecordsByGroup` scopes by userId + relistingGroupId + currency.
- New `test/market-insights/price-history.test.mjs` (pure unit, no DB — the merge logic itself is DB-agnostic given already-fetched rows) or extend the existing integration test: captured + won merge without duplicating a venueItemId present in both; a win never captured still appears with `won: true`; a different-currency won item is excluded.
- `test/ebay/purchase-analytics.test.mjs` / chart: unaffected Won-tab behavior when `won` is never set.
- Manual functional test against Production eBay: select an item with multiple matched sales including one you won, confirm the highlighted point and the five cards match.
