# Proposal: Remove unwanted items from captured price history

## Why

[[watchlist-automation]] surfaced items in price history the user isn't actually interested in tracking — captured while an item was on the watchlist in the past, but not something they want counted toward future price-history analysis. There's currently no way to remove a captured record short of a direct database edit. The user wants to prune these interactively from the Analytics tab, both one at a time and in bulk for whatever's currently visible under the search/filter state.

## What Changes

- New persistence function `deleteMarketPriceRecords(userId, venueItemIds)` in `src/persistence/market-price-records.ts` — bulk delete by venue item ID, scoped to the owning user.
- New `DELETE /api/market-insights/history` route accepting `{ itemIds: string[] }`, following the same CSRF/session pattern as every other mutating route here.
- **Per-item delete**: a "Remove from history" button on each `AnalyticsRow` — only shown for items that actually have a captured `MarketPriceRecord` (i.e. `item.captured && item.list === "WatchList"`). Actual purchases (`WonList` items) are never deletable through this feature — they're real transaction records, not opt-in price tracking, and this feature doesn't touch them.
- **Bulk delete**: a "Delete all visible" button next to the existing "Capture all visible" button, deleting everything currently matching the Analytics tab's search text *and* filter dropdowns (capture status, win status) — mirrors exactly what "Capture all visible" already targets (`filteredItems`), narrowed to the deletable subset.
- Both actions require a confirmation prompt before executing (a native `confirm()` dialog, showing what/how many will be removed) — this is genuinely irreversible data loss with no undo in the app.

## Out of Scope

- Deleting `WonItem` (actual purchase) records — explicitly excluded; this only ever touches `MarketPriceRecord`.
- Any change to the capture pipeline itself, or to [[watchlist-automation]]'s discovery/add logic.
- Soft-delete, undo, or an audit trail of what was removed — a hard delete, matching how the rest of this app's persistence layer already works (no soft-delete pattern exists anywhere in the schema).

## Success Criteria

- Clicking "Remove from history" on a captured item, after confirming, permanently removes its `MarketPriceRecord` row and the item disappears from the Analytics list without a page reload.
- Clicking "Delete all visible", after confirming (with an accurate count shown), removes every currently-visible captured item's `MarketPriceRecord` row.
- Neither action is ever offered for, or able to delete, a `WonItem` row.
- Deletion is scoped to the signed-in user — cannot delete another user's records.
