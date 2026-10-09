# Design: macOS Analytics matched-sales price chart

## New models (`GogglerModels.swift`)

Mirrors `MatchedSalePoint`/`MatchedSalesSummary` in `src/market-insights/price-history.ts` and the route's `{ sales, summary }` body exactly, reusing the existing `Money` struct:

```swift
/// Mirrors `MatchedSalePoint` in src/market-insights/price-history.ts.
struct MatchedSalePoint: Decodable, Sendable, Identifiable {
    var id: String { venueItemId }
    let venueItemId: String
    let title: String
    let price: Money
    let endedAt: String?
    let won: Bool
}

/// Mirrors `MatchedSalesSummary` in src/market-insights/price-history.ts.
struct MatchedSalesSummary: Decodable, Sendable {
    struct Bound: Decodable, Sendable {
        let value: Double
        let endedAt: String?
    }

    let count: Int
    let average: Double
    let lowest: Bound
    let highest: Bound
}

/// Response of `GET /api/market-insights/matched-sales`.
struct MatchedSalesResponse: Decodable, Sendable {
    let sales: [MatchedSalePoint]
    let summary: MatchedSalesSummary?
}
```

## `GogglerAPIClient`: query-string support

Today every call site is POST/DELETE with a plain path and a JSON body — `baseURL.appendingPathComponent(path)` treats `path` as a single literal component and percent-encodes it, which would mangle a `?`/`&` query string. Rather than hand-build (and risk mis-escaping) a query string in the caller, add an optional `queryItems` parameter that builds the URL via `URLComponents` — `URLQueryItem` percent-encodes each value correctly, same guarantee `URLSearchParams` gives the web app:

```swift
func request(
    _ path: String,
    method: String = "GET",
    queryItems: [URLQueryItem]? = nil,
    jsonBody: [String: Sendable]? = nil
) async throws -> GogglerRawResponse {
    var url = baseURL.appendingPathComponent(path)
    if let queryItems, var components = URLComponents(url: url, resolvingAgainstBaseURL: true) {
        components.queryItems = queryItems
        if let composed = components.url {
            url = composed
        }
    }
    var urlRequest = URLRequest(url: url)
    // ...unchanged below
}
```

`requestDecoded` gains the same parameter and forwards it. No existing call site passes `queryItems`, so this is additive — confirmed by inspection of every current call site (all plain paths, no `?` in them today).

## Fetching matched sales (`AnalyticsView`)

New state, mirroring the web app's `selectedItemId`/`matchedSalesState` union:

```swift
@State private var selectedItemId: String?

private enum MatchedSalesState {
    case idle
    case loading
    case ready(sales: [MatchedSalePoint], summary: MatchedSalesSummary?)
    case unavailable
}
@State private var matchedSalesState: MatchedSalesState = .idle
```

Fetch via `.task(id: selectedItemId)` rather than a manually-tracked `Task` — SwiftUI cancels the previous task automatically when `selectedItemId` changes, which is the direct equivalent of the web app's `useEffect` cleanup setting a `cancelled` flag:

```swift
.task(id: selectedItemId) {
    guard let selectedItemId, let item = items.first(where: { $0.id == selectedItemId }) else {
        matchedSalesState = .idle
        return
    }
    guard let relistingGroupId = item.item.relistingGroupId, let currency = item.item.currentPrice?.currency else {
        matchedSalesState = .unavailable
        return
    }
    guard let client = appSettings.apiClient else { return }

    matchedSalesState = .loading
    do {
        let (response, _) = try await client.requestDecoded(
            "/api/market-insights/matched-sales",
            as: MatchedSalesResponse.self,
            queryItems: [
                URLQueryItem(name: "relistingGroupId", value: relistingGroupId),
                URLQueryItem(name: "currency", value: currency),
                URLQueryItem(name: "exactTitleMatch", value: "true"),
                URLQueryItem(name: "criteriaText", value: #"\b[A-Z]{1,5}-?\d{1,6}\b"#)
            ]
        )
        if !Task.isCancelled {
            matchedSalesState = .ready(sales: response.sales, summary: response.summary)
        }
    } catch {
        if !Task.isCancelled {
            matchedSalesState = .unavailable
        }
    }
}
```

The `exactTitleMatch`/`criteriaText` literals match `DefaultMatchingPreferences.requestBody`'s values exactly (that enum's dictionary shape suits a JSON body, not query items, so this inlines the same two values rather than reusing it as-is — flagged here rather than silently duplicating the constants unexplained).

`items` (the existing `computeAnalyticsItems` result) needs to be hoisted from `content(for:)`'s local `let` into something the `.task` modifier can read — it already only depends on `store.buyingHistoryState`, so a computed property on `AnalyticsView` reading `store.buyingHistoryState` works without restructuring `content(for:)`'s signature.

## `AnalyticsChart` view (new file, `Tabs/AnalyticsChart.swift`)

Swift Charts scatter plot. Reproduces the web chart's *behavior* (selectable points, won/not-won color distinction, empty states, metrics) rather than hand-porting its manual pixel/tick math — `Charts` computes its own axis ticks idiomatically.

```swift
import Charts
import SwiftUI

struct AnalyticsChart: View {
    let points: [MatchedSalePoint]
    let selectedItemId: String?
    let emptyLabel: String
    let subtitle: String?
    var onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading) {
                    Text("Matched sales over time").font(.headline)
                    Text(subtitle ?? defaultSubtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }

            if points.isEmpty {
                ContentUnavailableView(emptyLabel, systemImage: "chart.line.uptrend.xyaxis")
                    .frame(minHeight: 180)
            } else {
                chart
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(.separator))
    }

    private var defaultSubtitle: String { "\(points.count) matched sale\(points.count == 1 ? "" : "s")" }

    private var chart: some View {
        Chart(points) { point in
            PointMark(
                x: .value("Date", date(for: point)),
                y: .value("Price", point.price.value)
            )
            .foregroundStyle(point.won ? Color.red : Color.accentColor)
            .symbolSize(point.id == selectedItemId ? 160 : 70)
        }
        .chartXAxis { AxisMarks(preset: .automatic) }
        .chartYAxis { AxisMarks(preset: .automatic) }
        .frame(minHeight: 220)
        .chartOverlay { proxy in
            GeometryReader { geometry in
                Rectangle().fill(.clear).contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0).onEnded { value in
                            guard let nearest = nearestPoint(to: value.location, proxy: proxy, geometry: geometry) else { return }
                            onSelect(nearest)
                        }
                    )
            }
        }
    }

    /// Swift Charts has no built-in "which mark did I tap" API for a
    /// PointMark scatter chart (unlike `.chartXSelection`, which only
    /// resolves an x-position, not a specific point at a specific y) — the
    /// documented pattern is converting the tap location to a plot-area
    /// value via the proxy, then finding the closest mark yourself. Nearest
    /// by on-screen pixel distance, not data distance, so points on very
    /// different price scales are still equally tappable.
    private func nearestPoint(to location: CGPoint, proxy: ChartProxy, geometry: GeometryProxy) -> String? {
        let origin = geometry[proxy.plotAreaFrame].origin
        let plotLocation = CGPoint(x: location.x - origin.x, y: location.y - origin.y)
        return points
            .compactMap { point -> (String, CGFloat)? in
                guard let x = proxy.position(forX: date(for: point)), let y = proxy.position(forY: point.price.value) else { return nil }
                let distance = hypot(x - plotLocation.x, y - plotLocation.y)
                return (point.id, distance)
            }
            .min { $0.1 < $1.1 }?.0
    }

    private func date(for point: MatchedSalePoint) -> Date {
        point.endedAt.flatMap { ISO8601DateFormatter().date(from: $0) } ?? .distantPast
    }
}
```

Why red/accent rather than a hand-matched hex: the web app uses `--bad` (`#c24136`) for won points and `--accent`/`--accent-strong` (`#2563eb`/`#1d4ed8`) for everything else/selected — close enough to SwiftUI's semantic `.red`/`.accentColor` that reusing the system colors (consistent with how `statusPill` already uses literal RGB matches elsewhere in this file, but Swift Charts' own semantic roles are the more idiomatic fit for marks specifically) is preferred over hand-copying hex values into a charting API that already has color roles. Selection is shown via `symbolSize`, not a stroke ring (Swift Charts' `PointMark` has no built-in per-mark stroke-width API the way raw SVG `<circle>` does) — functionally equivalent (visually distinguishes the selected point) without fighting the framework.

## Row selection (`AnalyticsRow`, existing private struct)

```swift
private struct AnalyticsRow: View {
    // ...existing properties...
    let selected: Bool
    let onSelect: () -> Void

    var body: some View {
        HStack(alignment: .top) { /* ...unchanged content... */ }
            .padding(.vertical, 10)
            .padding(.horizontal, 8)
            .background(selected ? Color.accentColor.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 6))
            .contentShape(Rectangle())
            .onTapGesture { onSelect() }
    }
}
```

`Button`s for capture/delete sit inside this `HStack` already; SwiftUI resolves a `Button`'s tap before a parent view's plain `.onTapGesture` sees it (no `stopPropagation`-equivalent needed, confirmed against existing precedent in this codebase — `PurchaseCard`'s web counterpart needs `event.stopPropagation()` only because the DOM bubbles clicks by default, which SwiftUI's gesture system does not).

## Scroll-into-view

`AnalyticsView.body` wraps its existing `ScrollView` content in a `ScrollViewReader`, giving the chart section a stable id, and scrolls on selection change — direct equivalent of the web app's `document.getElementById("analytics-chart-panel")?.scrollIntoView(...)`:

```swift
ScrollViewReader { proxy in
    ScrollView {
        VStack(alignment: .leading, spacing: 20) {
            header
            // ...metrics row...
            AnalyticsChart(/* ... */)
                .id("analyticsChartPanel")
            // ...rest of content...
        }
        .padding(24)
    }
    .onChange(of: selectedItemId) { _, newValue in
        guard newValue != nil else { return }
        withAnimation { proxy.scrollTo("analyticsChartPanel", anchor: .top) }
    }
}
```

## Metrics row

Reuses the existing private `metric(_:_:)` helper `AnalyticsView` already has for Items/Captured/Not captured, shown only once `matchedSalesState` is `.ready` with at least one sale and an item is selected — same gating the web app's own metrics `summary-grid` uses (`selectedItem && matchedSalesState.status === "ready" && matchedSales.length > 0`):

- Sales → `summary?.count`
- My price paid → the matched sale whose `venueItemId == selectedItemId`'s price (falls back to the selected row's own `currentPrice` if that specific sale isn't itself in the matched-sales result, matching the web app's `myPricePaid` lookup)
- Average / Lowest / Highest → straight from `summary`

## Testing

- `MatchedSalesResponse`/`MatchedSalePoint`/`MatchedSalesSummary` decoding: new `GogglerModels` decode tests using a literal JSON fixture matching the route's real shape (same pattern `ChatAnswerDecodingTests` already uses for `ChatAnswer`).
- `nearestPoint` and `date(for:)` are pure and small enough to unit test directly if extracted as free functions (mirroring `filterAnalyticsItems`/`computeAnalyticsItems`'s existing precedent for keeping view logic testable without a running UI) — done during implementation if it doesn't force awkward plumbing.
- No automated coverage for the Swift Charts tap-gesture wiring itself or the live `.task(id:)` network fetch — same category as this view's existing AI-assistant network call, which `GogglerTests` doesn't cover either; manual testing pause covers this.
- Manual functional testing pause: select an item with matched sales, confirm the chart renders, confirm tapping a chart point selects that row (and vice versa), confirm the four empty/loading states each show their distinct message, confirm scroll-into-view fires on selection, compare directly against the equivalent web app state for the same item.
