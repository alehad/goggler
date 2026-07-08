# Tasks: Market insights price history capture (stage 1)

- [x] Create OpenSpec change for market insights price history capture.
- [x] Add `MarketPriceRecord` Prisma model and migration.
- [x] Add `src/persistence/market-price-records.ts` (capture upsert, list captured venue item ids).
- [x] Surface ended watchlist items in `live-history-source.ts` (`endedWatchlistItems` on `EbayHistoryResponse`), including fixture-mode coverage.
- [x] Add lightweight `fetchEndedWatchlistItems` for the capture endpoint's live re-verification.
- [x] Add `src/market-insights/price-history.ts` module (`listCaptureCandidates`, `captureItems`).
- [x] Add `app/api/market-insights/capture/route.ts`.
- [x] Add the Analytics bottom tab in `app/page.tsx`: candidate list, per-item capture, bulk capture, captured/not-captured filter.
- [x] Add/update tests: `live-history-source.test.mjs`, new `market-price-records.integration.mjs`, new `price-history.integration.mjs`.
- [x] Apply the Browse API native-price preference to ended watchlist items too (discovered live: eBay silently converts ended-item prices the same way it did for active watchlist items).
- [x] Fix bottom nav grid (`repeat(4, ...)` → `repeat(5, ...)`) after adding the Analytics tab.
- [x] Avoid a full history refetch after capture; update captured status locally from the capture response.
- [x] Run OpenSpec validation, unit tests, persistence integration tests, build, and lint.
- [x] Manual functional test against Production eBay before requesting sign-off.
- [ ] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
