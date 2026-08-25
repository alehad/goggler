import Foundation
import Observation

/// Holds the one thing this app needs configured: which backend to talk to.
/// Defaults to the Tailscale hostname already used for remote access
/// throughout this project; switchable to a local `next dev` server for
/// iterating without the tunnel up. Persisted so it survives relaunches.
@Observable
final class AppSettings {
    static let tailscaleBaseURLString = "https://goggler.tailde35d2.ts.net"
    static let localBaseURLString = "http://localhost:3000"

    private static let storageKey = "goggler.baseURLString"

    var baseURLString: String {
        didSet {
            UserDefaults.standard.set(baseURLString, forKey: Self.storageKey)
        }
    }

    init() {
        self.baseURLString = UserDefaults.standard.string(forKey: Self.storageKey) ?? Self.tailscaleBaseURLString
    }

    var baseURL: URL? {
        URL(string: baseURLString)
    }

    /// nil when `baseURLString` isn't a valid URL — surfaced in SettingsView
    /// rather than silently falling back to a default, so a typo is visible.
    var apiClient: GogglerAPIClient? {
        guard let baseURL else { return nil }
        return GogglerAPIClient(baseURL: baseURL)
    }
}
