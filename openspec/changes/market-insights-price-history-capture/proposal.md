# Change: Market insights price history capture (stage 1)

## Why

goggler has no historical sold-price data for items the user cares about, which blocks any future trending/analytics feature. eBay's Marketplace Insights API (the first-party source for sold-item history) requires commercial approval, which has been declined for this personal project. A different, self-hosted approach is needed.

The user's proposed approach: eBay's `GetMyeBayBuying` `WatchList` response already includes ended listings (within eBay's own retention window) alongside active ones — `live-history-source.ts` currently discards the ended ones entirely (`activeWatchListItems = watchList.items.filter(isActiveListing)`). Every ended watchlist item already carries a final/sold price. That's a usable, if manual, seed source for a self-hosted historical price table, with no new eBay scopes or write access required.

This is stage 1 of a multi-stage feature. Later stages (a background job that keeps re-watching items to accumulate more data points, and actual trend charts) are deliberately out of scope here — see below.

## What Changes

- Stop discarding ended watchlist items; surface them (title, final price/currency, seller, condition, category, image, ended date) alongside the existing live buying-history response.
- Add a new `market-insights` domain module (`src/market-insights/`) that owns the "capture an ended item into price history" concept behind a stable interface, so the underlying data source (ended watchlist items today, potentially a real Marketplace Insights integration later if commercial access is ever granted) stays swappable without touching API routes or UI.
- Add a new `MarketPriceRecord` persistence model for captured price history, distinct from `WonItem`/`LostItem` — ended watchlist items include items the user never bid on at all, which those tables don't represent.
- Add a capture endpoint that re-verifies the requested items against a fresh eBay fetch server-side before persisting, rather than trusting a client-submitted price payload.
- Add a new "Analytics" bottom tab: lists ended watchlist items, shows a Captured/Not-captured status per item, supports capturing individually or in bulk, and supports filtering by capture status.
- Apply the same Browse-API native-price preference built in `fix-price-currency-consistency` to ended watchlist items too. Verified against live data: `GetMyeBayBuying` silently reports the marketplace-converted GBP price for ended items just like it does for bid-active watchlist items, but Browse API's `get_item_by_legacy_id` correctly returns the true native price for recently-ended listings (confirmed for every ended item tested) — this corrects an initial assumption in this proposal that Browse API couldn't look up ended listings at all.

## Out Of Scope

- Any background job that automatically re-adds items to the eBay watchlist to accumulate more data points over time. That requires eBay write access (`AddToWatchList`), which the project has deliberately stayed out of (`production-ebay-readonly-mode`, `purchases-market-history` both explicitly exclude eBay write actions). Deferred to a later stage, to be proposed and reviewed separately.
- Trend charts / analytics visualizations over the captured data. Stage 1 only builds the capture mechanism; there won't be enough accumulated data points to chart meaningfully until stage 2 (the background re-watch job) exists.
- Currency conversion. Captured prices are stored and displayed exactly as eBay returns them for that ended item — this now includes the native-price cross-check described above, so no conversion is introduced.
- Editing or deleting captured records.
- Any handling for items that already aged out of eBay's watchlist retention window before this feature existed — capture only works going forward from whatever `GetMyeBayBuying` currently returns.

## Success Criteria

- The live buying-history response includes ended watchlist items with their final price/currency, distinct from the active watchlist.
- Ended watchlist item prices reflect the item's true native listing currency (via the Browse API native-price preference), not a marketplace-converted figure.
- A new Analytics tab lists those ended items with a clear captured/not-captured status per item.
- The user can capture an item individually or capture all currently-visible not-captured items in one action.
- Captured records persist in a dedicated table and survive a page reload / reconnect.
- The capture endpoint only persists items it can re-verify against a fresh eBay fetch, never a client-submitted price value.
- No eBay write actions (watchlist mutation, bidding) are introduced anywhere in this change.
