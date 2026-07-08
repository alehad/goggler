# Tasks: Fix price currency consistency

- [x] Create OpenSpec change for price currency consistency fix.
- [x] Verify root cause against live Production eBay data before finalizing the design (debug capture of raw Trading API and Browse API responses).
- [x] Update `browse-client.ts`'s `moneyValue()` to prefer `convertedFromValue`/`convertedFromCurrency` over `value`/`currency` when present.
- [x] Add `fetchEbayItemNativePrice()` (Browse API `get_item_by_legacy_id`) and `assertTrustedBrowseItemUrl()` to `browse-client.ts`.
- [x] Wire watchlist item construction in `live-history-source.ts` to look up native price via Browse API (bounded concurrency) with fallback to the Trading-API-parsed price, then to unavailable.
- [x] Remove the `{ value: 0, currency: "GBP" }` fallback in `toWatchlistItem`; make `HomeFeedWatchlistItem.currentPrice` optional.
- [x] Remove `buildPurchaseStats`/`PurchaseStats` from `src/ebay/purchase-analytics.ts` and the three metric cards from the Won tab in `app/page.tsx`.
- [x] Update `test/ebay/browse-client.test.mjs`, `test/ebay/live-history-source.test.mjs`, `test/ebay/purchase-analytics.test.mjs`, and `test/ebay/home-feed.test.mjs` for the above.
- [x] Remove temporary debug logging (`GOGGLER_DEBUG_CURRENCY`) from `trading-client.ts` and the temporary `.env.local` flag before shipping.
- [x] Run OpenSpec validation, unit tests, build, and lint.
- [x] Manual functional test against Production eBay (Green Caterpillar and other confirmed USD items show `$`) before requesting sign-off.
- [ ] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
