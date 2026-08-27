import Testing
import Foundation
@testable import Goggler

/// Exercises EbayAuthService's URL-construction and callback-parsing logic
/// against fixed inputs — the real connect() flow launches actual system UI
/// (ASWebAuthenticationSession) and can't be meaningfully unit-tested.
@Suite("EbayAuthService")
@MainActor
struct EbayAuthServiceTests {
    private let baseURL = URL(string: "https://goggler.tailde35d2.ts.net")!

    @Test("startURL points at /api/auth/ebay/start with the native marker")
    func startURLIncludesNativeMarker() throws {
        let url = try #require(EbayAuthService.startURL(baseURL: baseURL))
        let components = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false))

        #expect(components.scheme == "https")
        #expect(components.host == "goggler.tailde35d2.ts.net")
        #expect(components.path == "/api/auth/ebay/start")
        #expect(components.queryItems?.first(where: { $0.name == "nativeRedirect" })?.value == "1")
    }

    /// A fresh, isolated cookie jar per test — `.shared` is genuinely shared
    /// with the real Goggler.app's sandbox container (the test bundle runs
    /// hosted inside it), so a cookie from earlier live app usage this
    /// session was observed leaking into a test that used `.shared`
    /// directly. Each call gets a unique identifier so tests can't see one
    /// another's cookies either.
    private func freshCookieStorage() -> HTTPCookieStorage {
        HTTPCookieStorage.sharedCookieStorage(forGroupContainerIdentifier: "EbayAuthServiceTests-\(UUID())")
    }

    @Test("handleCallback adopts the session token on success")
    func handleCallbackAdoptsTokenOnSuccess() {
        let callbackURL = URL(string: "goggler://oauth-complete?account=ebay_connected&sessionToken=fresh-token-value")!
        let cookieStorage = freshCookieStorage()

        let result = EbayAuthService.handleCallback(callbackURL, baseURL: baseURL, cookieStorage: cookieStorage)

        #expect(result == .connected)
        let cookies = cookieStorage.cookies(for: baseURL) ?? []
        let sessionCookie = cookies.first(where: { $0.name == "goggler_session" })
        #expect(sessionCookie?.value == "fresh-token-value")
    }

    @Test("handleCallback surfaces the error reason without adopting a cookie")
    func handleCallbackSurfacesErrorReason() {
        let callbackURL = URL(string: "goggler://oauth-complete?account=ebay_invalid_oauth_state")!
        let cookieStorage = freshCookieStorage()

        let result = EbayAuthService.handleCallback(callbackURL, baseURL: baseURL, cookieStorage: cookieStorage)

        #expect(result == .failed("ebay_invalid_oauth_state"))
        #expect((cookieStorage.cookies(for: baseURL) ?? []).isEmpty)
    }

    @Test("handleCallback replaces a pre-existing session cookie rather than leaving both in place")
    func handleCallbackReplacesPreExistingCookie() {
        // Reproduces a real bug found live: the app already holds an older
        // goggler_session cookie (set automatically by URLSession from a
        // real Set-Cookie response header, before this OAuth flow even
        // started — exactly how Home's own startup check leaves one
        // behind). Parsing it via the same header-based API URLSession
        // itself uses, rather than constructing it by hand, reproduces the
        // actual shape that didn't get replaced.
        let cookieStorage = freshCookieStorage()
        let staleCookies = HTTPCookie.cookies(
            withResponseHeaderFields: ["Set-Cookie": "goggler_session=stale-token-value; Path=/; HttpOnly; Secure"],
            for: baseURL
        )
        for cookie in staleCookies {
            cookieStorage.setCookie(cookie)
        }
        #expect((cookieStorage.cookies(for: baseURL) ?? []).filter { $0.name == "goggler_session" }.count == 1)

        let callbackURL = URL(string: "goggler://oauth-complete?account=ebay_connected&sessionToken=fresh-token-value")!
        let result = EbayAuthService.handleCallback(callbackURL, baseURL: baseURL, cookieStorage: cookieStorage)

        #expect(result == .connected)
        let sessionCookies = (cookieStorage.cookies(for: baseURL) ?? []).filter { $0.name == "goggler_session" }
        #expect(sessionCookies.count == 1)
        #expect(sessionCookies.first?.value == "fresh-token-value")
    }

    @Test("handleCallback fails clearly when a success callback is missing its token")
    func handleCallbackFailsWithoutToken() {
        let callbackURL = URL(string: "goggler://oauth-complete?account=ebay_connected")!

        let result = EbayAuthService.handleCallback(callbackURL, baseURL: baseURL, cookieStorage: freshCookieStorage())

        #expect(result == .failed("missing_session_token"))
    }
}
