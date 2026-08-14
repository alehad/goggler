# Tasks: Union ended-watchlist items with historical captures

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Add `listAllMarketPriceRecords(userId)` to `src/persistence/market-price-records.ts`.
- [x] Update `listCaptureCandidates` in `src/market-insights/price-history.ts` to union live-fetched and historical items.
- [x] Add/update tests.
- [x] Run OpenSpec validation, unit tests, persistence integration tests, build.
- [x] Manual functional test against Production eBay before requesting sign-off.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
