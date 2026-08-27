# Proposal: eBay OAuth for the macOS app

## Why

Every macOS tab (Home, Watchlist, Purchases) has been correctly showing "not connected" / `reauth_required` since there's no way to actually connect eBay from the native app yet — this was explicitly deferred in [[macos-app-shell]]'s proposal pending the shell being proven out first. It now is; this is that deferred piece.

This is the first macOS change that touches `src/`/`app/api/*` rather than being purely additive under `macos/` — a real, if small, backend addition is unavoidable, for a reason discovered during design rather than assumed: `ASWebAuthenticationSession` (the standard, Apple-sanctioned API for this) runs the OAuth flow in an isolated browser context that does **not** share cookies with the app's own `URLSession` — so without a backend change, the eBay authorization eBay hands back would get attached to a session the native app never sees again, silently breaking the whole flow. See design.md for exactly how this was confirmed and the fix.

## What Changes

- **`GET /api/auth/ebay/start`** accepts an optional query marker indicating the flow was started by a native client; when present, the signed OAuth state it creates records that.
- **`GET /api/auth/ebay/callback`**, on completion, redirects to a custom URL scheme (`goggler://oauth-complete`) instead of the web root when the originating state was native-flagged — carrying the outcome (`connected`/error) and, on success, a freshly-issued session token so the native app can adopt the session the eBay authorization actually landed on.
- **`InMemorySessionStore` gains `reissueToken`**: mints a fresh raw token for an existing session, rotating its stored hash. Needed because the store only ever persists a token's hash — the raw value handed back at session creation is never recoverable later, so completing this handoff requires minting a new one.
- **macOS**: a small `EbayAuthService` wrapping `ASWebAuthenticationSession`, a presentation-context provider, `CFBundleURLTypes` registration for the `goggler` scheme, a "Connect eBay" action (Home tab, where connection status is already shown), and adopting the returned session token into `HTTPCookieStorage.shared` so `GogglerAPIClient` picks it up on the next request.

## Out of Scope

- Any change to how the **web** OAuth flow behaves — untouched; the native marker is opt-in and defaults away.
- iOS — same `ASWebAuthenticationSession` approach will apply later, not built now.
- Disconnecting eBay from the macOS app (the existing `disconnect` route already exists server-side; wiring a macOS button for it is a small separate follow-up, not bundled here to keep this change reviewable).

## Success Criteria

- Tapping "Connect eBay" in the macOS app opens the real eBay consent screen via `ASWebAuthenticationSession`, completes a real Production login, and the app's own `GogglerAPIClient` requests are authenticated as the session that now holds the eBay authorization — verified by `GET /api/auth/ebay/session` (via the app) reporting `connected: true` immediately after.
- The existing web OAuth flow is unaffected — verified by re-running it manually after this ships.
- No raw session token is ever logged, and the custom-scheme handoff is documented and reviewed explicitly as the one deliberate exception to "no sensitive data in URLs," since it's an in-process, same-device redirect `ASWebAuthenticationSession` delivers directly to the app, never transmitted over a network or visible to any third party — not a general practice.
