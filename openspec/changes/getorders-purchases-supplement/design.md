# Design: Supplement purchases with GetOrders

## Current State

The live history source calls `GetMyeBayBuying` separately for:

- `WatchList`
- `LostList`
- `WonList`

`WonList` is used as the source for `wonItems`, Purchases analytics, and eventually-won matching. The request does not include an app-side date filter. eBay documentation describes `WonList.DurationInDays` with a maximum of 60 days, and eBay support material says `GetMyeBayBuying` can return a complete won list for the last 60 days from `WonList` and `DeletedFromWonList`.

## Proposed API Strategy

Keep `GetMyeBayBuying.WonList` as one source because it maps naturally to My eBay won rows and already works. Add `GetOrders` as a supplemental purchases source:

- Trading API call: `GetOrders`
- Auth: same session-scoped user OAuth token in `X-EBAY-API-IAF-TOKEN`
- Required role: `OrderRole=Buyer`
- Status: request all relevant order states initially unless testing shows only completed orders should be included
- Date filtering: use `CreateTimeFrom` / `CreateTimeTo` windows because `GetOrders` requires a date filter unless order IDs are supplied
- Lookback: use the documented maximum 90-day `GetOrders` request range, but point it at the older gap before `WonList`.

The first implementation should assume `WonList` covers the most recent 60 days, while production testing shows `GetOrders` rejects requests that start more than 90 days before today. `GetOrders` should therefore use the narrow valid gap window: `CreateTimeTo = now - 60 days` and `CreateTimeFrom = now - 90 days`. It should not pretend to retrieve older purchases if eBay does not return them.

## Normalization

Normalize `GetOrders.OrderArray.Order.TransactionArray.Transaction` rows into `EbayBuyingHistoryItem`-compatible won items:

- `itemId`: prefer the item ID when available; otherwise derive a stable source ID from order/transaction identifiers
- `title`: transaction item title when available
- `list`: `WonList`
- `currentPrice`: transaction price or line-item total, preserving returned currency
- `endTime`: order creation time or paid time, whichever is the best available purchase timestamp
- `sellerUserId`: seller user ID when available
- `imageUrl`: parse only trusted HTTPS image URLs if present
- `itemWebUrl`: parse only trusted eBay item URLs if present

If the response includes order-level totals but lacks item-level prices, keep the item with no `currentPrice` rather than inventing one.

## Merging And Deduplication

Run both sources and merge into a superset:

1. Fetch `WonList`.
2. Fetch buyer `GetOrders`.
3. Build a stable dedupe key for each purchase:
   - Prefer `OrderLineItemID` if available.
   - Else use `ItemID + TransactionID` if both are available.
   - Else use `ItemID` plus normalized purchase timestamp/title as a fallback.
4. If the same purchase exists in both sources, prefer the richer row:
   - keep trusted image/item URL if either source has it
   - keep price/currency if either source has it
   - keep the most useful date for Purchases charting
   - preserve a source marker internally for diagnostics

The public `wonItems` array can remain the existing shape for now. Diagnostics can be added as a non-breaking optional field on the history response.

## Diagnostics

Add optional live-source diagnostics, initially server/client visible only in route JSON:

- `wonListCount`
- `getOrdersCount`
- `mergedWonCount`
- `overlapCount`
- `wonListTruncated`
- `getOrdersTruncated`
- `getOrdersWindowDays`
- `getOrdersWindowEndDaysAgo`
- warnings for source failures or date-window limits

The UI does not need to render the diagnostics in the first implementation, but logging them during manual verification is useful. If the user-facing list is still surprising, a later UX change can display a compact warning.

## Error Handling

`GetOrders` must be supplemental, not a hard dependency:

- If `WonList` succeeds and `GetOrders` fails, return `WonList` results with a warning.
- If `WonList` fails and `GetOrders` succeeds, return `GetOrders` purchases plus watchlist/lost results if available.
- If both purchase sources fail, keep the existing live-history error behavior.
- Do not include OAuth tokens, client secrets, authorization codes, raw request headers, or raw XML in warnings sent to the browser.

## Verification

Automated tests should mock both XML APIs and cover:

- `GetOrders` request building with `OrderRole=Buyer`, date filters, pagination, and OAuth token only in headers
- parsing buyer order transactions into won items
- deduping overlap between `WonList` and `GetOrders`
- preserving `WonList`-only and `GetOrders`-only rows
- soft failure when `GetOrders` fails

Manual production verification should compare source counts against the user's visible eBay purchase history and confirm purchases before the current `WonList` cutoff appear when `GetOrders` returns them.

## Open Questions

- Does production `GetOrders` with `OrderRole=Buyer` return the missing buyer purchases for this account under the current OAuth token/scopes?
- Which timestamp gives the best Purchases chart placement: order create time, paid time, or transaction creation time?
- Does `GetOrders` return enough item title/image/url data for rows to look as rich as `WonList` rows?
- Should `DeletedFromWonList` also be included as a smaller supplement to `WonList`, independently of `GetOrders`?
