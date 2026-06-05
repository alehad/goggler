# Change: Supplement purchases with GetOrders

## Why

Production testing shows `GetMyeBayBuying.WonList` does not include all purchases visible in the user's eBay purchase history. The cutoff appears close to eBay's documented My eBay won-list history window, not an app-side date filter or paging limit. Purchases before that window should still be useful in goggler's Purchases tab and in relisting resolution logic.

eBay Trading API `GetOrders` can retrieve orders where the authenticated user is the buyer using `OrderRole=Buyer`. We should use it as a supplemental read source for won/purchased items and merge its results with `WonList`.

## What Changes

- Add a Trading API `GetOrders` client path for buyer orders.
- Fetch buyer orders in explicit date windows up to eBay's allowed lookback.
- Normalize buyer order line items into the same won-item shape used by Purchases and Home.
- Run both `GetMyeBayBuying.WonList` and buyer `GetOrders`.
- Compare, deduplicate, and return the superset of won/purchased items.
- Preserve diagnostics that show how many items came from each source, how many overlapped, and whether either source was truncated or window-limited.

## Out Of Scope

- Persisting imported purchases.
- Calling seller-only order APIs or adding seller workflows.
- Retrieving purchases beyond eBay's supported buyer-order lookback.
- Scraping eBay web purchase history.
- Adding new write scopes or mutating the user's eBay account.

## Success Criteria

- Purchases returned only by `WonList` are preserved.
- Purchases returned only by buyer `GetOrders` are added to `wonItems`.
- Purchases returned by both APIs are deduplicated into one row.
- Diagnostics expose source counts and overlap for local verification.
- Missing `GetOrders` data fails softly: the app can still show `WonList` results with a warning.
