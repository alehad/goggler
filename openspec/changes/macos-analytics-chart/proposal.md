# Proposal: macOS Analytics matched-sales price chart

## Why

Both `macos-analytics-tab/proposal.md` and `macos-purchases-tab/proposal.md` explicitly deferred "the matched-sales price-over-time chart" as "a real, separately-scoped Swift Charts piece." The AI assistant half of that same deferral list has since shipped ([[macos-analytics-ai-assistant]], [[macos-analytics-voice-input]]), but the chart itself never has — `AnalyticsView.swift`'s header comment still says it's deferred. This closes that specific gap for the Analytics tab (the Purchases tab's own deferred chart stays out of scope — not requested here, and it has a different shape: "paid vs. average" per-row badges rather than a selectable scatter chart).

## What Changes

- **Row selection**: tapping an `AnalyticsRow` selects it (`@State selectedItemId` in `AnalyticsView`), mirroring the web app's click-to-select `onSelect`/`selected` prop on its own `AnalyticsRow`. Capture/delete buttons stay independently tappable (SwiftUI `Button` already intercepts its own tap before a parent gesture sees it, so no `stopPropagation`-equivalent is needed, unlike the web version).
- **Matched-sales fetch**: selecting an item with a `relistingGroupId` and `currentPrice` triggers `GET /api/market-insights/matched-sales?relistingGroupId=...&currency=...&exactTitleMatch=...&criteriaText=...` (same route the web app calls, same `DefaultMatchingPreferences` values already used by this view's AI assistant call) — no backend changes. Deselecting, or selecting an item missing either field, clears the result instead of fetching.
- **New `AnalyticsChart` view** (Swift Charts): a scatter plot of matched-sale points (date vs. price), reproducing the web chart's actual behavior — points colored by won/not-won, the selected point visually distinct, tapping a point selects that item (bidirectional with row selection, matching the web app's `PurchaseChart` `onSelect`) — using Swift Charts' own idiomatic axis/tick rendering rather than hand-porting the web's manual weekly/price-step tick math pixel-for-pixel.
- **Metrics row**: Sales count / my price paid / average / lowest / highest, reusing the `metric()` helper `AnalyticsView` already has for its Items/Captured/Not captured row — same data the web app's own metrics row shows.
- **Scroll-into-view**: selecting an item scrolls the chart to the top of the visible area, matching the web app's `scrollIntoView` behavior, via `ScrollViewReader`.
- **Client enhancement**: `GogglerAPIClient.request`/`requestDecoded` gain an optional `queryItems: [URLQueryItem]?` parameter. The existing `baseURL.appendingPathComponent(path)` call would percent-encode a literal `?`/`&` in `path`, corrupting a query string — every existing call site passes a plain path with no query string today, so this is purely additive; building the URL via `URLComponents` only when `queryItems` is non-nil leaves current behavior unchanged.
- New `MatchedSalePoint`/`MatchedSalesSummary`/`MatchedSalesResponse` `Decodable` models in `GogglerModels.swift`, mirroring `MatchedSalePoint`/`MatchedSalesSummary` in `src/market-insights/price-history.ts` and the route's `{ sales, summary }` response shape exactly.
- Updates `AnalyticsView.swift`'s stale header comment, which still says the chart (and, confusingly, the already-shipped AI assistant) is deferred.

## Out of Scope

- The Purchases tab's own deferred chart/badge — different shape, not requested, left for a separate change.
- Any backend/`src/`/`app/api/*` change — this is a pure read against the existing `matched-sales` route.
- Matching-preferences settings UI — macOS has none yet (per `DefaultMatchingPreferences`'s own doc comment); this uses the same fixed defaults the AI assistant call already uses.

## Success Criteria

- Selecting an ended-watchlist or won item in the Analytics tab shows the same matched-sales chart data the web app would show for that item: same points, same won/not-won distinction, same metrics (sales count, my price paid, average, lowest, highest).
- Tapping a point in the chart selects that item, same as tapping its row — selection is bidirectional, matching the web app.
- The four empty/loading states (no selection, loading, selected item lacks matchable data, zero matched sales) each show a distinct message, matching the web app's `emptyLabel` branches.
- Selecting an item scrolls the chart into view.
- `xcodegen generate`, `xcodebuild build`, `xcodebuild test` all clean; existing 35 tests still pass plus new coverage for the added model decoding and any pure selection/filtering helpers extracted for testability (mirroring how `computeAnalyticsItems`/`filterAnalyticsItems` were pulled out as free functions specifically so `GogglerTests` could cover them without a running UI).
