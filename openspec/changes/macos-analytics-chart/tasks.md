# Tasks: macOS Analytics matched-sales price chart

- [ ] Create OpenSpec change documenting the design.
- [ ] Wait for user sign-off on this design before implementing.
- [ ] Add `MatchedSalePoint`/`MatchedSalesSummary`/`MatchedSalesResponse` to `GogglerModels.swift`.
- [ ] Add `queryItems` support to `GogglerAPIClient.request`/`requestDecoded`; confirm no existing call site is affected (all pass plain paths today).
- [ ] Add `selectedItemId`/`matchedSalesState` to `AnalyticsView`; wire row tap-to-select (and visual selected state) onto `AnalyticsRow`.
- [ ] Fetch matched sales via `.task(id: selectedItemId)`, gated on `relistingGroupId`/`currentPrice.currency` being present.
- [ ] New `AnalyticsChart.swift`: Swift Charts scatter plot, won/not-won color distinction, selected-point distinction, tap-to-select via `chartOverlay` nearest-point hit testing, the four empty/loading states.
- [ ] Metrics row (Sales / my price paid / Average / Lowest / Highest), reusing the existing `metric()` helper.
- [ ] Scroll-into-view via `ScrollViewReader` on selection change.
- [ ] Update `AnalyticsView.swift`'s stale header comment (no longer deferring the chart, or the already-shipped AI assistant).
- [ ] New `GogglerModels` decode tests for the matched-sales response shape; unit tests for any pure helpers extracted from `AnalyticsChart` (nearest-point/date parsing) if extraction doesn't force awkward plumbing.
- [ ] `xcodegen generate`, `xcodebuild build`, `xcodebuild test` clean.
- [ ] Manual functional testing pause — compare directly against the web app's Analytics chart for the same item(s): chart render, bidirectional point/row selection, all four empty/loading states, scroll-into-view, metrics values.
- [ ] Run dual security review (security-review skill + Copilot CLI).
- [ ] Ship via PR.
