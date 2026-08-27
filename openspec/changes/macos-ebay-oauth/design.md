# Design: eBay OAuth for the macOS app

## The problem `ASWebAuthenticationSession` creates, and why the obvious fixes don't work

`ASWebAuthenticationSession` presents a real, isolated browser context for the OAuth flow — that isolation is the whole point (Apple's stated design: no other app's URL-scheme handler can intercept the callback). But "isolated" also means it does **not** share cookies with the app's own `URLSession`/`HTTPCookieStorage.shared`. Concretely: when `ASWebAuthenticationSession` navigates to `GET /api/auth/ebay/start`, it does not carry the `goggler_session` cookie the app's `GogglerAPIClient` already established. The backend's `getOrCreateCurrentUser` (`src/auth/current-user.ts`) does exactly what its name says — no cookie means it mints a **brand-new session**. Since `sessionStore.setEbayAuthorization` (`src/auth/session-store.ts:181`) is keyed by session ID, not user ID, the eBay authorization would land on that orphaned, freshly-created session — one `GogglerAPIClient` never uses again after the auth sheet closes. The app would keep polling its own (different) session and see `connected: false` forever.

Two fixes were considered and ruled out before landing on the real one:

- **Set the `Cookie` header explicitly via `ASWebAuthenticationSession.additionalHeaderFields`.** Checked directly: `Cookie` is on the Fetch spec's forbidden-request-header list, which `additionalHeaderFields` explicitly respects — this is blocked at the API level, not just discouraged.
- **Put the app's existing session token in the `/start` URL as a query parameter**, so the backend adopts it directly. Rejected: that's a real, live session credential sitting in a URL, which is exactly what "never place personal or sensitive data in URL parameters" (a standing rule) exists to prevent — a query string can end up in server logs, proxy logs, etc. even though this one's same-origin.

## The actual fix: let the OAuth flow use its own fresh session, then hand it back

Since `ASWebAuthenticationSession`'s browser context *is* a normal, continuous browsing session for the duration of one flow (isolation just means "don't persist to disk / don't share with Safari," not "don't retain cookies within this one flow") — the cookie `/start` sets **does** get carried correctly through eBay's redirect and back to `/callback`, within that one isolated session. So `getCurrentUser` at `/callback` resolves the right (fresh) session exactly as it already does for the web flow — no change needed there. The only gap is getting that fresh session's identity back to the native app afterward, since the app's own cookie jar never saw it.

`sessionStore.createSession` only ever returns the raw token **once**, at creation (`src/auth/session-store.ts:80` — only `tokenHash` is persisted). The server can't "look up" that raw value again later. So `/callback` mints a **new** raw token for the *same* session (rotating its hash) and hands that back to the app via the custom-scheme redirect — the app then adopts it as its own session cookie going forward.

```ts
// src/auth/session-store.ts — new method
reissueToken(sessionId: string, options: { now?: Date } = {}): string | undefined {
  const session = this.sessions.get(sessionId);
  if (!session || session.expiresAt <= (options.now ?? new Date())) return undefined;
  const token = randomBytes(32).toString("base64url");
  session.tokenHash = hashSessionToken(token);
  return token;
}
```

## Threading "this is a native flow" through the OAuth state

`EbayOAuthStatePayload` (`src/ebay/oauth-state.ts`) gains an optional field:

```ts
export type EbayOAuthStatePayload = {
  id: string;
  userId: string;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  redirectTarget?: "native"; // absent/undefined = today's web behavior, unchanged
};
```

`GET /api/auth/ebay/start?nativeRedirect=1` (query marker) passes `redirectTarget: "native"` into `createWithPayload`. Since this only affects *where the browser making the request ends up redirected after completing its own OAuth flow* — not any cross-session/cross-user capability, and `goggler://` isn't a scheme most machines have registered anyway — there's no meaningful abuse surface in this being an unauthenticated, client-supplied flag.

`redirectToAccount` in `app/api/auth/ebay/callback/route.ts` becomes redirect-target-aware:

- **Success**: after `setEbayAuthorization`, if native-flagged, call `reissueToken(sessionContext.session.id)` and redirect to `goggler://oauth-complete?account=ebay_connected&sessionToken=<token>`.
- **Error, with a resolvable state** (`invalid_oauth_state`, `local_auth_required`, `replayed`, `ebay_token_exchange_failed`, or eBay's own `?error=`): redirect to `goggler://oauth-complete?account=ebay_<reason>` — no token, since nothing was authorized. Determining native-vs-web here uses a **best-effort, unsigned peek** at the `state` parameter's `redirectTarget` (decode without verifying the signature) — safe because this only ever decides which URL scheme to bounce the browser to, never a trust or authorization decision; the actual code exchange remains fully gated by full signature validation elsewhere in the same route, unchanged.
- **`missing_authorization_code`** (no `code` in the query at all): if `state` is also absent or undecodable, there's no way to know it was native — falls back to the existing plain JSON error response. This is a defensive/malformed-request path, not part of the golden path either flow exercises normally.
- **Web flow**: completely unchanged — `redirectTarget` is absent, so every branch behaves exactly as it does today.

## macOS side

- **`GogglerApp` gains `CFBundleURLTypes`** for the `goggler` scheme (via `project.yml`'s `info.properties`, the same mechanism already producing `Generated-Info.plist`).
- **`EbayAuthService`** (new file): wraps `ASWebAuthenticationSession(url: startURL, callbackURLScheme: "goggler")`, implements `ASWebAuthenticationPresentationContextProviding` (`presentationAnchor(for:)` returning the app's main `NSWindow`), and — critically, a known pitfall — is held as a **stored property**, not a local variable, since the session object being deallocated mid-flow silently kills it.
- `startURL` is `<baseURL>/api/auth/ebay/start?nativeRedirect=1`.
- On completion, parses `goggler://oauth-complete?account=...&sessionToken=...`: if `sessionToken` is present, constructs an `HTTPCookie` (name `goggler_session`, matching `src/auth/session-cookie.ts`'s format — `HttpOnly` doesn't block *native* cookie-storage APIs, only in-browser JS, so this is fully accessible) and inserts it into `HTTPCookieStorage.shared` for the backend's host, then calls `store.refresh(using:)` so the UI reflects the new connection immediately.
- Surfaced from the Home tab (where connection status already renders) as a "Connect eBay" button, shown only when `store.connection?.connected == false`.

## Testing

- `reissueToken`: new unit tests in the existing session-store test file — mints a working token for an existing session, rejects an unknown/expired one, and confirms the *old* token stops working after reissue (hash was actually rotated, not just added).
- `redirectTarget`/native-callback routing: new integration-style tests on the callback route mirroring its existing test coverage, parameterized for native vs. web, success vs. each error branch.
- macOS: manual end-to-end only for the actual `ASWebAuthenticationSession` flow (system UI, can't be meaningfully unit-tested) — everything upstream of it (`EbayAuthService`'s URL construction, the cookie-adoption logic) gets unit tests against a fixed callback URL, same pattern as `GogglerAPIClientTests`.

## Three real bugs found live, not guessed at

The design above was correct in shape; three real, non-obvious bugs only surfaced once the flow actually ran end-to-end against Production eBay:

1. **A Swift 6 compiler defect trapped the app the first time the flow completed.** `ASWebAuthenticationSession`'s completion handler is not guaranteed to run on the main thread, but a closure literal written lexically inside a `@MainActor` method gets implicitly (and, per multiple `swiftlang/swift` GitHub issues, erroneously) inferred as MainActor-isolated by the compiler even when the target parameter type is a plain, non-isolated completion handler. The runtime then inserts an isolation check that trapped (`EXC_BREAKPOINT`, `dispatch_assert_queue_fail`, on the `com.apple.NSXPCConnection.m-user.com.apple.SafariLaunchAgent` thread) the instant the system called it off-thread — confirmed via the actual crash report, not assumed. Fixed by marking the closure explicitly `@Sendable` (stops the erroneous inference) with an inner `Task { @MainActor in }` doing the real, correct hop.
2. **The registered eBay redirect URI points at the Funnel port, not the persistent tailnet-only port.** `EBAY_PRODUCTION_REDIRECT_URI` is registered against `:8443` (the [[tailscale-callback-port-isolation]] Funnel port), which is deliberately *not* part of the always-on [[persistent-backend-launchagent]] setup — only the tailnet-only `:443` `serve` mapping runs persistently. Manual testing needed the Funnel stood up by hand first (`tailscale funnel --https=8443 ...`), same as any other Production eBay test session, torn down again immediately after.
3. **A stale pre-existing cookie silently won over the new one.** `HTTPCookieStorage.shared` already held an older `goggler_session` cookie — set automatically by `URLSession` from Home's own startup check, before the OAuth flow ever ran — and the newly-adopted cookie didn't reliably replace it. The app kept sending the old, unauthorized session and reporting "not connected," even though the backend session the OAuth flow actually used *was* connected (confirmed directly: `curl` with the reissued token returned `connected: true`, isolating the bug to the client side). Fixed by explicitly deleting any existing `goggler_session` cookie for the host before inserting the new one, rather than relying on `HTTPCookieStorage`'s implicit replacement semantics. A regression test reproduces the exact shape (a cookie parsed from a real `Set-Cookie` response header via `HTTPCookie.cookies(withResponseHeaderFields:for:)`, matching how `URLSession` itself would have stored it — not a hand-constructed approximation) and was confirmed to fail without the fix before it was accepted.
