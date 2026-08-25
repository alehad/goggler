# Change: Fix remaining unhandled network-level fetch failures in app/page.tsx

## Why

[[fix-refresh-feed-network-error]] fixed `refreshBuyingHistory` hanging forever when `fetch` itself rejects (connection refused, offline, a dropped tunnel mid-session — not an HTTP error status). That change's tasks.md explicitly flagged five other functions in `app/page.tsx` with the identical gap, deferred as a follow-up rather than bundled in silently:

- `refreshEbayConfigStatus`
- `refreshEbaySessionState`
- `disconnectEbay`
- `executeHomeSearch`
- `captureVenueItems`

Each calls `fetch(...)` with no `try`/`catch`, so a network-level failure produces an unhandled promise rejection instead of a caught error. This change closes that gap for all five.

## Root Cause

Same class of bug as the original: every one of these functions only branches on `response.ok` / `response.status`, which assumes `fetch` resolved to a `Response`. If `fetch` rejects instead, none of that code runs, and:

- `refreshEbayConfigStatus` / `refreshEbaySessionState` (background polling, no visible loading state): the state variable they were about to set (`ebayConfigStatus`, `ebaySession`) is simply left stale — not visibly "stuck," but silently wrong, and any `await`ing caller downstream never gets a chance to react.
- `disconnectEbay` (user-facing "Disconnect" action): the account dropdown just does nothing — no error message, no re-enabled control, unclear whether the click registered.
- `executeHomeSearch` (user-facing search submit): `homeSearchState` is left on `{ status: "loading", query }` permanently — the same "hangs forever" symptom the original bug report was about, just on a different action.
- `captureVenueItems` (user-facing bulk/individual capture): the capture button's pending state is safely cleared by the existing `try`/`finally` in `captureOne`/`captureAllVisible`, but the user gets no message explaining that nothing was captured.

## What Changes

Wrap each function's `fetch` call in `try`/`catch`, following the established pattern in this file (`refreshBuyingHistory`, `deleteHistoryItems`). The fallback per function is not uniform — it matches what each function already does for its existing failure branches:

- **`refreshEbayConfigStatus`**: on network failure, set `ebayConfigStatus` to `null` — the same value it already sets for a non-`ok` HTTP response. No loading state to unstick.
- **`refreshEbaySessionState`**: on network failure, set `ebaySession` to `null` — the same value it already sets for a non-`ok` HTTP response. No loading state to unstick.
- **`disconnectEbay`**: on network failure, set `accountMessage` to `"Could not disconnect eBay: network error"` (mirrors the existing `"Could not disconnect eBay"` non-`ok` message, plus the `": network error"` suffix convention already used by `deleteHistoryItems`).
- **`executeHomeSearch`**: on network failure, set `homeSearchState` to `{ status: "unavailable", query, message: "Could not reach the server. Check your connection and try again." }` — same message wording as `refreshBuyingHistory`'s fix, same `unavailable` state the function already uses for a non-`ok` response.
- **`captureVenueItems`**: on network failure, set `message` to `"Could not capture price history for this item: network error"` (mirrors the existing `"Could not capture price history for this item"` non-`ok` message, plus the same `": network error"` suffix convention).

## Out of Scope

- Automatic retry logic — consistent with the original change, every failure branch in this file is "show a message, let the user press the button again."
- Any other fetch call in this file (`askAssistant`, `deleteHistoryItems`, `refreshBuyingHistory`) — those already have `try`/`catch`.
