# Design: Fix GetOrders rejecting the raised watchlist page size

## Change

`src/ebay/live-history-source.ts` gains a module-level constant and caps `GetOrders`'s page size independently of the shared watchlist `entriesPerPage`:

```ts
/**
 * GetOrders rejects EntriesPerPage above 100 (eBay error 10007), unlike
 * GetMyeBayBuying which accepts up to 200 — so it can't share the same
 * entriesPerPage value used for WatchList/LostList/WonList.
 */
const GET_ORDERS_MAX_ENTRIES_PER_PAGE = 100;
```

used at the `fetchBuyerOrdersSupplement` call site:

```ts
entriesPerPage: Math.min(entriesPerPage, GET_ORDERS_MAX_ENTRIES_PER_PAGE),
```

`WatchList`/`LostList`/`WonList` keep using the full, uncapped `entriesPerPage` (200 by default, from the pagination-truncation fix) — only the `GetOrders` request is capped.

## Testing

- New unit test in `test/ebay/live-history-source.test.mjs`: with `entriesPerPage: 200` passed in, asserts the `GetOrders` request body contains `<EntriesPerPage>100</EntriesPerPage>` while the `WatchList` request body contains `<EntriesPerPage>200</EntriesPerPage>` — proving the cap applies only to `GetOrders`.
- Manual: confirm the "GetOrders buyer purchases unavailable" warning no longer appears on the Dashboard tab.
