import Foundation

enum GogglerAPIError: Error, LocalizedError {
    case invalidResponse
    case decodingFailed(underlying: Error)
    case requestFailed(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an unexpected response."
        case .decodingFailed:
            return "Could not understand the server's response."
        case .requestFailed:
            return "Could not reach the server. Check your connection and try again."
        }
    }
}

/// A plain response: the raw body plus the HTTP status, so callers can
/// branch on status the same way app/page.tsx does (e.g. treating 409 as
/// "eBay reauth required" rather than a generic failure) before deciding
/// whether/how to decode the body.
struct GogglerRawResponse: Sendable {
    let data: Data
    let statusCode: Int
}

/// The only place that knows how to reach the goggler backend. Every tab
/// view calls through this rather than using `URLSession` directly, so the
/// base URL, cookie handling, and CSRF header are configured in exactly one
/// place — mirroring how every fetch() call in app/page.tsx goes through
/// the same relative-path + credentials-included pattern.
///
/// No custom session/auth-token handling is needed here: `URLSessionConfiguration`'s
/// shared cookie storage persists and replays the goggler session cookie
/// exactly like a browser does, since the backend's session mechanism is a
/// plain bearer token carried in a cookie (see src/auth/session-store.ts).
struct GogglerAPIClient: Sendable {
    let baseURL: URL
    private let session: URLSession

    /// `protocolClasses` is nil in production (real network via
    /// URLSessionConfiguration.default) and set to `[MockURLProtocol.self]`
    /// in tests, so GogglerAPIClientTests exercises the real request-building
    /// code without a running backend.
    init(baseURL: URL, protocolClasses: [AnyClass]? = nil) {
        self.baseURL = baseURL
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpShouldSetCookies = true
        if let protocolClasses {
            configuration.protocolClasses = protocolClasses
        }
        self.session = URLSession(configuration: configuration)
    }

    /// Performs a request and returns the raw response without decoding —
    /// the caller inspects `statusCode` first, matching the pattern every
    /// fetch call in app/page.tsx already uses (check response.ok/status
    /// before deciding how to parse the body).
    func request(_ path: String, method: String = "GET", jsonBody: [String: Sendable]? = nil) async throws -> GogglerRawResponse {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        urlRequest.httpMethod = method
        // The backend's CSRF check (validateSameOriginRequest) requires an Origin
        // or Referer header matching a trusted origin. Browsers set this
        // automatically and don't let scripts override it; a native URLRequest
        // has no such restriction, so we set it explicitly here.
        urlRequest.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")

        if let jsonBody {
            urlRequest.httpBody = try JSONSerialization.data(withJSONObject: jsonBody)
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw GogglerAPIError.requestFailed(underlying: error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw GogglerAPIError.invalidResponse
        }

        return GogglerRawResponse(data: data, statusCode: httpResponse.statusCode)
    }

    /// Convenience for the common case: decode the body as `T` regardless of
    /// status code, letting JSONDecoder fail naturally if the shape doesn't
    /// match (e.g. an error body on a non-2xx response).
    func requestDecoded<T: Decodable>(_ path: String, as type: T.Type, method: String = "GET", jsonBody: [String: Sendable]? = nil) async throws -> (value: T, statusCode: Int) {
        let raw = try await request(path, method: method, jsonBody: jsonBody)
        do {
            let decoded = try JSONDecoder().decode(T.self, from: raw.data)
            return (decoded, raw.statusCode)
        } catch {
            throw GogglerAPIError.decodingFailed(underlying: error)
        }
    }

    /// Decodes the `{ "error": "..." }` body every goggler route returns on
    /// failure. Returns nil rather than throwing if the body doesn't match
    /// that shape, since callers use this opportunistically after already
    /// checking status code.
    static func errorMessage(from data: Data) -> String? {
        try? JSONDecoder().decode(GogglerAPIErrorBody.self, from: data).error
    }
}
