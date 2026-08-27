import AuthenticationServices
import AppKit

/// Drives the eBay OAuth flow via `ASWebAuthenticationSession`, the
/// Apple-sanctioned API for this — but its browser context is isolated and
/// does not share cookies with the app's own URLSession, so the eBay
/// authorization lands on a session the app never otherwise sees. The
/// backend hands a fresh session token back through the `goggler://
/// oauth-complete` redirect on success; this service adopts it into
/// HTTPCookieStorage.shared so GogglerAPIClient picks it up on the next
/// request. See openspec/changes/macos-ebay-oauth/design.md for the full
/// reasoning, including the two approaches that don't work
/// (additionalHeaderFields forbids Cookie; passing the existing session
/// token in the /start URL would put a credential in a query string).
@MainActor
final class EbayAuthService: NSObject {
    enum ConnectResult: Equatable {
        case connected
        case cancelled
        case failed(String)
    }

    /// Held as a stored property, not a local variable in `connect(...)` —
    /// ASWebAuthenticationSession is silently torn down if its only strong
    /// reference is deallocated mid-flow.
    private var session: ASWebAuthenticationSession?

    func connect(appSettings: AppSettings) async -> ConnectResult {
        guard let baseURL = appSettings.baseURL else {
            return .failed("Invalid backend URL — check Settings.")
        }

        guard let startURL = Self.startURL(baseURL: baseURL) else {
            return .failed("Could not build the eBay sign-in URL.")
        }
        AppLog.startup.debug("EbayAuthService: starting session with \(startURL.absoluteString, privacy: .public)")

        return await withCheckedContinuation { continuation in
            // ASWebAuthenticationSession's completion handler is not
            // guaranteed to run on the main thread. A closure literal
            // written here, lexically inside a @MainActor method, gets
            // implicitly (and incorrectly, for a plain non-isolated
            // completion-handler parameter type) inferred as MainActor-
            // isolated by the Swift 6 compiler — the runtime then inserts an
            // isolation check that trapped (EXC_BREAKPOINT on the Safari XPC
            // thread) the instant the system called it off-thread, before
            // ever reaching the body. Explicit `@Sendable` stops that
            // erroneous inference; the `Task { @MainActor in }` inside is
            // then the actual, correct hop back onto the main actor.
            let session = ASWebAuthenticationSession(url: startURL, callbackURLScheme: "goggler") { @Sendable [weak self] callbackURL, error in
                Task { @MainActor in
                    self?.session = nil
                    // Never log the raw callback URL — on success it carries
                    // a live session token in its query string (caught by
                    // security review: the full URL was logged with
                    // `privacy: .public`, making the token readable via
                    // Console.app/`log show` by anything with local log
                    // access). Only the account status is safe to log.
                    let accountForLogging = callbackURL.flatMap {
                        URLComponents(url: $0, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "account" })?.value
                    }
                    AppLog.startup.debug(
                        "EbayAuthService: completion fired — error=\(String(describing: error), privacy: .public), account=\(accountForLogging ?? "nil", privacy: .public)"
                    )

                    if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                        continuation.resume(returning: .cancelled)
                        return
                    }
                    if let error {
                        continuation.resume(returning: .failed(error.localizedDescription))
                        return
                    }
                    guard let callbackURL else {
                        continuation.resume(returning: .failed("No response from eBay sign-in."))
                        return
                    }

                    let result = Self.handleCallback(callbackURL, baseURL: baseURL, cookieStorage: .shared)
                    AppLog.startup.debug("EbayAuthService: handleCallback result=\(String(describing: result), privacy: .public)")
                    continuation.resume(returning: result)
                }
            }
            session.presentationContextProvider = self
            self.session = session
            session.start()
        }
    }

    // internal, not private: exercised directly by EbayAuthServiceTests
    // against fixed inputs, since the real connect() flow launches actual
    // system UI and can't be meaningfully unit-tested.
    static func startURL(baseURL: URL) -> URL? {
        guard var components = URLComponents(url: baseURL.appendingPathComponent("api/auth/ebay/start"), resolvingAgainstBaseURL: false) else {
            return nil
        }
        components.queryItems = [URLQueryItem(name: "nativeRedirect", value: "1")]
        return components.url
    }

    static func handleCallback(_ url: URL, baseURL: URL, cookieStorage: HTTPCookieStorage) -> ConnectResult {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return .failed("Could not read the response from eBay sign-in.")
        }

        let account = components.queryItems?.first(where: { $0.name == "account" })?.value
        guard account == "ebay_connected" else {
            return .failed(account ?? "unknown_error")
        }

        guard let token = components.queryItems?.first(where: { $0.name == "sessionToken" })?.value else {
            return .failed("missing_session_token")
        }

        adoptSessionCookie(token: token, baseURL: baseURL, cookieStorage: cookieStorage)
        return .connected
    }

    /// The cookie is HttpOnly, but that only restricts in-browser JavaScript
    /// (`document.cookie`) — native cookie-storage APIs are unaffected, so
    /// this works the same as the cookie the web app's browser already
    /// carries for the same session. `cookieStorage` is injected (defaults
    /// to `.shared` at the one production call site) so tests can use an
    /// isolated instance — `.shared` is genuinely shared with the real app's
    /// sandbox container, since the test bundle runs hosted inside it.
    private static func adoptSessionCookie(token: String, baseURL: URL, cookieStorage: HTTPCookieStorage) {
        guard let host = baseURL.host else { return }

        // The app may already hold an older goggler_session cookie for this
        // host (from before this OAuth flow — e.g. the anonymous session
        // Home's own startup check created). Confirmed live: leaving it in
        // place caused the wrong cookie to be sent afterward, so the app
        // kept reporting eBay as not connected even though the backend
        // session actually was (verified directly via curl with the
        // reissued token). Explicitly removing any existing one first
        // avoids relying on HTTPCookieStorage's implicit replacement
        // semantics, which don't reliably match a manually-constructed
        // cookie against one the server originally set via Set-Cookie.
        for existing in cookieStorage.cookies(for: baseURL) ?? [] where existing.name == "goggler_session" {
            cookieStorage.deleteCookie(existing)
        }

        let properties: [HTTPCookiePropertyKey: Any] = [
            .name: "goggler_session",
            .value: token,
            .domain: host,
            .path: "/",
            .secure: "TRUE"
        ]
        if let cookie = HTTPCookie(properties: properties) {
            cookieStorage.setCookie(cookie)
            AppLog.startup.debug("EbayAuthService: adopted session cookie for host=\(host, privacy: .public)")
        } else {
            AppLog.startup.error("EbayAuthService: failed to construct HTTPCookie for host=\(host, privacy: .public)")
        }
    }
}

extension EbayAuthService: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApp.keyWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
    }
}
