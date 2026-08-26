## ADDED Requirements

### Requirement: The Watchlist tab shows tracked lost auctions from the real backend

The macOS app's Watchlist tab SHALL render `lostItems` from the same `POST /api/ebay/buying-history` response the Home tab already fetches, filterable by All, Never won, and Eventually won (an item is "eventually won" if any item in `wonItems` shares its `relistingGroupId`), alongside the backend's own `lost`, `neverWon`, and `eventuallyWon` counts, and a control to re-fetch the data.

#### Scenario: Selecting a filter narrows the list

- **GIVEN** the Watchlist tab has loaded lost items from the backend
- **WHEN** the user selects "Eventually won"
- **THEN** only lost items whose `relistingGroupId` matches a won item SHALL be shown
- **AND** selecting "All" SHALL restore the full list

#### Scenario: Watchlist and Home share one backend call, not two

- **GIVEN** the Home tab has already loaded buying history on launch
- **WHEN** the user switches to the Watchlist tab
- **THEN** the app SHALL NOT make a second `POST /api/ebay/buying-history` call
- **AND** SHALL render the already-loaded data

### Requirement: The app checks backend connectivity before the main UI is usable

On launch, the macOS app SHALL verify the configured backend is reachable before the sidebar/detail UI accepts interaction, showing a status overlay while checking.

#### Scenario: The tunnel itself is unreachable (e.g. Tailscale disconnected)

- **GIVEN** the app launches and the connectivity check gets no HTTP response at all (a network-level failure)
- **WHEN** the check fails
- **THEN** the overlay SHALL show a clear message and remain up
- **AND** SHALL offer a Retry action, an action to open the Tailscale app, and an action to open Settings
- **AND** SHALL NOT silently hang with no feedback or path forward

#### Scenario: The tunnel is fine but nothing is listening on the backend

- **GIVEN** the app launches and the connectivity check gets a real but non-2xx HTTP response (e.g. `tailscale serve`'s `502` when Tailscale is connected but the backend process isn't running)
- **WHEN** the check fails this way
- **THEN** the overlay SHALL show a message indicating the backend itself isn't responding, distinct from the tunnel-down message
- **AND** SHALL offer Retry and Open Settings, but SHALL NOT offer to open Tailscale, since that would not address the problem

#### Scenario: Backend is reachable but eBay is not connected

- **GIVEN** the app launches with the configured backend reachable
- **WHEN** the connectivity check succeeds
- **THEN** the overlay SHALL dismiss and the sidebar/detail UI SHALL become interactive
- **AND** this SHALL happen regardless of whether eBay is connected, since eBay connection status is shown within the Home tab itself, not gated at startup

#### Scenario: Retrying after fixing the connection succeeds

- **GIVEN** the overlay is showing the unreachable state
- **WHEN** the user reconnects Tailscale and selects Retry
- **THEN** the app SHALL re-run the connectivity check
- **AND** SHALL dismiss the overlay if it now succeeds
