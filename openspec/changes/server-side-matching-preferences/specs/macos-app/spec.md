## ADDED Requirements

### Requirement: Matching preferences settings UI

The macOS app's Settings sheet SHALL let the user view and change the same matching preferences the web app exposes, reading from and writing to the server — the app's first user-editable preference of any kind.

#### Scenario: Preferences load from the server on open

- **GIVEN** the user opens Settings
- **WHEN** the Matching preferences section appears
- **THEN** it SHALL fetch and display the current server-persisted value, not a hardcoded default

#### Scenario: Saving is explicit

- **GIVEN** the user has changed the exact-title-match toggle or criteria text in Settings
- **WHEN** they have not yet pressed Save
- **THEN** the change SHALL NOT be sent to the server
- **WHEN** they press Save
- **THEN** the change SHALL be persisted server-side

### Requirement: No hardcoded matching-preferences default

The macOS app SHALL NOT send a client-side hardcoded `exactTitleMatch`/`criteriaText` value in any backend request — every route that needs matching preferences reads its own persisted copy.

#### Scenario: Requests that previously sent a hardcoded default no longer do

- **GIVEN** a request to the chat assistant or the matched-sales chart
- **WHEN** the app builds that request
- **THEN** it SHALL NOT include an `exactTitleMatch` or `criteriaText` value in the request
