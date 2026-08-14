# Change: Fix GetOrders rejecting the raised watchlist page size

## Why

`fix-watchlist-pagination-truncation` raised `entriesPerPage` from 50 to 200 to stop the ended-watchlist fetch from silently truncating. That value was shared with the `GetOrders` call (used to supplement won-item history), but eBay's `GetOrders` rejects `EntriesPerPage` above 100 (observed as Trading API error code 10007), unlike `GetMyeBayBuying` which accepts 200. This surfaced immediately as a new "GetOrders buyer purchases unavailable" warning banner on the Dashboard tab — a regression, not the pre-existing truncation issue that change intentionally started surfacing.

## What Changes

- `GetOrders`'s request now always caps `EntriesPerPage` at 100, independent of whatever larger value is used for `WatchList`/`LostList`/`WonList`.

## Out Of Scope

- Any other change to the watchlist pagination fix — the 200/10 cap for `GetMyeBayBuying` calls stays as-is; only `GetOrders` needs its own ceiling.

## Success Criteria

- The Dashboard tab no longer shows a "GetOrders buyer purchases unavailable" warning caused by an oversized page-size request.
- Won-item history via `GetOrders` continues to work as it did before the pagination change.
