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
