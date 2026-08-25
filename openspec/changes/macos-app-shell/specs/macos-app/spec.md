## ADDED Requirements

### Requirement: A native macOS app provides a sidebar/detail navigation shell

The macOS app SHALL present a two-pane layout: a sidebar with Home, Watchlist, Purchases, and Analytics as primary navigation items, and Settings visually and behaviorally separate (pinned at the bottom of the sidebar, not mixed into the main tab list), matching the shape already used by Claude Code's desktop app. Selecting a sidebar item SHALL update the detail pane to that tab's content.

#### Scenario: Switching tabs updates the detail pane

- **GIVEN** the app is running with the sidebar visible
- **WHEN** the user selects a different sidebar item (Home, Watchlist, Purchases, or Analytics)
- **THEN** the detail pane SHALL show that tab's content
- **AND** the previously-selected tab's content SHALL no longer be shown

#### Scenario: Settings is reachable but not a fifth main tab

- **GIVEN** the sidebar is showing the four main tabs
- **WHEN** the user looks at the sidebar
- **THEN** Settings SHALL be visually distinct from and positioned below the four main tabs, not interleaved with them

### Requirement: The macOS app is a pure client of the existing backend, with no duplicated business logic

The macOS app SHALL call the same JSON API routes the web app already uses (`app/api/*`) for all data and behavior. It SHALL NOT reimplement any logic already present in `src/` (eBay integration, matching, persistence, price-history computation, or any other domain logic) — only presentation.

#### Scenario: A real backend call is made and its real response is shown

- **GIVEN** the macOS app's Home tab loads
- **WHEN** it calls `POST /api/ebay/buying-history` against a real running backend
- **THEN** the app SHALL render the actual HTTP response it receives (whether a success or a `409 ebay_reauth_required`, since eBay OAuth is not yet implemented in this phase)
- **AND** SHALL NOT substitute a hardcoded or placeholder response

#### Scenario: Session authentication requires no backend changes

- **GIVEN** the macOS app makes a request to the backend
- **WHEN** the request is sent
- **THEN** the goggler session SHALL be carried via the same cookie-based mechanism the web app already uses (relying on `URLSession`'s standard cookie storage), requiring no new authentication mechanism on the backend

#### Scenario: CSRF validation is satisfied without a backend change

- **GIVEN** the macOS app makes a state-changing (non-GET) request to the backend
- **WHEN** the existing `validateSameOriginRequest` check runs
- **THEN** it SHALL pass because the macOS app sets an `Origin` header matching a trusted origin on every request
- **AND** no change to the CSRF validation logic itself SHALL be required for this
