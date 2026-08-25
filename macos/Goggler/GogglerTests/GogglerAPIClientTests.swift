import Testing
import Foundation
@testable import Goggler

/// Intercepts requests at the URLProtocol level so these tests exercise the
/// real GogglerAPIClient/URLSession request-building code without needing a
/// running backend — the equivalent of this repo's TypeScript unit tests
/// (pure logic, no network/DB).
final class MockURLProtocol: URLProtocol {
    /// Each @Test sets this immediately before triggering the request it
    /// covers, and Swift Testing runs these tests serially, so there is no
    /// real concurrent mutation — the compiler just can't prove that.
    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) -> (Data, Int))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let (data, statusCode) = handler(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: statusCode, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

/// The mock handler closure runs synchronously inside `startLoading()` before
/// the `await` that called it resumes, so there's no real concurrent access —
/// but capturing a plain `var` in a `@Sendable` closure doesn't let the
/// compiler see that, hence this box.
final class UncheckedBox<T>: @unchecked Sendable {
    var value: T
    init(_ value: T) { self.value = value }
}

@Suite("GogglerAPIClient")
struct GogglerAPIClientTests {
    @Test("Sets an Origin header matching the base URL, satisfying the backend's CSRF check")
    func setsOriginHeader() async throws {
        let capturedRequest = UncheckedBox<URLRequest?>(nil)
        MockURLProtocol.handler = { request in
            capturedRequest.value = request
            return (Data("{}".utf8), 200)
        }

        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])
        _ = try await client.request("/api/auth/ebay/config-status")

        #expect(capturedRequest.value?.value(forHTTPHeaderField: "Origin") == "https://goggler.tailde35d2.ts.net")
    }

    @Test("Decodes a successful response body")
    func decodesSuccessResponse() async throws {
        MockURLProtocol.handler = { _ in
            (Data(#"{"config":{"ready":true,"environment":"production","missing":[],"invalid":[],"marketplaceId":"EBAY_GB","tradingSiteId":"3","scopeCount":1}}"#.utf8), 200)
        }

        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])
        let (status, code) = try await client.requestDecoded("/api/auth/ebay/config-status", as: EbayConfigStatus.self)

        #expect(code == 200)
        #expect(status.config.ready == true)
        #expect(status.config.environment == "production")
    }

    @Test("Surfaces the real status code for a non-2xx response, matching how app/page.tsx branches on response.status")
    func surfacesStatusCodeOnError() async throws {
        MockURLProtocol.handler = { _ in
            (Data(#"{"error":"ebay_reauth_required"}"#.utf8), 409)
        }

        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])
        let raw = try await client.request("/api/ebay/buying-history", method: "POST", jsonBody: ["exactTitleMatch": true])

        #expect(raw.statusCode == 409)
        #expect(GogglerAPIClient.errorMessage(from: raw.data) == "ebay_reauth_required")
    }

    @Test("Sends the request body as JSON with a Content-Type header")
    func sendsJSONBody() async throws {
        let capturedBody = UncheckedBox<Data?>(nil)
        let capturedContentType = UncheckedBox<String?>(nil)
        MockURLProtocol.handler = { request in
            capturedBody.value = Self.readBody(from: request)
            capturedContentType.value = request.value(forHTTPHeaderField: "Content-Type")
            return (Data("{}".utf8), 200)
        }

        let client = GogglerAPIClient(baseURL: URL(string: "https://goggler.tailde35d2.ts.net")!, protocolClasses: [MockURLProtocol.self])
        _ = try await client.request("/api/ebay/search", method: "POST", jsonBody: ["query": "test record"])

        #expect(capturedContentType.value == "application/json")
        let body = try #require(capturedBody.value)
        let decoded = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        #expect(decoded?["query"] as? String == "test record")
    }

    /// URLSession may deliver the body via `httpBody` or, for some request
    /// shapes, `httpBodyStream` — read whichever is present.
    private static func readBody(from request: URLRequest) -> Data? {
        if let body = request.httpBody {
            return body
        }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 1024
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read > 0 { data.append(buffer, count: read) }
        }
        return data
    }
}
