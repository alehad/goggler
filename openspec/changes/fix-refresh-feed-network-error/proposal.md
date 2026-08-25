# Change: Fix "Refresh feed" hanging forever on a network-level failure

## Why

Reported directly: clicking "Refresh feed" on the Home tab "did nothing." The immediate cause that session was mundane (the Tailscale tunnel/dev server had been torn down after the previous change shipped, so there was nothing to respond) — but investigating it surfaced a real bug independent of that: the UI gives the user zero feedback and no way to recover when this happens, short of reloading the page.

## Root Cause

`refreshBuyingHistory()` in `app/page.tsx` sets `historyState` to `{ status: "loading" }`, then calls `await fetch("/api/ebay/buying-history", ...)` with no `try`/`catch` around it. Every other outcome (409, 501, 5xx, generic error) is handled by checking `response.status` — but if `fetch` itself rejects (the request never reaches a server at all: connection refused, DNS failure, offline, a dropped tunnel mid-session, etc.), none of that code runs. The unhandled rejection leaves `historyState` on `"loading"` permanently. `HistoryEmptyState` renders `"Loading buying history"` for that status, so the user sees a screen that looks like it's still working — indefinitely, with no error and no retry affordance.

This is a real, reachable failure mode beyond just "the dev server happened to be down": a Tailscale connection blip, a phone/laptop losing Wi-Fi mid-request, or any other transient network failure on the way to `/api/ebay/buying-history` would produce the exact same permanently-stuck screen in normal use.

## What Changes

- Wrap the `fetch` call in `refreshBuyingHistory()` in `try`/`catch`, matching the existing pattern already used for the same failure mode in this file (`askAssistant`'s `catch` block).
- On a network-level failure: fall back to `previousHistory` if there is one (matching the existing 5xx-failure behavior — don't discard a still-valid stale view over a transient blip), otherwise set `historyState` to `"unavailable"` with a clear, actionable message.

## Out of Scope

- Automatic retry logic (out of scope; the existing pattern for every other failure branch is "show a message, let the user press the button again," not silent retry).
- Any other fetch call in this file — this fix is scoped to `refreshBuyingHistory` specifically, the one this report was about. Other fetches (`askAssistant`, the AI chat) already have their own try/catch.
