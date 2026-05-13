# Tasks: Live eBay watchlist history source

## 1. Planning

- [x] Create OpenSpec change for live eBay watchlist/history source.
- [x] Document API direction, source selection, request shape, normalization, and Sandbox verification.
- [x] Keep real watchlist mutation out of scope.

## 2. Trading API Client

- [x] Extend `GetMyeBayBuying` request builder to support `WatchList`.
- [x] Add parser coverage for representative `WatchList` XML.
- [x] Add paging helper with per-list safety limit.
- [x] Add tests proving OAuth token stays in headers and never in XML body.

## 3. Live History Source

- [x] Add service that fetches live `WatchList`, `LostList`, and `WonList`.
- [x] Normalize live rows into existing history route response shape.
- [x] Preserve watchlist response order as `watchlistPosition`.
- [x] Build Home feed from live normalized rows.
- [x] Add recoverable normalized errors for HTTP, API acknowledgement, and malformed XML failures.

## 4. Route Integration

- [x] Wire `GOGGLER_EBAY_HISTORY_SOURCE=live` to the live source instead of returning `live_history_not_implemented`.
- [x] Keep fixture source behavior unchanged.
- [x] Add route tests using mocked eBay XML responses.
- [x] Add tests that no token values appear in route responses or thrown error messages.

## 5. Verification

- [x] Run unit tests.
- [x] Run TypeScript check.
- [x] Run advisory security review.
- [ ] Manually test live source through eBay Sandbox and ngrok.
