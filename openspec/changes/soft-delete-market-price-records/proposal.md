# Proposal: Soft-delete MarketPriceRecord rows

## Why

While testing the macOS Analytics tab's bulk-delete against the real database, 8 `MarketPriceRecord` rows were deleted (via the web app's existing "Delete all visible" action) with no way afterward to tell which ones — deletion is a hard `deleteMany`, there's no audit trail, and the persistence layer had no prior snapshot to diff against. The user asked for recoverability: soft-delete instead of hard-delete, so an inadvertent bulk removal can be undone.

## What Changes

- `MarketPriceRecord` gains a nullable `deletedAt: DateTime?` column. A non-null value marks the row soft-deleted; the row itself is never physically removed by the app.
- `deleteMarketPriceRecords` sets `deletedAt: now()` on the matching rows (scoped to `userId`, as today) instead of `deleteMany`.
- Every read path in `src/persistence/market-price-records.ts` excludes soft-deleted rows, so a soft-deleted item is treated as if it doesn't exist for every consumer — capture status, price-history group averages/matched sales, the AI assistant's captured-items context, and watchlist automation all go through this one file:
  - `listCapturedVenueItemIds` — excludes soft-deleted rows, so a soft-deleted item reads as "not captured" (and can be re-captured).
  - `listMarketPriceRecordsByGroup` — excludes soft-deleted rows from relisting-group price averages/matched-sales.
  - `listAllMarketPriceRecords` — excludes soft-deleted rows from the Analytics list and the AI assistant's captured-items context.
- `captureMarketPriceRecords`'s upsert clears `deletedAt` on the `update` branch — re-capturing a soft-deleted item revives it (same unique key `userId, venue, venueItemId`, so this is a natural side effect of the existing upsert, not new logic).
- No new API surface: the existing `DELETE /api/market-insights/history` route and its request/response shape are unchanged — only what happens to the row underneath changes.

## Out of Scope (deferred)

- **A restore/recovery UI or endpoint.** The user's ask was recoverability, not a build-your-own-undo feature. For now, restoring a soft-deleted row (clearing `deletedAt`) is a manual DB operation (a one-off script), same as how the deletion itself was diagnosed this session. Worth a dedicated change if this becomes a recurring need.
- **Purging old soft-deleted rows.** No retention/cleanup job — soft-deleted rows accumulate indefinitely. Fine at this app's scale (single user, low volume); can be revisited if it ever matters.

## Success Criteria

- Deleting an item (individually or in bulk) still makes it disappear from the Analytics list immediately, exactly as today — the user-visible behavior of the delete action is unchanged.
- A soft-deleted item is invisible to every other read path: it doesn't count toward captured/not-captured status, doesn't contribute to a relisting group's price average or matched-sales history, and doesn't appear in the AI assistant's or watchlist automation's view of captured items.
- Re-capturing a previously soft-deleted item (same `venueItemId`) works normally and clears its soft-deleted state.
- The row's data is still present in the database afterward, recoverable by clearing `deletedAt` directly.
