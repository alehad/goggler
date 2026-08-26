# Tasks: macOS Watchlist tab + startup connectivity check

- [x] Create OpenSpec change documenting the design (shared store shape, startup-gate approach, why not to shell out to Tailscale).
- [x] Add `Money`, `HistoryItem`, `BuyingHistory` to `GogglerModels.swift`.
- [x] Add `BuyingHistoryStore` (`@Observable`), owned in `GogglerApp` and shared via `.environment(...)`.
- [x] Refactor `HomeView` to use the shared store instead of its own local state.
- [x] Implement `WatchlistView` (filter, counts, list, Refresh), wired into `ContentView`'s `detailView` switch.
- [x] Implement the startup gate overlay in `ContentView` (checking / unreachable+Retry+Open Tailscale+Open Settings / satisfied).
- [x] Add/extend tests: `BuyingHistory`/`HistoryItem` decoding.
- [x] Add `os.Logger`-based diagnostic logging (`Logging.swift`) around the startup check and every backend request, so a real failure can be traced via Console.app/`log stream` instead of guessed at.
- [x] Classify connectivity failures into `.tunnelUnreachable` (no HTTP response at all — Tailscale/tunnel down) vs. `.backendUnreachable` (got a real HTTP response, e.g. `tailscale serve`'s `502` — Tailscale fine, nothing listening on the backend), confirmed empirically by killing the dev server with Tailscale connected, and show a distinct overlay message/button set for each instead of one generic "check Tailscale" message.
- [x] `xcodebuild build` and `xcodebuild test` clean.
- [x] Manual functional confirmation (user): Watchlist shows real tracked lost auctions and filters correctly; killing the dev server with Tailscale connected shows the "goggler isn't responding" message (no Open Tailscale button); a fully unreachable backend shows "Can't reach goggler" with Open Tailscale; Retry re-checks correctly in both cases; a reachable backend proceeds into the app even with eBay not connected.
- [ ] Run dual security review (security-review skill + Copilot CLI), then ship via PR.
