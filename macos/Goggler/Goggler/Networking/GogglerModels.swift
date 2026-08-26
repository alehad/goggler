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

/// Mirrors `HistoryItem` in app/page.tsx.
struct HistoryItem: Decodable, Sendable, Identifiable {
    var id: String { itemId }

    let itemId: String
    let title: String
    let list: String
    let currentPrice: Money?
    let maxBid: Money?
    let endTime: String?
    let sellerUserId: String?
    let conditionDisplayName: String?
    let imageUrl: String?
    let itemWebUrl: String?
    let relistingGroupId: String?
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
}
