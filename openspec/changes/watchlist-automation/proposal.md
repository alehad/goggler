# Proposal: Discover live auctions from purchase/price history and add them to the watchlist

## Why

Today, growing the price-history dataset requires manual work: search eBay for known record catalogue numbers ("TBM" etc.) at favourite sellers, and manually add matching listings to the watchlist so their sold price gets captured once they end (via the existing ended-watchlist capture flow). The user wants this automated: given everything already purchased or already captured into history, find any currently-live *auction* listings for the same catalogue numbers and add them to the watchlist automatically, so the existing capture pipeline picks up their sold price when they end.

This composes almost entirely from capability that already exists:
- The catalogue-number regex extraction (`catalogueIdForTitle`) and eBay Browse API search are already used by [live-relisting-discovery.ts](../../../src/ebay/live-relisting-discovery.ts) for a similar purpose (finding live relistings of *lost* auctions).
- The app already *reads* the watchlist via the Trading API's `GetMyeBayBuying`.
- The only genuinely new piece is *writing* to the watchlist (`AddToWatchList`), which the app has never done before.

## What Changes

- **`venue-adapters` capability**: add `AddToWatchList` support to `src/ebay/trading-client.ts`, following the exact same request/response shape as the existing `GetMyeBayBuying`/`GetOrders` calls (XML body, `X-EBAY-API-IAF-TOKEN` header, `Ack`-based success/failure).
- **New `watchlist-automation` capability**: a new orchestration function that, given a user:
  1. Reads all of that user's purchased items (`WonItem`) and historical price records (`MarketPriceRecord`) — the first needs a new `listAllWonItems(userId)` persistence function (mirroring the existing `listAllMarketPriceRecords`).
  2. Extracts a unique set of catalogue/record IDs from their titles using the user's configured matching-criteria regex (same `catalogueIdForTitle` function already used elsewhere).
  3. Searches eBay's Browse API for each record ID, filtered to **auction listings only** (`fetchEbayBrowseSearchResponse` gains an optional buying-options filter; existing callers are unaffected).
  4. Applies the same category-match heuristic `live-relisting-discovery.ts` already uses, to avoid false positives on generic-looking record IDs.
  5. Checks the user's current watchlist (existing `GetMyeBayBuying` read) and skips anything already on it.
  6. Adds the remaining matches to the watchlist via the new `AddToWatchList` call.
  7. Returns a summary: record IDs searched, candidates found, already-watched (skipped), added, and any per-item failures.
- **New API route** (`POST /api/market-insights/watchlist-automation`) that runs this for the signed-in user, following the same auth/CSRF/session pattern as the existing capture route.
- **New UI button**, next to the existing "Capture all visible" action, that triggers the route and shows a result summary.

Per our earlier discussion, **this ships as a manually-triggered action for now** — scheduling it to run automatically once a day is deferred until the app is actually deployed somewhere that runs unattended (today it's only `next dev` on this Mac). The regex used comes from the request body (same pattern as every other endpoint today, since matching preferences aren't persisted server-side); true unattended scheduling will eventually need that persisted, but that's a follow-up, not part of this change.

## Out of Scope

- Actual daily scheduling / cron / always-on hosting — deferred until deployment.
- Persisting matching preferences server-side — a prerequisite for *unattended* scheduling later, not needed for a manually-triggered button.
- Any change to how ended-watchlist items get captured into price history — that pipeline already exists and is untouched; this change only feeds it more watchlist entries.
- Removing items from the watchlist, or any other watchlist mutation besides adding.

## Success Criteria

- Clicking the new button, for a signed-in user with a connected eBay account, discovers live auction listings matching their purchase/price history's catalogue numbers and adds new ones to their real eBay watchlist.
- Items already on the watchlist are not re-added or double-counted.
- Listings that aren't auctions (fixed-price / Buy It Now) are never added.
- The summary returned distinguishes searched vs. found vs. already-watched vs. newly-added vs. failed, so the user can see what happened.
- A single item's `AddToWatchList` failure doesn't abort the rest of the batch.
