# Design: Purchases tab market context

## 1. Purchases tab search

Mirrors the Analytics tab exactly: a `searchQuery` state in the `Won` component, filtering `historyState.history.wonItems` client-side by `title`/`sellerUserId` (same `.toLocaleLowerCase("en-GB").includes(term)` check), reusing the `search-box` CSS class. No new fetch, no API change.

## 2. Per-item market-context stats

### Data source

One batch endpoint, `POST /api/market-insights/matched-sales/summary`, body `{ groups: { relistingGroupId: string; currency: string }[] }`, returns `{ summaries: Record<string, { count: number; average: number; lowest: number; highest: number } | null> }` keyed by `` `${relistingGroupId}::${currency}` ``. `null` when a group has no matched sales (shouldn't happen for a won item's own group, but defensive).

Server-side, `src/market-insights/price-history.ts` gets a new `summarizeMatchedSales(sales: MatchedSalePoint[])` pure helper (extracted from the arithmetic the Analytics tab currently does client-side for its five cards) and a `listMatchedSalesSummaries(userId, groups, matchingPreferences)` that runs `listMatchedSales` per group in parallel (`Promise.all`) and reduces each with `summarizeMatchedSales`. This is a POST because the payload is a list, not because it mutates anything — still no eBay call, still scoped to `getOrCreateCurrentUser`.

**Why batch instead of one call per card**: the Purchases tab can show many items at once; N sequential/parallel single-group fetches on tab load is wasteful and racy compared to one request for every distinct `(relistingGroupId, currency)` pair present in `wonItems`.

**Resolved**: `POST` with a JSON body of groups, as proposed. The existing single-group `GET /api/market-insights/matched-sales` route is also updated so its response includes the `summarizeMatchedSales` result (or the Analytics tab calls the same helper via a small addition to that route's response shape), and the Analytics tab's five summary cards switch to using that server-computed summary instead of their current client-side `reduce`/`Math.min`/`Math.max` calls — one source of truth for the arithmetic, shared by both tabs.

### Card layout

`PurchaseCard`'s `.listing-side` currently holds just the paid-price block. A new block is added to its right (still inside `.card-actions`-adjacent area, before the action buttons), right-aligned, showing:

```
avg  £NN.NN
min  £NN.NN
max  £NN.NN
diff -£N.NN (-N%)   <- colored via --good/--bad
```

Diff = `paidPrice - average`; percentage = `diff / average * 100`. Green (`--good`) when `diff < 0` (paid less than average), red (`--bad`) when `diff > 0`. Shown as `-` when no summary is available yet (loading) or the group has no matched sales / no `relistingGroupId`.

## 3. Rewiring the rightmost action button

Today: `<a href={itemWebUrl} target="_blank">` with an `ExternalLink` icon, title "View on eBay". This becomes a `<button>` calling `onViewPriceHistory(item.itemId)`, icon changed to `TrendingUp` (already imported elsewhere in `page.tsx`), title "View price history". **Resolved: the external eBay link is dropped**, not kept as a second action.

### Cross-tab wiring

`selectedItemId` for the Analytics tab moves from `Analytics`-local `useState` up to `Home`, alongside a new `analyticsSearchQuery`-independent "pending selection" concept isn't needed — plain lifting is enough:

```ts
const [analyticsSelectedItemId, setAnalyticsSelectedItemId] = useState<string>();
```

passed to `Analytics` as `selectedItemId`/`onSelectItem` props (replacing its internal state), and a new handler passed to `Won`:

```ts
function viewPriceHistory(itemId: string) {
  setAnalyticsSelectedItemId(itemId);
  setActiveTab("analytics");
}
```

`Analytics` already scrolls nothing into view today (the Won tab does, via `purchaseCardDomId` + `scrollIntoView` in a `useEffect` keyed on `selectedItemId`); the same pattern is added to `AnalyticsRow`/`Analytics` so switching tabs and landing on a selected row scrolls it into view, matching Won-tab behavior.

## 4. Won items in the Analytics list, tags, and filtering

### Where Won history actually lives (context for this section)

Won items persist in their own `WonItem` table (`src/persistence/won-items.ts`), separate from `MarketPriceRecord`. `persistWonItemsAndMerge` runs on every `GET /api/ebay/buying-history` call: it upserts eBay's live response (which only covers eBay's own ~2-month rolling window) into `WonItem` keyed by `(userId, venue, venueItemId)`, then substitutes the *entire* persisted table back into the response — so, like `MarketPriceRecord`, the app's Won history accumulates across sessions well beyond what any single eBay call returns. This is why won-only items (never on the watchlist, so never captured) are a real, growing data set worth surfacing in Analytics, not an edge case.

### Combined item list

`Analytics`'s `items` memo becomes the union of ended-watchlist items and any `wonItems` not already present by `itemId`, **fully date-interleaved** (sorted by `endTime` descending across both sources, not appended):

```ts
const wonItemIds = useMemo(
  () => new Set(historyState.status === "ready" ? historyState.history.wonItems.map((w) => w.itemId) : []),
  [historyState]
);
const wonGroupIds = useMemo(
  () => new Set(historyState.status === "ready" ? historyState.history.wonItems.map((w) => w.relistingGroupId).filter(Boolean) : []),
  [historyState]
);
const items = useMemo(() => {
  const endedItems = historyState.status === "ready" ? historyState.history.endedWatchlistItems : [];
  const watchlistRows = endedItems.map((item) => ({ ...item, won: wonItemIds.has(item.itemId) }));
  const watchlistIds = new Set(watchlistRows.map((r) => r.itemId));
  const wonOnlyRows = (historyState.status === "ready" ? historyState.history.wonItems : [])
    .filter((w) => !watchlistIds.has(w.itemId))
    .map((w) => ({ ...w, captured: false, won: true }));
  return [...watchlistRows, ...wonOnlyRows].sort(
    (a, b) => Date.parse(b.endTime ?? "") - Date.parse(a.endTime ?? "")
  );
}, [historyState, wonItemIds, locallyCapturedIds]);
```

### Tags

Each row gets a derived `tags` set from two independent, mutually-exclusive-within-themselves axes:

- **Capture status**: `captured` | `notCaptured` (existing `captured` boolean, unchanged semantics — every row has exactly one of these).
- **Win status**: `won` (this exact listing was won: `item.won`) | `eventuallyWon` (not won itself, but `item.relistingGroupId` is in `wonGroupIds` — the same relisting was won via a different listing, reusing the existing `formatLostStatus` "eventually won" concept from the Tracking tab) | neither (never won, in any form).

So a row can carry e.g. `["notCaptured", "won"]` (a won-only row) or `["captured", "eventuallyWon"]` (a captured ended-watchlist item whose group you later won elsewhere) or just `["captured"]` (captured, never won in this group).

`AnalyticsRow` renders these as badges using the existing `.signal` tag styling (same visual language as the Won tab's "Won" signal and the Tracking tab's lost-status label).

### Filtering

Two independent single-select segmented controls (same UI pattern already used for the Tracking tab's All/Never won/Eventually won), combined with AND:

- **Capture status** (existing, unchanged): All / Captured / Not captured.
- **Win status** (new): All / Won / Eventually won / Never won.

This keeps the filter UI consistent with the app's existing segmented-control language rather than introducing a new multi-select chip pattern, while still letting you combine, say, "Not captured" + "Won" to see exactly the won-only rows.

- The "Add to history" capture button is hidden for won-only rows (`item.list !== "WatchList"`), since they were never watchlist-tracked and there's nothing to capture — they already contribute to matched sales via the existing `listWonItemsForGroup` path regardless of capture status.

## Testing

- Unit test for `summarizeMatchedSales` (count/average/lowest/highest, empty input).
- Extend `test/market-insights/matched-sales.integration.mjs` (or a new file) for the batch summary path: multiple groups in one call, a group with no sales returns `null`.
- `test/ebay/purchase-analytics.test.mjs` or a page-level test for the diff color logic (paid-less → green, paid-more → red, equal → neutral).
- Unit test for tag derivation (captured/notCaptured × won/eventuallyWon/neither) and the two-filter AND combination.
- Manual functional test against Production eBay: search on Purchases tab, verify stats on a couple of real purchases, click through to Analytics and confirm the right item is selected/highlighted/scrolled-to, confirm a won-but-never-watched item is selectable in Analytics, and confirm both segmented filters narrow the list correctly together.

## Decisions (confirmed)

1. Batch summary: `POST` with a JSON body of groups.
2. Analytics tab's five summary cards switch to the shared server-side `summarizeMatchedSales`.
3. External "View on eBay" link is dropped, replaced by "View price history".
4. Won-history persistence confirmed: separate `WonItem` table, upsert-merged and accumulated across sessions beyond eBay's ~2-month window — see the "Where Won history actually lives" note in §4.
5. Combined Analytics list is fully date-interleaved; tags (captured/not captured/won/eventually won) shown as badges and filterable via two independent segmented controls (capture status, win status), combined with AND.
