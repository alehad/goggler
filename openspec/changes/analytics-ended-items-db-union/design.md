# Design: Union ended-watchlist items with historical captures

## 1. New persistence query

`src/persistence/market-price-records.ts` gains a full-table-for-user read, alongside the existing group-scoped `listMarketPriceRecordsByGroup`:

```ts
export async function listAllMarketPriceRecords(
  userId: string,
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<EbayBuyingHistoryItem[]> {
  if (!prisma) {
    return [];
  }

  const records = await prisma.marketPriceRecord.findMany({
    where: { userId, venue: "ebay" },
    orderBy: { endedAt: "desc" }
  });

  return records.map((record) => ({
    itemId: record.venueItemId,
    title: record.title,
    list: "WatchList" as const,
    currentPrice: record.soldPriceAmount !== null && record.soldPriceCurrency
      ? { value: record.soldPriceAmount.toNumber(), currency: record.soldPriceCurrency }
      : undefined,
    endTime: record.endedAt?.toISOString(),
    sellerUserId: record.sellerUserId ?? undefined,
    conditionDisplayName: record.conditionDisplayName ?? undefined,
    categoryId: record.categoryId ?? undefined,
    categoryName: record.categoryName ?? undefined,
    imageUrl: record.imageUrl ?? undefined,
    itemWebUrl: record.itemWebUrl ?? undefined,
    relistingGroupId: record.relistingGroupId ?? undefined
  }));
}
```

`list: "WatchList"` is set explicitly so these rows get the same "ended"/"final price" labeling as live-fetched ones in `AnalyticsRow` (`item.list === "WonList"` is the only branch that changes wording, and these are never that).

## 2. `listCaptureCandidates` becomes a union

```ts
export async function listCaptureCandidates(
  history: EbayHistoryResponse,
  userId: string
): Promise<PriceHistoryCandidate[]> {
  const liveEndedItems = history.endedWatchlistItems;
  const liveIds = new Set(liveEndedItems.map((item) => item.itemId));

  const [capturedIds, allCaptured] = await Promise.all([
    listCapturedVenueItemIds(userId, liveEndedItems.map((item) => item.itemId)),
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
```

The early `if (endedItems.length === 0) return []` short-circuit is removed — historical-only candidates must still be returned even when the live fetch has nothing.

`listCapturedVenueItemIds(userId, [])` already short-circuits internally when given an empty array (no wasted query when there's no live list).

## 3. No client changes

`Analytics`'s `items` memo (`app/page.tsx`) already treats `historyState.history.endedWatchlistItems` as the full ended-item source and layers `won`/`eventuallyWon` computation and the wonOnly-row merge on top, deduping by `itemId` against `watchlistIds`. A larger `endedWatchlistItems` (now including historical-only rows) flows through that exact same logic unchanged — no risk of double-counting since the server-side union already dedupes by `itemId`.

## 4. Fixture mode

`withCaptureStatus` (`app/api/ebay/buying-history/route.ts`) calls `listCaptureCandidates` for both the live and fixture history paths. The union behavior applies to fixture mode too — any `MarketPriceRecord` rows a developer has captured locally will show up unioned with the fixture's sample ended items. This is consistent with the fixture's own existing purpose (representative data for testing the Analytics tab) and not worth special-casing out.

## Testing

- Persistence: new test for `listAllMarketPriceRecords` — scoped by userId, returns full row data.
- `listCaptureCandidates`: extend/add integration test — a captured item no longer in the live-fetched list still appears (captured: true); a live-fetched item that's also captured appears once, not twice; a live-fetched-but-not-captured item still appears (captured: false).
- Manual: capture an item, confirm it stays visible in Analytics even after eBay's live watchlist stops returning it (or simulate by checking against known older captures already in the DB from today's testing).
