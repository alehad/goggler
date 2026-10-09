## MODIFIED Requirements

### Requirement: Matching preferences settings UI

The web app's `My goggler` (Account) tab SHALL let the user view and change matching preferences, reading the current value from and writing changes to the server, rather than to browser-local storage.

#### Scenario: Preferences load from the server, not localStorage

- **GIVEN** the user opens the Account tab in a browser that has never visited this app
- **WHEN** the tab loads
- **THEN** it SHALL fetch the current matching preferences from the server
- **AND** SHALL NOT read a locally-stored value as the source of truth

#### Scenario: Saving is explicit

- **GIVEN** the user has changed the exact-title-match toggle or criteria text
- **WHEN** they have not yet pressed Save
- **THEN** the change SHALL NOT be sent to the server
- **WHEN** they press Save
- **THEN** the change SHALL be persisted server-side and reflected back as the new current value

#### Scenario: A change saved from any client is visible without a web-specific action

- **GIVEN** matching preferences were changed and saved from a different client (e.g. the macOS app)
- **WHEN** the web app's Account tab is subsequently loaded or refreshed
- **THEN** it SHALL show the value saved by the other client, not a separately-remembered local value
