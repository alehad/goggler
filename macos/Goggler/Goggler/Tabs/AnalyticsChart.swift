import Charts
import SwiftUI

/// Native port of `PurchaseChart` in app/page.tsx, scoped to the Analytics
/// tab's matched-sales-over-time usage. Reproduces the web chart's
/// *behavior* (selectable points, won/not-won color distinction, empty
/// states) rather than hand-porting its manual pixel/tick math — Swift
/// Charts computes its own axis ticks idiomatically.
struct AnalyticsChart: View {
    let points: [MatchedSalePoint]
    let selectedItemId: String?
    let emptyLabel: String
    let subtitle: String?
    var onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading) {
                Text("Matched sales over time").font(.headline)
                Text(subtitle ?? defaultSubtitle).font(.caption).foregroundStyle(.secondary)
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

    private var defaultSubtitle: String {
        "\(points.count) matched sale\(points.count == 1 ? "" : "s")"
    }

    private var chart: some View {
        Chart(points) { point in
            PointMark(
                x: .value("Date", analyticsChartPointDate(point)),
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
                            guard
                                let nearest = analyticsChartNearestPoint(
                                    to: value.location,
                                    among: points,
                                    proxy: proxy,
                                    plotFrameOrigin: geometry[proxy.plotAreaFrame].origin
                                )
                            else { return }
                            onSelect(nearest)
                        }
                    )
            }
        }
    }
}

/// Swift Charts has no built-in "which mark did I tap" API for a `PointMark`
/// scatter chart (unlike `.chartXSelection`, which only resolves an
/// x-position, not a specific point at a specific y) — the documented
/// pattern is converting the tap location to a plot-area value via the
/// proxy, then finding the closest mark yourself. Nearest by on-screen pixel
/// distance, not data distance, so points on very different price scales
/// are still equally tappable. A free function (not a method) so it can be
/// unit tested directly without a running chart.
func analyticsChartNearestPoint(
    to location: CGPoint,
    among points: [MatchedSalePoint],
    proxy: ChartProxy,
    plotFrameOrigin: CGPoint
) -> String? {
    let plotLocation = CGPoint(x: location.x - plotFrameOrigin.x, y: location.y - plotFrameOrigin.y)
    return points
        .compactMap { point -> (String, CGFloat)? in
            guard
                let x = proxy.position(forX: analyticsChartPointDate(point)),
                let y = proxy.position(forY: point.price.value)
            else { return nil }
            let distance = hypot(x - plotLocation.x, y - plotLocation.y)
            return (point.id, distance)
        }
        .min { $0.1 < $1.1 }?.0
}

/// `endedAt` is an ISO 8601 timestamp string from the backend, but not
/// always the *same* ISO 8601 shape: a sale sourced from a captured
/// `MarketPriceRecord` has its `endedAt` JSON-serialized by Prisma with
/// fractional seconds (`.000Z`), while one sourced from a `WonItem`/live
/// eBay `endTime` has none — confirmed by a decode test failing against a
/// real fractional-seconds timestamp, the same two shapes `HistoryItem.endTime`
/// parsing elsewhere in this app only ever sees one of. Points with an
/// unparseable or missing date sort to `.distantPast` rather than being
/// dropped, matching how a malformed single point shouldn't break the whole
/// chart.
func analyticsChartPointDate(_ point: MatchedSalePoint) -> Date {
    guard let endedAt = point.endedAt else { return .distantPast }
    if let date = ISO8601DateFormatter().date(from: endedAt) {
        return date
    }
    let fractionalFormatter = ISO8601DateFormatter()
    fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return fractionalFormatter.date(from: endedAt) ?? .distantPast
}

#Preview {
    AnalyticsChart(
        points: [],
        selectedItemId: nil,
        emptyLabel: "Select an item below to see its price history",
        subtitle: nil,
        onSelect: { _ in }
    )
    .padding(24)
}
