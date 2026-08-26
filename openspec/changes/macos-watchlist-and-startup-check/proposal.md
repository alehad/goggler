# Proposal: macOS Watchlist tab + startup connectivity check

## Why

[[macos-app-shell]] shipped the navigation shell with one functional tab (Home). The next planned phase is filling in the other tabs, starting with Watchlist — and separately, the user has hit the app showing a bare "Could not reach the server" error on Home with no guidance when the Tailscale connection backing the configured base URL isn't up. Both are needed before the app is pleasant to use day-to-day.

## What Changes

- **Watchlist tab**: implements the native equivalent of the web app's "Watching" tab (`Tracking` component in `app/page.tsx`) — a list of tracked lost auctions (`historyState.history.lostItems`), filterable by All / Never won / Eventually won, with summary counts and a Refresh button. No new backend endpoint: this reuses the same `POST /api/ebay/buying-history` response the Home tab already fetches (`lostItems`, `wonItems`, `counts`), so the response is now fully decoded (currently `HomeView` only inspects the HTTP status code and discards the body).
- **Shared history store**: the buying-history load (config-status → session → buying-history) moves out of `HomeView` into a small `@Observable` `BuyingHistoryStore`, owned once at the app level and shared via `.environment(...)` — mirroring how the web app hoists `historyState` to the top-level `Home()` component and shares it across tabs, rather than each tab independently fetching.
- **Startup connectivity check**: on launch, before the sidebar/detail UI is interactive, the app shows a small status overlay ("Checking connection…") that calls the backend (reusing the store's existing config-status/session calls). If the backend is unreachable, the overlay stays up with a clear message, a **Retry** button, an **Open Tailscale** button (`NSWorkspace.open` on the installed `Tailscale.app` — no process-launching, no sandbox change), and an **Open Settings** button (so a wrong base URL, not just a down tunnel, is also recoverable without getting stuck). If the backend responds at all, the app proceeds into the normal UI — this does **not** block on eBay being connected, since a 409/"not connected" is an expected, valid state before OAuth (a later phase) exists, and blocking on it would trap the user.

## Out of Scope

- Purchases and Analytics tabs (future phases, per [[macos-app-shell]]).
- Actually starting/managing the Tailscale daemon from the app — rejected: the app is App-Sandboxed and Tailscale is installed as the GUI app with no CLI in `PATH`, so this would require dropping the sandbox and shelling out to a system binary for marginal benefit over a one-click "Open Tailscale" prompt. See design.md.
- Any backend/web change — this is purely additive under `macos/`, reusing the existing `buying-history` response shape.

## Success Criteria

- Selecting Watchlist in the sidebar shows tracked lost auctions from the real backend, filterable the same three ways the web "Watching" tab supports, with matching counts.
- On launch, with the configured backend unreachable, the user sees a clear message and can retry, open Tailscale, or open Settings — never a silent hang or a bare error with no next step.
- On launch, with the backend reachable, the app proceeds into the sidebar/detail UI regardless of eBay connection status.
- No changes to `src/`, `app/api/*`, or `app/page.tsx`.
