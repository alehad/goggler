# Tasks: Purchases tab market context

- [x] Create OpenSpec change for purchases tab market context.
- [x] Resolve open design questions with the user.
- [x] Add `summarizeMatchedSales` helper to `src/market-insights/price-history.ts`; update the single-group matched-sales route to return it; add `listMatchedSalesSummaries` for the batch path.
- [x] Add `app/api/market-insights/matched-sales/summary/route.ts` (`POST`).
- [x] Switch the Analytics tab's five summary cards to the server-computed summary.
- [x] Add search box to the Purchases (`Won`) tab, filtering `wonItems` client-side.
- [x] Add per-item avg/min/max/diff stats to `PurchaseCard`, right-aligned next to price paid, with green/red diff coloring.
- [x] Lift `selectedItemId` for the Analytics tab up to `Home`; add `onViewPriceHistory` wiring from `Won` to switch tabs and select the item.
- [x] Rewire `PurchaseCard`'s rightmost action button to call `onViewPriceHistory` instead of linking to eBay; drop the eBay link.
- [x] Add scroll-into-view behavior for the selected row in the Analytics tab (mirroring the Won tab).
- [x] Merge `wonItems` into the Analytics tab's item list, date-interleaved, with capture-status and win-status tags/badges.
- [x] Add a second segmented filter (win status: All/Won/Eventually won/Never won) to the Analytics tab, combined with the existing capture-status filter.
- [x] Add/update tests per design.md.
- [x] Run OpenSpec validation, unit tests, persistence integration tests, build, and lint (lint not configured in this repo — no ESLint config exists, so skipped as not applicable).
- [x] Manual functional test against Production eBay before requesting sign-off.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
