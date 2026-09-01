# Proposal: macOS Analytics tab

## Why

The last placeholder tab. Unlike Home/Watchlist/Purchases, Analytics' entire point is a state-changing action — capturing an ended watchlist item's final price into price history (and removing it again) — not just viewing data. A read-only list here would ship a hollow version of the tab's actual purpose, so this phase includes capture/delete, unlike the read-only-first scoping used for Watchlist and Purchases.

## What Changes

- `AnalyticsView`: the list of ended watchlist items + won-only items not already in that list (mirrors `app/page.tsx`'s `items` computation exactly — `won`/`eventuallyWon` flags derived from `wonItems`, sorted by `endTime` descending), with:
  - Capture-status filter (All / Captured / Not captured) and win-status filter (All / Won / Eventually won / Never won), plus search by title/seller — same shape as Watchlist/Purchases' own filters.
  - Summary metrics (Items / Captured / Not captured).
  - Thumbnails, reusing `RecordThumbnail` from [[macos-record-images]].
  - Per-item "Add to history" / "Remove from history" and bulk "Capture all visible" / "Delete all visible", calling the existing `POST /api/market-insights/capture` and `DELETE /api/market-insights/history` routes — no backend changes. Delete requires confirmation (`.confirmationDialog`), matching the web app's `window.confirm`.
- `BuyingHistoryStore` gains `endedWatchlistItems` (from the same already-loaded `BuyingHistory` response — `HistoryItem.captured` is only present on this list, decoded as an optional field) and two mutating methods, `markCaptured`/`removeItems`, so a successful capture/delete updates the shared, already-loaded state in place — mirroring `app/page.tsx`'s own `markItemsCaptured`/`removeHistoryItems` top-level functions — rather than triggering a full re-fetch.

## Out of Scope (deferred)

- **The AI assistant** (chat + voice input) — by far the largest deferred piece. Voice input specifically is built on the Web Speech API; a native equivalent would use Apple's `Speech` framework, a genuinely separate piece of work, not a port.
- **The matched-sales price-over-time chart** — same reasoning as Purchases' own chart deferral; a real, separately-scoped `Swift Charts` piece.

## Success Criteria

- Analytics shows the same set of items, filters, and counts the web app does, from the already-loaded buying history — no second network round-trip on load.
- Capturing or deleting an item (individually or in bulk) updates the list immediately, without a full refresh, matching the web app's optimistic-update behavior.
- Delete always requires confirmation before the network call is made.
- No changes to `src/` or `app/api/*` — this reuses the existing capture/delete routes exactly as the web app calls them.
