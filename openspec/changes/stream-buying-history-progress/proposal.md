# Proposal: Stream buying-history loading progress on the web Home page

## Why

Connecting to eBay (or hitting "Refresh feed") on the web Home page can take a long time with no feedback beyond a static "Loading buying history" message — it's not obvious whether the app is working or stuck. The real cost isn't one slow call: it's many small sequential/concurrent eBay Browse API calls — a native-price lookup per watchlist item (`fetchNativeWatchlistPrices`, `src/ebay/live-history-source.ts:374`, concurrency 8) and a relisting search per lost/won item (`fetchLiveRelistingCandidates`, `src/ebay/live-relisting-discovery.ts:23`, run sequentially, up to `DEFAULT_MAX_RELISTING_SEARCHES = 12`). A user with 100+ watchlist items can wait a long time watching nothing happen.

## What Changes

- A new streaming endpoint, `POST /api/ebay/buying-history/stream`, alongside the existing `POST/GET /api/ebay/buying-history` (left completely unchanged — still used by the macOS app and as a plain-JSON fallback). The new endpoint streams newline-delimited JSON (NDJSON) events instead of one JSON blob:
  - `progress` events report `{ stage, completed, total }` as native-price lookups and relisting searches complete.
  - `partial` events carry a full, valid `EbayHistoryResponse` snapshot — same shape the app already renders — rebuilt from whatever's resolved so far, emitted roughly every 10 items completed within a stage.
  - A final `complete` event carries the fully-assembled response (same content the non-streaming endpoint returns today, including persistence and capture-status enrichment).
  - An `error` event if the fetch fails after streaming has already started (by which point an HTTP error status can no longer be set).
- `fetchLiveEbayHistoryResponse` (`src/ebay/live-history-source.ts`) gains an optional progress-reporting hook, threaded through the native-price-lookup and relisting-discovery stages. It's a no-op when omitted, so every existing caller (including the non-streaming route and all current tests) is unaffected.
- The web Home page's `refreshBuyingHistory` switches to the streaming endpoint: the item list now grows in front of the user as `partial` snapshots arrive (reusing the exact same rendering path as a normal "ready" state — no new list-rendering logic needed), and a small "X of Y" progress indicator updates live until the `complete` event lands.

## Out of Scope

- The macOS app. It calls the existing, unchanged non-streaming endpoint — this only touches the web app's Home page loading experience. A native streaming equivalent would be a separate, later change if wanted.
- The Purchases/Tracking/Analytics tabs' own "Refresh" actions — they call the same `refreshBuyingHistory` function already, so they get the same progress UI as a side effect, but no additional per-tab work is planned here.
- Persisting partial progress across a page reload, retrying individual failed lookups, or any change to matching/relisting logic itself — this is purely about surfacing progress on the existing fetch, not changing what gets fetched or how items are matched.

## Success Criteria

- On both initial eBay connect and "Refresh feed", the Home page shows a live-updating "X of Y" progress indicator and the item list grows incrementally, instead of one long unexplained wait.
- The final state (once loading completes) is identical to what the non-streaming endpoint returns today — no behavior change to the finished result, only to how the user experiences getting there.
- The macOS app and any other consumer of the existing `/api/ebay/buying-history` endpoint are completely unaffected.
