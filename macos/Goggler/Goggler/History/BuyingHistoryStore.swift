import Foundation
import Observation

/// Owns the one shared load of config-status/session/buying-history, mirroring
/// how `historyState` lives once at the top of `Home()` in app/page.tsx and is
/// shared by every tab that needs it (Home, Watchlist, and — in later phases —
/// Purchases/Analytics), rather than each tab fetching independently.
@MainActor
@Observable
final class BuyingHistoryStore {
    enum BuyingHistoryState {
        case idle
        case loading
        case reauthRequired
        case unavailable(message: String)
        case ready(BuyingHistory)
    }

    /// Distinguishes two failure shapes that both used to collapse into one
    /// generic "can't reach the server" message: a request that never got an
    /// HTTP response at all (Tailscale/tunnel down — fails at the TLS/routing
    /// layer, before reaching `tailscale serve`) vs. one that got a real HTTP
    /// response but a bad one, e.g. `tailscale serve`'s `502` when Tailscale
    /// is connected but nothing is listening on the backend. Confirmed
    /// empirically: killing the dev server with Tailscale still up produces
    /// a real `502`, not a network-level error.
    enum ConnectivityIssue {
        case tunnelUnreachable
        case backendUnreachable
    }

    private(set) var configStatus: EbayConfigStatus.Config?
    private(set) var connection: EbaySession.Connection?
    private(set) var connectionLoadFailed = false
    private(set) var connectivityIssue: ConnectivityIssue?
    private(set) var buyingHistoryState: BuyingHistoryState = .idle

    /// `true` once the config-status/session calls have completed without a
    /// network-level failure — i.e. the backend is reachable, independent of
    /// whether eBay itself is connected. This is what the startup gate waits on.
    var isBackendConfirmedReachable: Bool {
        !connectionLoadFailed && connection != nil
    }

    func refresh(using client: GogglerAPIClient) async {
        AppLog.network.debug("refresh(using:) starting, baseURL=\(client.baseURL.absoluteString, privacy: .public)")
        connectionLoadFailed = false
        connectivityIssue = nil
        buyingHistoryState = .loading

        await loadConnectionStatus(using: client)
        await loadBuyingHistory(using: client)

        AppLog.network.debug(
            "refresh(using:) finished, connectionLoadFailed=\(self.connectionLoadFailed, privacy: .public), isBackendConfirmedReachable=\(self.isBackendConfirmedReachable, privacy: .public)"
        )
    }

    private func loadConnectionStatus(using client: GogglerAPIClient) async {
        await load(path: "/api/auth/ebay/config-status", using: client, label: "config-status") { [self] data in
            let status = try JSONDecoder().decode(EbayConfigStatus.self, from: data)
            configStatus = status.config
            AppLog.network.debug("config-status: succeeded, ready=\(status.config.ready, privacy: .public)")
        }

        await load(path: "/api/auth/ebay/session", using: client, label: "session") { [self] data in
            let session = try JSONDecoder().decode(EbaySession.self, from: data)
            connection = session.connection
            AppLog.network.debug("session: succeeded, connected=\(session.connection.connected, privacy: .public)")
        }
    }

    /// Fetches `path` and, only on a 2xx response, hands the body to
    /// `onSuccess` — otherwise classifies the failure as `.tunnelUnreachable`
    /// (the request never got an HTTP response) or `.backendUnreachable` (it
    /// did, just not a good one — a bad status or an undecodable body).
    private func load(path: String, using client: GogglerAPIClient, label: String, onSuccess: (Data) throws -> Void) async {
        let raw: GogglerRawResponse
        do {
            raw = try await client.request(path)
        } catch {
            connectionLoadFailed = true
            connectivityIssue = .tunnelUnreachable
            AppLog.network.error("\(label, privacy: .public): request failed — \(Self.describe(error), privacy: .public)")
            return
        }

        guard (200..<300).contains(raw.statusCode) else {
            connectionLoadFailed = true
            connectivityIssue = .backendUnreachable
            AppLog.network.error("\(label, privacy: .public): backend returned statusCode=\(raw.statusCode, privacy: .public)")
            return
        }

        do {
            try onSuccess(raw.data)
        } catch {
            connectionLoadFailed = true
            connectivityIssue = .backendUnreachable
            AppLog.network.error("\(label, privacy: .public): decode failed — \(Self.describe(error), privacy: .public)")
        }
    }

    private func loadBuyingHistory(using client: GogglerAPIClient) async {
        do {
            let raw = try await client.request(
                "/api/ebay/buying-history",
                method: "POST",
                jsonBody: ["exactTitleMatch": true, "criteriaText": #"\b[A-Z]{1,5}-?\d{1,6}\b"#]
            )
            AppLog.network.debug("buying-history: statusCode=\(raw.statusCode, privacy: .public)")

            switch raw.statusCode {
            case 200..<300:
                let history = try JSONDecoder().decode(BuyingHistory.self, from: raw.data)
                buyingHistoryState = .ready(history)
            case 409:
                buyingHistoryState = .reauthRequired
            default:
                let message = GogglerAPIClient.errorMessage(from: raw.data) ?? "History is unavailable"
                buyingHistoryState = .unavailable(message: message)
            }
        } catch {
            AppLog.network.error("buying-history: failed — \(Self.describe(error), privacy: .public)")
            buyingHistoryState = .unavailable(message: error.localizedDescription)
        }
    }

    /// Surfaces the underlying NSError domain/code (e.g. NSURLErrorDomain
    /// -1004 "could not connect") rather than just `localizedDescription`,
    /// since "could not reach the server" alone doesn't say whether it was
    /// DNS, TLS, a timeout, or connection-refused. `GogglerAPIError` wraps
    /// the real `URLError` in `.requestFailed`/`.decodingFailed` — bridging
    /// the wrapper itself to NSError just gives a useless synthesized
    /// domain/code, so unwrap it first.
    private static func describe(_ error: Error) -> String {
        let underlying: Error
        switch error {
        case GogglerAPIError.requestFailed(let wrapped), GogglerAPIError.decodingFailed(let wrapped):
            underlying = wrapped
        default:
            underlying = error
        }

        let nsError = underlying as NSError
        return "\(nsError.domain) \(nsError.code): \(nsError.localizedDescription)"
    }
}
