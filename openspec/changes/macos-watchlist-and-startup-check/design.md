# Design: macOS Watchlist tab + startup connectivity check

## Why not actively start Tailscale

Considered and rejected an approach where the app shells out to the Tailscale binary to check/start the daemon itself. Two concrete blockers on this machine, likely to generalize:

1. **App Sandbox**: `Goggler.entitlements` currently has `com.apple.security.app-sandbox = true`. A sandboxed app cannot launch arbitrary external executables; doing this would mean dropping the sandbox entirely, a real security-posture change for marginal benefit.
2. **No CLI present**: this machine has the GUI `Tailscale.app` installed (confirmed via `mdfind`/`ls /Applications`), which does not put a `tailscale` binary on `PATH` by default — that requires a separate "Install CLI" step from the app's menu. Even if present, `tailscale up` cannot complete first-time auth headlessly (it opens a browser).

Given that, the realistic "fix" for a down Tailscale connection is always a user action (open the menu bar app, reconnect) — so the app's job is to detect the failure clearly and get the user to that action in one click (`NSWorkspace.open(URL(fileURLWithPath: "/Applications/Tailscale.app"))`), not to perform it.

## Shared history store

Today `HomeView` privately owns `configStatus`/`connection`/`buyingHistoryState` and fetches on its own `.task`. Adding Watchlist as a second consumer of the same `buying-history` response means this needs to move up one level, matching the web app's shape (`historyState` lives in the top-level `Home()` component in `app/page.tsx`, shared by `Tracking`/`Won`/`Analytics`).

```swift
@Observable
final class BuyingHistoryStore {
    enum State {
        case idle, loading, reauthRequired
        case unavailable(message: String)
        case ready(BuyingHistory)
    }

    private(set) var configStatus: EbayConfigStatus.Config?
    private(set) var connection: EbaySession.Connection?
    private(set) var connectionLoadFailed = false
    private(set) var state: State = .idle

    func refresh(using client: GogglerAPIClient) async { ... } // config-status -> session -> buying-history
}
```

Owned once in `GogglerApp` alongside `AppSettings`, injected via `.environment(store)`. `HomeView` and `WatchlistView` both read it; only whichever runs first (the startup check, in practice) triggers the actual network calls — the others see `state != .idle` and don't re-fetch.

`BuyingHistory`/`HistoryItem` are added to `GogglerModels.swift` mirroring the TS `BuyingHistory`/`HistoryItem` types in `app/page.tsx` (`lostItems`, `wonItems`, `counts`). `homeFeed` and `warnings` are intentionally left undecoded — `Decodable` only decodes properties the struct declares, so omitting them isn't a partial/lossy decode, just an unused-field skip, the same way `HomeView` already only pulls the two config/session fields it needs.

## Startup gate

`ContentView` gains a thin overlay driven entirely by `BuyingHistoryStore`'s existing fields — no new parallel state machine:

- While `store.connectionLoadFailed == false` and the config/session calls haven't completed yet: "Checking connection…" with a spinner.
- If `store.connectionLoadFailed == true`: replace with the failure message + Retry / Open Tailscale / Open Settings.
- Once config/session load succeeds (`connectionLoadFailed == false` and `connection != nil`): the gate is satisfied and disappears, regardless of `state` (which may still legitimately be `.reauthRequired` — that's a Home-tab concern, not a startup-gate concern).

This keeps "is the backend reachable" (gate concern) cleanly separate from "is eBay connected" (ordinary Home-tab state, already handled), rather than conflating them into one bigger state machine.

## Distinguishing "Tailscale down" from "Tailscale fine, backend down"

The original design treated any connectivity failure as one case ("check Tailscale"). In practice this collapsed two very different problems into one confusing message. Confirmed empirically (killing the local dev server while Tailscale stayed connected, then `curl -v` against the Tailscale hostname): `tailscale serve` returns a real HTTP `502` when Tailscale is up but nothing is listening behind it — TLS and the connection succeed, only the response is bad. A fully-down Tailscale connection instead fails before any HTTP response exists at all (a `URLSession`-level error, e.g. a TLS/routing failure).

`BuyingHistoryStore` classifies each connectivity failure accordingly:

- `.tunnelUnreachable` — the request threw before getting an HTTP response (`GogglerAPIClient.request` itself failed).
- `.backendUnreachable` — a response came back, just not a usable one (non-2xx status or an undecodable body).

The startup gate shows a different message and button set per case: `.tunnelUnreachable` keeps "Check that Tailscale is running" + an Open Tailscale button; `.backendUnreachable` says the backend isn't responding and drops the Open Tailscale button, since opening Tailscale wouldn't help. `Logging.swift` adds `os.Logger` instrumentation (`subsystem: com.goggler.Goggler`) around every startup-relevant request so a real failure can be traced via `log stream --predicate 'subsystem == "com.goggler.Goggler"'` instead of guessed at from a generic on-screen message.

## Watchlist tab

`WatchlistView` is a direct port of the web `Tracking` component's shape: a segmented filter (All / Never won / Eventually won) over `store.state`'s `.ready(history)` → `history.lostItems`, computing "eventually won" the same way (`wonItems` sharing a `relistingGroupId`), three summary counts from `history.counts`, and a Refresh button calling `store.refresh(using:)`. Row content (title, seller, condition, end date, max bid, sold price, status pill) mirrors `HistoryRow`/`formatLostStatus` in `app/page.tsx`, using native `List`/`LabeledContent` rather than the web's CSS grid rows.
