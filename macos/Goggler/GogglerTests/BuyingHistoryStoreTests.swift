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
    }
}

@Suite("BuyingHistoryStore")
@MainActor
struct BuyingHistoryStoreTests {
    @Test("A reachable backend populates state and marks the backend reachable")
    func reachableBackendSucceeds() async throws {
        MockURLProtocol.handler = { request in
            if request.url?.path == "/api/ebay/buying-history" {
                let body = #"{"source":"live","counts":{"lost":0,"won":0,"eventuallyWon":0,"neverWon":0,"watchlist":0,"watchlistRelistings":0,"needsAction":0,"relistings":0},"lostItems":[],"wonItems":[]}"#
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
}
