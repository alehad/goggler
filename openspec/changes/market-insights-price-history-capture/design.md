# Design: Market insights price history capture (stage 1)

## 1. Surfacing ended watchlist items

`src/ebay/live-history-source.ts`, `fetchLiveEbayHistoryResponse`:

```diff
  const activeWatchListItems = watchList.items.filter((item) => isActiveListing(item, now));
+ const endedWatchListItems = watchList.items.filter((item) => !isActiveListing(item, now));
```

`endedWatchListItems` are already-parsed `EbayBuyingHistoryItem[]` (same shape as `lostItems`/`wonItems`) — no new Trading API call, no new parsing. Add `endedWatchlistItems: EbayBuyingHistoryItem[]` to `EbayHistoryResponse` (`history-response.ts`) and thread it through `rebuildHistoryResponse`/`refreshLiveHistoryDerivedData` the same way `lostItems`/`wonItems` already are. Fixture mode (`buying-history-fixtures.ts`) gets a small set of fixture ended items so the Analytics tab is testable without a live connection.

`relistingGroupId` is computed for each ended item at read time (reusing the existing `groupForHistoryTitle` helper already used for lost/won/watchlist items), so the UI can eventually group repeat listings without a later backfill.

**Native currency for ended items**: verified against live data (see the `fix-price-currency-consistency` change for the original investigation) that `GetMyeBayBuying` reports the marketplace-converted GBP price for ended items with no way to recover the native currency from the Trading API response alone — the exact same behavior as bid-active watchlist items. Unlike active items, though, Browse API's `get_item_by_legacy_id` *does* still resolve recently-ended listings and correctly discloses the native price via `convertedFromValue`/`convertedFromCurrency` (confirmed for every ended item tested live). So `endedWatchlistItems` reuses the same `fetchNativeWatchlistPrices`/`mergeNativePrices` machinery already built for active items, applied here too, with the Trading-API price as fallback if the Browse lookup fails for a given item. `fetchEndedWatchlistItems` (used by the capture endpoint, see below) applies the same native-price merge, since that is the data that actually gets persisted.

**Guardrail**: `endedWatchListItems` is never passed into `buildHomeFeed({ lostItems, wonItems, watchlistItems, relistingCandidates })` — that call's inputs stay exactly as they are today. Ended items are only ever read via the `market-insights` module (see below), so they cannot leak into Home, Watching, or search rows. `app/page.tsx`'s `Dashboard`/`Tracking` components keep consuming `historyState.history.homeFeed`/`lostItems`/`wonItems` unchanged; only the new `Analytics` component reads `endedWatchlistItems`.

## 2. `MarketPriceRecord` persistence model

`prisma/schema.prisma`:

```prisma
model MarketPriceRecord {
  id                   String   @id @default(uuid())
  userId               String
  venue                Venue    @default(ebay)
  venueItemId          String
  title                String
  soldPriceAmount      Decimal? @db.Decimal(20, 2)
  soldPriceCurrency    String?
  endedAt              DateTime?
  sellerUserId         String?
  conditionDisplayName String?
  categoryId           String?
  categoryName         String?
  imageUrl             String?
  itemWebUrl           String?
  relistingGroupId     String?
  capturedAt           DateTime @default(now())
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([userId, venue, venueItemId])
  @@index([userId, relistingGroupId])
  @@index([userId, endedAt])
}
```

Mirrors `WonItem`/`LostItem` shape for consistency. `capturedAt` (when the user opted to capture) is kept separate from `endedAt` (when the auction actually ended). No import-run tracking table — unlike the Won/Lost sync, capture is an explicit, user-driven action on a small, already-fetched set, not a batch external sync job.

`src/persistence/market-price-records.ts` (mirrors `won-items.ts`/`lost-items.ts`):

```ts
export async function captureMarketPriceRecords(
  items: EbayBuyingHistoryItem[],
  userId: string,
  matchingPreferences: MatchingPreferences,
  prisma = getPrismaClient()
): Promise<{ captured: string[] }> { ... } // upsert, keyed by userId+venue+venueItemId

export async function listCapturedVenueItemIds(
  userId: string,
  venueItemIds: string[],
  prisma = getPrismaClient()
): Promise<Set<string>> { ... } // for the captured/not-captured badge
```

## 3. `market-insights` module — the swap boundary

`src/market-insights/price-history.ts` is the only thing API routes and UI-data-fetching code talk to. It owns the decision of *where* capture candidates and captured records come from:

```ts
export type PriceHistoryCandidate = EbayBuyingHistoryItem & { captured: boolean };

export async function listCaptureCandidates(
  history: EbayHistoryResponse,
  userId: string
): Promise<PriceHistoryCandidate[]> {
  // cross-references history.endedWatchlistItems against listCapturedVenueItemIds
}

export async function captureItems(
  config: EbayConfig,
  accessToken: string,
  userId: string,
  venueItemIds: string[],
  matchingPreferences: MatchingPreferences,
  options: { fetch?: typeof fetch } = {}
): Promise<{ captured: string[]; skipped: string[] }> {
  // re-fetches ended watchlist items live, filters to the requested venueItemIds
  // present in that authoritative set, persists only those
}
```

`captureItems` re-fetching live rather than trusting a client-submitted snapshot matters: the browser already has the ended item's price from its own recent history fetch, but trusting a client-POSTed price would let a compromised client (or plain client bug) write arbitrary numbers into the historical record. Every other persistence path in this app (`persistWonItemsAndMerge`, `persistLostItemsAndMerge`) re-derives from a fresh authenticated eBay fetch rather than trusting the caller's payload; this keeps the same trust boundary. To keep this fast, add a lightweight `fetchEndedWatchlistItems(config, accessToken, options)` to `live-history-source.ts` that issues only the `WatchList` `GetMyeBayBuying` call (not the full lost/won/relisting composite), reused by both the main history response and `captureItems`.

If commercial Marketplace Insights access is ever granted, only this file (plus the persistence adapter, if the record shape needs to change) is touched — the API routes and UI never see the difference.

## 4. API route

`app/api/market-insights/capture/route.ts` — `POST`, same auth/CSRF shape as `app/api/ebay/buying-history/route.ts`:

```ts
export async function POST(request: NextRequest) {
  // validateSameOriginRequest, getOrCreateCurrentUser, requireSessionEbayAccessToken
  // body: { venueItemIds: string[] }
  // calls captureItems(...), returns { captured, skipped }
}
```

## 5. Analytics tab

`app/page.tsx`:
- Add `"analytics"` to the `Tab` union and `tabs` array (new bottom tab, positioned after Purchases).
- Extend the client-side `BuyingHistory` type with `endedWatchlistItems` and per-item `captured` status (computed server-side in the buying-history response via `listCaptureCandidates`, so the client never has to reconcile capture state itself).
- New `Analytics` component: segmented All/Captured/Not-captured filter, list of ended items (same compact card language as Home/Won — image, title, seller, condition, ended date, final price via the existing `formatMoneyValue`), a per-item "Add to history" button, and a "Capture all" bulk button that POSTs every currently-filtered not-captured item id in one request.
- After a successful capture, refetch buying-history (existing `refreshBuyingHistory`) to pick up updated capture status — no separate state-reconciliation logic needed.

## Testing

- `test/ebay/live-history-source.test.mjs`: ended watchlist items are surfaced separately from active ones; fixture mode includes ended items; a response with ended items present asserts `homeFeed.rows` contains none of their item ids (guards the Home-feed leak guardrail above).
- New `test/persistence/market-price-records.integration.mjs` (matches the existing `won-items.integration.mjs`/`lost-items.integration.mjs` pattern): capture is idempotent (re-capturing an already-captured item updates rather than duplicates), `listCapturedVenueItemIds` returns exactly the captured set.
- New `test/market-insights/price-history.integration.mjs` (DB-backed, like the persistence integration tests — `captureItems` and `listCaptureCandidates` persist through Prisma internally rather than accepting an injectable client, keeping the module's public interface clean): `captureItems` only persists items present in the live-verified ended set, ignoring any requested id eBay doesn't currently return as ended.
- Manual functional test against Production eBay: an ended watchlist item can be captured, appears with the correct native currency, shows as "Captured" after a refresh, and never appears on Home/Watching.
