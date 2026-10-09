import Charts
import Foundation
import Testing
@testable import Goggler

struct MatchedSalesDecodingTests {
    @Test("Decodes a GET /api/market-insights/matched-sales response")
    func decodesMatchedSalesResponse() throws {
        let json = #"""
        {
          "sales": [
            { "venueItemId": "sale-001", "title": "Blue Note LP", "price": { "value": 42.5, "currency": "GBP" }, "endedAt": "2026-01-01T00:00:00.000Z", "won": false },
            { "venueItemId": "sale-002", "title": "Blue Note LP", "price": { "value": 55, "currency": "GBP" }, "endedAt": "2026-02-01T00:00:00.000Z", "won": true }
          ],
          "summary": {
            "count": 2,
            "average": 48.75,
            "lowest": { "value": 42.5, "endedAt": "2026-01-01T00:00:00.000Z" },
            "highest": { "value": 55, "endedAt": "2026-02-01T00:00:00.000Z" }
          }
        }
        """#
        let result = try JSONDecoder().decode(MatchedSalesResponse.self, from: Data(json.utf8))

        #expect(result.sales.count == 2)
        #expect(result.sales[0].id == "sale-001")
        #expect(result.sales[1].won == true)
        #expect(result.summary?.count == 2)
        #expect(result.summary?.average == 48.75)
        #expect(result.summary?.lowest.value == 42.5)
        #expect(result.summary?.highest.value == 55)
    }

    @Test("Decodes a response with no summary (fewer than one matched sale)")
    func decodesMissingSummary() throws {
        let json = #"{"sales":[],"summary":null}"#
        let result = try JSONDecoder().decode(MatchedSalesResponse.self, from: Data(json.utf8))

        #expect(result.sales.isEmpty)
        #expect(result.summary == nil)
    }
}

struct AnalyticsChartPointDateTests {
    @Test("Parses a Prisma-serialized endedAt with fractional seconds (a captured MarketPriceRecord)")
    func parsesFractionalSecondsDate() {
        let point = MatchedSalePoint(venueItemId: "a", title: "x", price: Money(value: 1, currency: "GBP"), endedAt: "2026-03-01T12:00:00.000Z", won: false)

        #expect(analyticsChartPointDate(point) != Date.distantPast)
    }

    @Test("Parses a plain ISO 8601 endedAt with no fractional seconds (a WonItem/live eBay endTime)")
    func parsesPlainDate() {
        let point = MatchedSalePoint(venueItemId: "a", title: "x", price: Money(value: 1, currency: "GBP"), endedAt: "2026-03-01T12:00:00Z", won: false)

        #expect(analyticsChartPointDate(point) != Date.distantPast)
    }

    @Test("A missing endedAt falls back to distantPast rather than crashing")
    func missingDateFallsBack() {
        let point = MatchedSalePoint(venueItemId: "a", title: "x", price: Money(value: 1, currency: "GBP"), endedAt: nil, won: false)

        #expect(analyticsChartPointDate(point) == Date.distantPast)
    }

    @Test("An unparseable endedAt falls back to distantPast rather than crashing")
    func malformedDateFallsBack() {
        let point = MatchedSalePoint(venueItemId: "a", title: "x", price: Money(value: 1, currency: "GBP"), endedAt: "not-a-date", won: false)

        #expect(analyticsChartPointDate(point) == Date.distantPast)
    }
}
