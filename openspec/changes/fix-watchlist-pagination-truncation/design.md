# Design: Fix silent watchlist truncation dropping ended items

## 1. Raise the pagination cap

`fetchLiveEbayHistoryResponse` (`src/ebay/live-history-source.ts`) calls `fetchGetMyeBayBuyingPages` for `WatchList`/`LostList`/`WonList` using shared defaults:

```ts
const entriesPerPage = options.entriesPerPage ?? 50;
const maxPages = options.maxPagesPerList ?? 3;
```

Both defaults move up: `entriesPerPage` 50 → 200 (eBay's documented Trading API maximum for `GetMyeBayBuying`), `maxPages` 3 → 10 (`fetchGetMyeBayBuyingPages` already clamps to a max of 10 via `Math.min(Math.max(input.maxPages ?? 3, 1), 10)`, so 10 is the ceiling anyway). 200 × 10 = up to 2000 entries per list, comfortably covering this account's current scale (166 captured records, presumably a larger live watchlist) with headroom.

This is a shared default for all three lists (`WatchList`/`LostList`/`WonList`) since they're fetched with the same `entriesPerPage`/`maxPages` today — no evidence the other two need different treatment, and keeping them aligned is simpler than introducing per-list tuning without a concrete reason to.

## 2. Surface `warnings` end-to-end

Turns out the server-side plumbing already exists and already reaches the HTTP response: `EbayHistoryResponse.warnings` (`src/ebay/history-response.ts`) is computed in `fetchLiveEbayHistoryResponse` and spread as-is into the JSON response by `withCaptureStatus` in `app/api/ebay/buying-history/route.ts` (`{ ...history, endedWatchlistItems: ... }`). The gap is purely client-side: `BuyingHistory` in `app/page.tsx` has no `warnings` field, so it's parsed and silently discarded.

- Add `warnings?: string[]` to the client `BuyingHistory` type.
- Show a compact warning banner when `historyState.history.warnings` is non-empty, on the Dashboard tab (the default landing tab, so it's seen regardless of which tab the user goes to next) — reusing the existing `.empty-panel`-style visual language already used elsewhere for non-error informational states, styled as a warning (amber, using the existing `--warn` token) rather than a hard error.

## Testing

- Unit: none needed for the constant bump itself; existing `fetchGetMyeBayBuyingPages`/pagination tests already cover the mechanism generically.
- Manual: confirm the TBM63 group now shows all 4 ended items in the Analytics tab. If truncation is somehow still hit at the new cap (unlikely at this account's current scale), confirm the warning banner appears instead of a silent gap.
