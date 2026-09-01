import Foundation

/// Mirrors `EbayConfigStatus` in app/page.tsx — the response shape of
/// `GET /api/auth/ebay/config-status`.
struct EbayConfigStatus: Decodable, Sendable {
    struct Config: Decodable, Sendable {
        let ready: Bool
        let environment: String
        let missing: [String]
        let invalid: [String]
        let marketplaceId: String
        let tradingSiteId: String
        let scopeCount: Int
    }

    let config: Config
}

/// Mirrors `EbaySession` in app/page.tsx — the response shape of
/// `GET /api/auth/ebay/session`.
struct EbaySession: Decodable, Sendable {
    struct Identity: Decodable, Sendable {
        let userId: String
        let displayName: String?
    }

    struct Connection: Decodable, Sendable {
        let connected: Bool
        let status: String
        let authorizedAt: String?
        let expiresAt: String?
        let scopes: [String]
        let identity: Identity?
    }

    let connection: Connection
}

/// The `{ "error": "..." }` shape every goggler API route returns on failure.
struct GogglerAPIErrorBody: Decodable, Sendable {
    let error: String
}

struct Money: Decodable, Sendable {
    let value: Double
    let currency: String
}

/// Mirrors `HistoryItem` in app/page.tsx. `captured` mirrors the TS
/// `EndedWatchlistItem = HistoryItem & { captured: boolean }` intersection —
/// present only in `endedWatchlistItems`' JSON, decoding as `nil` on
/// `lostItems`/`wonItems`, rather than a parallel Swift struct. Properties
/// are `var` (harmless for `Decodable`) so `BuyingHistoryStore.markCaptured`
/// can produce updated copies in place.
struct HistoryItem: Decodable, Sendable, Identifiable {
    var id: String { itemId }

    var itemId: String
    var title: String
    var list: String
    var currentPrice: Money?
    var maxBid: Money?
    var endTime: String?
    var sellerUserId: String?
    var conditionDisplayName: String?
    var imageUrl: String?
    var itemWebUrl: String?
    var relistingGroupId: String?
    var captured: Bool?
}

/// Mirrors `BuyingHistory` in app/page.tsx — the response body of
/// `POST /api/ebay/buying-history`. `homeFeed` and `warnings` are
/// intentionally not modeled here: `Decodable` only decodes properties a
/// struct declares, so this is a partial-interest decode, not a lossy one.
struct BuyingHistory: Decodable, Sendable {
    struct Counts: Decodable, Sendable {
        let lost: Int
        let won: Int
        let eventuallyWon: Int
        let neverWon: Int
        let watchlist: Int
        let watchlistRelistings: Int
        let needsAction: Int
        let relistings: Int
    }

    let source: String
    let counts: Counts
    let lostItems: [HistoryItem]
    let wonItems: [HistoryItem]
    var endedWatchlistItems: [HistoryItem]
}

/// Response of `POST /api/market-insights/capture`.
struct CaptureResult: Decodable, Sendable {
    let captured: [String]
    let skipped: [String]
}

/// Response of `DELETE /api/market-insights/history`.
struct DeleteResult: Decodable, Sendable {
    let deletedCount: Int
}
