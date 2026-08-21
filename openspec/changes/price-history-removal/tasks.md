# Tasks: Remove unwanted items from captured price history

- [x] Create OpenSpec change documenting the design.
- [x] Wait for user sign-off on this design before implementing.
- [x] Implement `deleteMarketPriceRecords(userId, venueItemIds)` in `src/persistence/market-price-records.ts`.
- [x] Implement `DELETE /api/market-insights/history` route.
- [x] Add "Remove from history" per-item button to `AnalyticsRow`, gated on `item.captured && item.list === "WatchList"`, with a `confirm()` prompt.
- [x] Add "Delete all visible" bulk button to `Analytics`, targeting `filteredItems` narrowed to the deletable subset, with a `confirm()` prompt showing the count.
- [x] Add `removeHistoryItems`/`onItemsRemoved` state-reconciliation wiring, mirroring the existing `markItemsCaptured`/`onItemsCaptured` pattern.
- [x] Add CSS (`.danger-action`, using the existing `--bad` token) for the destructive-action button styling.
- [x] Unit/integration tests for `deleteMarketPriceRecords`: scoped deletion, cross-user isolation, empty-input no-op, accurate `deletedCount`.
- [x] Run OpenSpec validation (48/48), unit tests (191/191), persistence integration tests (34/34), build — all clean.
- [x] Manual functional confirmation: single-item delete (ABBA DSP5102 record) and bulk "delete all visible" via search (RJL-8007) both confirmed against real captured price history, verified directly in the database. Fixed a related robustness gap found during testing: `deleteHistoryItems` didn't catch a network-level fetch failure, so a genuine connectivity issue (which is what caused an initial false-negative test, tracing back to the dev server having been torn down between sessions) failed silently with no user-facing message — now shows an error message in that case too.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
