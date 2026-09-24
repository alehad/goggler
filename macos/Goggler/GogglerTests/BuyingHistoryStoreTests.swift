import Testing
import Foundation
@testable import Goggler

/// Always fails at the network level, simulating a down Tailscale connection
/// (as opposed to `MockURLProtocol`, which simulates a reachable server).
final class FailingURLProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
    }

    override func stopLoading() {}
}

@Suite("BuyingHistory decoding")
struct BuyingHistoryDecodingTests {
    @Test("Decodes lostItems, wonItems, and counts, ignoring homeFeed/warnings")
    func decodesBuyingHistory() throws {
        let json = """
        {
          "source": "live",
          "counts": {
            "lost": 1, "won": 1, "eventuallyWon": 1, "neverWon": 0,
            "watchlist": 0, "watchlistRelistings": 0, "needsAction": 0, "relistings": 0
          },
          "lostItems": [
            {
              "itemId": "1", "title": "Vintage lamp", "list": "LostList",
              "maxBid": { "value": 12.5, "currency": "GBP" },
              "relistingGroupId": "group-1"
            }
          ],
          "wonItems": [
            {
              "itemId": "2", "title": "Vintage lamp (relisted)", "list": "WonList",
              "currentPrice": { "value": 15, "currency": "GBP" },
              "relistingGroupId": "group-1"
            }
          ],
          "endedWatchlistItems": [
            {
              "itemId": "3", "title": "Another lamp", "list": "WatchList",
              "captured": true
            }
          ],
          "homeFeed": { "rows": [], "counts": {} },
          "warnings": ["some warning"]
        }
        """

        let history = try JSONDecoder().decode(BuyingHistory.self, from: Data(json.utf8))

        #expect(history.source == "live")
        #expect(history.counts.eventuallyWon == 1)
        #expect(history.lostItems.count == 1)
        #expect(history.lostItems[0].maxBid?.value == 12.5)
        #expect(history.wonItems[0].relistingGroupId == "group-1")
        #expect(history.endedWatchlistItems[0].captured == true)
        #expect(history.lostItems[0].captured == nil)
    }
}

@Suite("BuyingHistoryStore")
@MainActor
struct BuyingHistoryStoreTests {
    @Test("A reachable backend populates state and marks the backend reachable")
    func reachableBackendSucceeds() async throws {
        MockURLProtocol.handler = { request in
            if request.url?.path == "/api/ebay/buying-history" {
                let body = #"{"source":"live","counts":{"lost":0,"won":0,"eventuallyWon":0,"neverWon":0,"watchlist":0,"watchlistRelistings":0,"needsAction":0,"relistings":0},"lostItems":[],"wonItems":[],"endedWatchlistItems":[]}"#
                return (Data(body.utf8), 200)
            }
            if request.url?.path == "/api/auth/ebay/session" {
                let body = #"{"connection":{"connected":false,"status":"not_connected","scopes":[]}}"#
                return (Data(body.utf8), 200)
            }
            let body = #"{"config":{"ready":true,"environment":"production","missing":[],"invalid":[],"marketplaceId":"EBAY_GB","tradingSiteId":"3","scopeCount":1}}"#
            return (Data(body.utf8), 200)
        }

        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])
        let store = BuyingHistoryStore()
        await store.refresh(using: client)

        #expect(store.connectionLoadFailed == false)
        #expect(store.isBackendConfirmedReachable == true)
        if case .ready = store.buyingHistoryState {
            // expected
        } else {
            Issue.record("Expected .ready, got \(store.buyingHistoryState)")
        }
    }

    @Test("An unreachable backend is reflected in connectionLoadFailed / isBackendConfirmedReachable")
    func unreachableBackendFails() async throws {
        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [FailingURLProtocol.self])
        let store = BuyingHistoryStore()
        await store.refresh(using: client)

        #expect(store.connectionLoadFailed == true)
        #expect(store.isBackendConfirmedReachable == false)
        #expect(store.connectivityIssue == .tunnelUnreachable)
    }

    @Test("A 502 (Tailscale up, backend down) is classified as backendUnreachable, not tunnelUnreachable")
    func backendDownWithTailscaleUpIsClassifiedCorrectly() async throws {
        // Matches what `tailscale serve` actually returns when Tailscale is
        // connected but nothing is listening behind it — confirmed empirically
        // by killing the dev server with Tailscale still up and inspecting the
        // real response (a genuine HTTP 502, not a network-level failure).
        MockURLProtocol.handler = { _ in (Data(), 502) }

        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])
        let store = BuyingHistoryStore()
        await store.refresh(using: client)

        #expect(store.connectionLoadFailed == true)
        #expect(store.isBackendConfirmedReachable == false)
        #expect(store.connectivityIssue == .backendUnreachable)
    }

    @Test("captureItems updates the matching item's captured flag in place, no refresh needed")
    func captureItemsUpdatesStateInPlace() async throws {
        let store = try await loadedStore(endedWatchlistItemsJSON: #"[{"itemId":"w1","title":"Lamp","list":"WatchList","captured":false}]"#)

        MockURLProtocol.handler = { _ in (Data(#"{"captured":["w1"],"skipped":[]}"#.utf8), 200) }
        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])

        guard case .ready(let historyBefore) = store.buyingHistoryState else {
            Issue.record("Expected .ready before capture")
            return
        }
        let result = await store.captureItems([historyBefore.endedWatchlistItems[0]], using: client)

        #expect(result?.captured == ["w1"])
        guard case .ready(let historyAfter) = store.buyingHistoryState else {
            Issue.record("Expected .ready after capture")
            return
        }
        #expect(historyAfter.endedWatchlistItems[0].captured == true)
    }

    @Test("captureItems leaves state untouched on failure")
    func captureItemsLeavesStateUntouchedOnFailure() async throws {
        let store = try await loadedStore(endedWatchlistItemsJSON: #"[{"itemId":"w1","title":"Lamp","list":"WatchList","captured":false}]"#)

        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [FailingURLProtocol.self])
        guard case .ready(let historyBefore) = store.buyingHistoryState else {
            Issue.record("Expected .ready before capture")
            return
        }
        let result = await store.captureItems([historyBefore.endedWatchlistItems[0]], using: client)

        #expect(result == nil)
        guard case .ready(let historyAfter) = store.buyingHistoryState else {
            Issue.record("Expected .ready after failed capture")
            return
        }
        #expect(historyAfter.endedWatchlistItems[0].captured == false)
    }

    @Test("deleteItems removes the matching item in place, no refresh needed")
    func deleteItemsRemovesInPlace() async throws {
        let store = try await loadedStore(endedWatchlistItemsJSON: #"[{"itemId":"w1","title":"Lamp","list":"WatchList","captured":true}]"#)

        MockURLProtocol.handler = { _ in (Data(#"{"deletedCount":1}"#.utf8), 200) }
        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])

        let succeeded = await store.deleteItems(["w1"], using: client)

        #expect(succeeded == true)
        guard case .ready(let historyAfter) = store.buyingHistoryState else {
            Issue.record("Expected .ready after delete")
            return
        }
        #expect(historyAfter.endedWatchlistItems.isEmpty)
    }

    @Test("deleteItems leaves state untouched on failure")
    func deleteItemsLeavesStateUntouchedOnFailure() async throws {
        let store = try await loadedStore(endedWatchlistItemsJSON: #"[{"itemId":"w1","title":"Lamp","list":"WatchList","captured":true}]"#)

        MockURLProtocol.handler = { _ in (Data(#"{"error":"deletion_failed"}"#.utf8), 502) }
        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])

        let succeeded = await store.deleteItems(["w1"], using: client)

        #expect(succeeded == false)
        guard case .ready(let historyAfter) = store.buyingHistoryState else {
            Issue.record("Expected .ready after failed delete")
            return
        }
        #expect(historyAfter.endedWatchlistItems.count == 1)
    }

    /// Loads a store into `.ready` with a fixed `endedWatchlistItems` fixture,
    /// via the same config-status/session/buying-history sequence `refresh`
    /// always runs.
    private func loadedStore(endedWatchlistItemsJSON: String) async throws -> BuyingHistoryStore {
        MockURLProtocol.handler = { request in
            if request.url?.path == "/api/ebay/buying-history" {
                let body = """
                {"source":"live","counts":{"lost":0,"won":0,"eventuallyWon":0,"neverWon":0,"watchlist":0,"watchlistRelistings":0,"needsAction":0,"relistings":0},"lostItems":[],"wonItems":[],"endedWatchlistItems":\(endedWatchlistItemsJSON)}
                """
                return (Data(body.utf8), 200)
            }
            if request.url?.path == "/api/auth/ebay/session" {
                return (Data(#"{"connection":{"connected":true,"status":"connected_this_session","scopes":[]}}"#.utf8), 200)
            }
            return (Data(#"{"config":{"ready":true,"environment":"production","missing":[],"invalid":[],"marketplaceId":"EBAY_GB","tradingSiteId":"3","scopeCount":1}}"#.utf8), 200)
        }

        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])
        let store = BuyingHistoryStore()
        await store.refresh(using: client)
        return store
    }
}

@Suite("AnalyticsView.computeAnalyticsItems")
struct AnalyticsItemComputationTests {
    private func item(_ id: String, list: String, endTime: String? = nil, relistingGroupId: String? = nil, captured: Bool? = nil) -> HistoryItem {
        HistoryItem(
            itemId: id,
            title: "Item \(id)",
            list: list,
            currentPrice: nil,
            maxBid: nil,
            endTime: endTime,
            sellerUserId: nil,
            conditionDisplayName: nil,
            imageUrl: nil,
            itemWebUrl: nil,
            relistingGroupId: relistingGroupId,
            captured: captured
        )
    }

    @Test("Derives won and eventuallyWon from wonItems, sorted by endTime descending")
    func derivesFlagsAndSortsByEndTimeDescending() {
        let endedWatchlistItems = [
            item("w1", list: "WatchList", endTime: "2026-01-01T00:00:00Z", relistingGroupId: "group-a", captured: false),
            item("w2", list: "WatchList", endTime: "2026-03-01T00:00:00Z", captured: true)
        ]
        let wonItems = [
            item("won1", list: "WonList", endTime: "2026-02-01T00:00:00Z", relistingGroupId: "group-a")
        ]

        let result = computeAnalyticsItems(endedWatchlistItems: endedWatchlistItems, wonItems: wonItems)

        #expect(result.map(\.id) == ["w2", "won1", "w1"])
        #expect(result.first { $0.id == "w1" }?.eventuallyWon == true)
        #expect(result.first { $0.id == "w1" }?.won == false)
        #expect(result.first { $0.id == "won1" }?.won == true)
    }

    @Test("A won item already on the watchlist is not duplicated as a won-only row")
    func doesNotDuplicateWonItemAlreadyOnWatchlist() {
        let endedWatchlistItems = [item("shared1", list: "WatchList", captured: true)]
        let wonItems = [item("shared1", list: "WonList")]

        let result = computeAnalyticsItems(endedWatchlistItems: endedWatchlistItems, wonItems: wonItems)

        #expect(result.count == 1)
        #expect(result[0].won == true)
        #expect(result[0].captured == true)
    }

    @Test("Won-only rows default to not captured")
    func wonOnlyRowsDefaultToNotCaptured() {
        let result = computeAnalyticsItems(endedWatchlistItems: [], wonItems: [item("won1", list: "WonList")])

        #expect(result[0].captured == false)
    }
}

struct ChatAnswerDecodingTests {
    @Test("Decodes a POST /api/market-insights/chat response")
    func decodesChatAnswer() throws {
        let json = #"{"answer":"You paid £62.50 for it.","itemIds":["ended-001","ended-002"]}"#
        let result = try JSONDecoder().decode(ChatAnswer.self, from: Data(json.utf8))

        #expect(result.answer == "You paid £62.50 for it.")
        #expect(result.itemIds == ["ended-001", "ended-002"])
    }

    @Test("Decodes an empty itemIds array")
    func decodesEmptyItemIds() throws {
        let json = #"{"answer":"I couldn't find a match.","itemIds":[]}"#
        let result = try JSONDecoder().decode(ChatAnswer.self, from: Data(json.utf8))

        #expect(result.itemIds.isEmpty)
    }
}

struct AnalyticsAssistantMarkdownTests {
    @Test("Strips link-ness from a Markdown link so item titles can't become tappable phishing links")
    func stripsLinks() throws {
        let attributed = try #require(analyticsAssistantMarkdown("Your item [Free gift — claim now](https://evil.example/phish) sold for £62.50."))

        #expect(attributed.runs.allSatisfy { $0.link == nil })
        #expect(String(attributed.characters).contains("Free gift — claim now"))
    }

    @Test("Strips link-ness from a Markdown autolink too, not just [text](url) syntax")
    func stripsAutolinks() throws {
        let attributed = try #require(analyticsAssistantMarkdown("See <https://evil.example/phish> for details."))

        #expect(attributed.runs.allSatisfy { $0.link == nil })
    }

    @Test("Plain bold text still renders as an AttributedString")
    func rendersPlainFormatting() throws {
        let attributed = try #require(analyticsAssistantMarkdown("Your **highest paid** item was £62.50."))

        #expect(String(attributed.characters).contains("highest paid"))
    }
}

struct FilterAnalyticsItemsTests {
    private func analyticsItem(_ id: String, captured: Bool = false, won: Bool = false, eventuallyWon: Bool = false, title: String = "", sellerUserId: String? = nil) -> AnalyticsItem {
        AnalyticsItem(
            item: HistoryItem(
                itemId: id,
                title: title.isEmpty ? "Item \(id)" : title,
                list: "WatchList",
                currentPrice: nil,
                maxBid: nil,
                endTime: nil,
                sellerUserId: sellerUserId,
                conditionDisplayName: nil,
                imageUrl: nil,
                itemWebUrl: nil,
                relistingGroupId: nil,
                captured: captured
            ),
            won: won,
            eventuallyWon: eventuallyWon
        )
    }

    @Test("An AI filter returns exactly the referenced items, in that order, overriding the other filters")
    func aiFilterOverridesOtherFilters() {
        let items = [
            analyticsItem("a", captured: true),
            analyticsItem("b", captured: false),
            analyticsItem("c", captured: true)
        ]

        // captureFilter/winFilter/searchQuery would normally exclude "b" and
        // reorder the rest — the AI filter must ignore all of that.
        let result = filterAnalyticsItems(
            items,
            aiFilterItemIds: ["c", "b"],
            captureFilter: .captured,
            winFilter: .all,
            searchQuery: "nonexistent-term"
        )

        #expect(result.map(\.id) == ["c", "b"])
    }

    @Test("An AI-referenced id with no matching item is silently skipped")
    func aiFilterSkipsUnmatchedIds() {
        let items = [analyticsItem("a")]

        let result = filterAnalyticsItems(
            items,
            aiFilterItemIds: ["missing", "a"],
            captureFilter: .all,
            winFilter: .all,
            searchQuery: ""
        )

        #expect(result.map(\.id) == ["a"])
    }

    @Test("With no AI filter, capture/win/search filters apply as before")
    func nilAiFilterFallsThroughToExistingFilters() {
        let items = [
            analyticsItem("a", captured: true, title: "Blue Note LP"),
            analyticsItem("b", captured: false, title: "Blue Note LP"),
            analyticsItem("c", captured: true, title: "Unrelated record")
        ]

        let result = filterAnalyticsItems(
            items,
            aiFilterItemIds: nil,
            captureFilter: .captured,
            winFilter: .all,
            searchQuery: "blue note"
        )

        #expect(result.map(\.id) == ["a"])
    }
}
