# Tasks: Fix price-history capture silently dropping valid items

- [x] Create OpenSpec change documenting the bug and fix.
- [x] Get user sign-off on the targeted-per-item-lookup design.
- [x] Export `fetchNativeWatchlistPrices` from `src/ebay/live-history-source.ts`.
- [x] Rewrite `captureItems` in `src/market-insights/price-history.ts` to take item objects instead of ids, drop the `accessToken`/Trading API dependency, and verify price via per-item Browse lookup.
- [x] Update `app/api/market-insights/capture/route.ts`: drop `requireSessionEbayAccessToken`, accept `{ items: [...] }` with field-level validation, keep CSRF check.
- [x] Update `Analytics` in `app/page.tsx`: send item objects instead of ids; surface `result.skipped` as a message naming skipped items.
- [x] Rewrite `captureItems` tests in `test/market-insights/price-history.integration.mjs` for the new signature (mock Browse price lookup only, no watchlist XML).
- [x] Run OpenSpec validation, unit tests, persistence integration tests, build.
- [x] Manual functional test against Production eBay before requesting sign-off.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
