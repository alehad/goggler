# Proposal: Native macOS app — navigation shell and real API connection

## Why

goggler's backend (`src/`) and its 17 API routes are already a clean, client-agnostic JSON API — confirmed by audit before drafting this proposal: `src/` (~15,200 lines) holds all real logic with no framework coupling, `app/api/*/route.ts` are thin HTTP adapters, and `app/page.tsx`'s only "client-side logic" is view-only filtering over data the server already fully assembled. A native macOS client needs to reimplement presentation (trivial, platform-native by design) but not port any business logic.

This is the first of several planned phases toward a full native macOS app, laid out with a Claude-Code-like two-pane shape: a sidebar (Home / Watchlist / Purchases / Analytics, with Settings/My pinned at the bottom) and a detail pane showing native-control equivalents of each web tab. This phase deliberately stays small: get a real SwiftUI app talking to the real backend and rendering a real (if mostly empty) response, before building out every tab's full feature set.

## What Changes

- New Xcode project at `macos/Goggler/`, SwiftUI, targeting the two most recent macOS versions (deployment target macOS 15.0 — current SwiftUI APIs like `NavigationSplitView` have been available since macOS 13, so this is a conservative floor, not a technical constraint).
- A `NavigationSplitView` sidebar shell: Home / Watchlist / Purchases / Analytics as the primary navigation list, Settings (mirroring the web app's "My" tab) pinned at the bottom of the sidebar, detail pane switching per selection.
- A small `GogglerAPIClient` networking layer (`URLSession`-based) that:
  - Talks to a configurable backend base URL (defaults to the same Tailscale hostname already used for remote access, per [[docker-tailnet-deployment]] and [[tunnel-target-selection]]).
  - Relies on `URLSession`'s default cookie storage for goggler's own session — no backend change needed; this is the same bearer-token-in-a-cookie mechanism the web app already uses, and `URLSession` replays cookies exactly like a browser does.
  - Sets an explicit `Origin` header matching the trusted hostname on every request, satisfying the existing CSRF check (`validateSameOriginRequest`) — again no backend change, since (unlike browser `fetch`) a native `URLRequest` is allowed to set this header itself.
- The Home tab makes one real call — `POST /api/ebay/buying-history` — and renders whatever comes back. Without eBay OAuth built yet (a later phase), this will be a real `409 ebay_reauth_required` response, same as a fresh, unauthenticated web session shows. That's the actual milestone: proving the full pipeline (native UI → real network call → real backend → real response → native UI update), not faking a happy path.
- Also calls the existing `GET /api/auth/ebay/config-status` and `GET /api/auth/ebay/session` on launch (mirroring the web app's own mount-time calls) so the sidebar can show real connection status ("Not connected") rather than a placeholder.

## Out of Scope (future phases)

- **eBay OAuth** — needs `ASWebAuthenticationSession` pointed at the existing `/api/auth/ebay/start` → eBay → `/api/auth/ebay/callback` flow, plus one small, well-scoped backend addition: the callback's final redirect needs to go to a custom URL scheme (e.g. `goggler://oauth-complete`) instead of the web root when the flow was started by the native client, so `ASWebAuthenticationSession` can detect completion and hand control back. Threading a "started by native client" flag through the existing OAuth `state`/pending-state tracking (`src/ebay/oauth-state.ts`, `sessionStore.addPendingEbayOAuthState`) is the natural place for this — designed properly in its own change once this shell is working.
- Watchlist/Purchases/Analytics tabs' actual content (capture, delete, watchlist automation, the AI assistant, voice input) — each gets its own phase once the shell and auth are proven.
- Any change to the web app or the backend beyond what's listed above.
- Distribution/signing/notarization for sharing the app outside this Mac — out of scope until there's something worth distributing.

## Success Criteria

- The app launches, shows the sidebar with all five items, and switching between them updates the detail pane.
- Settings is visually pinned to the bottom of the sidebar, separate from the four main tabs.
- On launch, the app calls the real backend (`config-status`, `session`, and the Home tab's `buying-history` call) and displays the real response — a `409`/"not connected" state, truthfully reflecting that OAuth isn't built yet, not a hardcoded placeholder.
- No changes to `src/`, `app/api/*`, or `app/page.tsx` are needed for this phase (confirmed by the audit above) — this proposal is purely additive under `macos/`.
