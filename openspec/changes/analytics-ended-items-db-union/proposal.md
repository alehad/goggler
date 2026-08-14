# Change: Union ended-watchlist items with historical captures

## Why

The Analytics tab's item list is built only from eBay's live `WatchList` fetch, filtered to ended items. Once a captured item drops out of eBay's live watchlist (pagination churn, or genuinely aging out of "Watching" over time), it disappears as a row entirely — even though its `MarketPriceRecord` is still in our own database and still contributes to matched-sales stats behind the scenes. This is inconsistent with how won items already work: `WonItem` accumulates across sessions and the buying-history response returns the *entire* persisted table, not just what eBay's live fetch currently returns, so old wins keep showing up. Ended-watchlist items should behave the same way.

Separately: eBay's Trading API `GetMyeBayBuying` `WatchList` call has no server-side filter for "ended only" — its only customization fields are `Sort`, `IncludeNotes`, `Pagination`, and `DurationInDays` (a retention window, not a status filter). Active and ended items come back interleaved and are already split client-side by end time (`isActiveListing()`), so there's no cheaper request available; this proposal doesn't change the fetch itself.

## What Changes

- `listCaptureCandidates` (`src/market-insights/price-history.ts`) becomes a union: the live-fetched ended-watchlist items (as today) plus every `MarketPriceRecord` for this user not already present in that live fetch, each flagged `captured: true` (since being in that table is exactly what "captured" means).
- New persistence query, `listAllMarketPriceRecords(userId)`, alongside the existing group-scoped one.
- No client-side (`app/page.tsx`) changes needed — the Analytics tab already treats `endedWatchlistItems` as "whatever the server says is the ended-item list" and layers `won`/`eventuallyWon` tags and the wonOnly-row merge on top; a bigger, more complete `endedWatchlistItems` just flows through unchanged.

## Out Of Scope

- Any change to the `GetMyeBayBuying` request itself — confirmed there's no "ended only" filter to switch to.
- Changing how `MarketPriceRecord` rows get created — this only changes what's read back for display.

## Success Criteria

- A captured item that's no longer in eBay's live watchlist still appears as a row in the Analytics tab, tagged Captured, with its stored price/date/etc.
- No duplicate rows for an item that's both live-fetched and captured.
- The "Add to history" capture action still only appears for genuinely still-live, not-yet-captured watchlist items.
