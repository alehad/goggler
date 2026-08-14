# Change: Fix silent watchlist truncation dropping ended items

## Why

Investigating a report that only 2 of 4 ended "TBM63" watchlist items (confirmed present on the user's actual eBay "Watching" page) ever showed up in the Analytics tab, we found the ended-watchlist fetch caps out at `entriesPerPage=50 × maxPages=3 = 150` total watchlist entries (active + ended combined) per call to eBay's `GetMyeBayBuying`. The account has already captured 166 price-history records across 120 distinct relisting groups — a watcher active enough that the live combined watchlist plausibly exceeds 150 entries regularly. When it does, items beyond that window silently never reach `endedWatchlistItems`, and therefore never appear in the Analytics tab at all, regardless of capture status.

This already gets detected internally — `fetchGetMyeBayBuyingPages` computes a `truncated` flag, and `fetchLiveEbayHistoryResponse` even builds a warning string for it (`"WatchList truncated after N pages"`) — but that warning is never returned from `/api/ebay/buying-history` or shown anywhere in the UI, so the data loss is completely silent.

## What Changes

- Raise the watchlist fetch's pagination cap so accounts of this size are covered: `entriesPerPage` 50 → 200 (eBay's Trading API maximum for this call), `maxPages` 3 → 10.
- Surface `warnings` (already computed, currently dropped) from `/api/ebay/buying-history` to the client, and show a visible message on the affected tab(s) if truncation is still hit despite the raised cap, instead of failing silently.

## Out Of Scope

- Changing pagination limits for `LostList`/`WonList`/relisting-discovery searches — not implicated by this report; can be revisited separately if a similar gap is found there.
- Any change to the capture-verification logic — separate, already-fixed issue (`fix-capture-item-verification`).

## Success Criteria

- All 4 (or however many) ended items for a given relisting group that are genuinely present in the user's live eBay watchlist show up in the Analytics tab.
- If a watchlist is ever large enough to still exceed the new cap, the user sees a clear warning instead of silently missing items.
