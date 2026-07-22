# Tasks: Market insights trend charting (stage 2)

- [x] Create OpenSpec change for trend charting.
- [x] Add `listMarketPriceRecordsByGroup` to `src/persistence/market-price-records.ts`.
- [x] Add `listWonItemsForGroup` (in-memory relisting-group filter over `WonItem`) to `src/persistence/won-items.ts`.
- [x] Add `listMatchedSales` merge logic to `src/market-insights/price-history.ts`.
- [x] Add `app/api/market-insights/matched-sales/route.ts` (`GET`).
- [x] Add `won?: boolean` to `PurchaseChartPoint` (`src/ebay/purchase-analytics.ts`) and render it in `PurchaseChart`; add the CSS highlight.
- [x] Add the search box to the Analytics tab, filtering the ended-items list client-side.
- [x] Move the chart above the item list in the Analytics tab; wire row selection to the matched-sales fetch.
- [x] Add the five summary `Metric` cards (count, my price paid + date, average, lowest + date, highest + date).
- [x] Add/update tests per design.md.
- [x] Run OpenSpec validation, unit tests, persistence integration tests, build, and lint.
- [x] Manual functional test against Production eBay before requesting sign-off.
- [x] Run dual security review (security-review skill + Copilot CLI) after sign-off, then ship via PR.
