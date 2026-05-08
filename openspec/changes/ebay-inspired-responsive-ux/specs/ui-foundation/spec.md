# Capability: UI Foundation

## ADDED Requirements

### Requirement: Marketplace-oriented navigation

The UI SHALL organize primary navigation around buyer activity concepts that are familiar from eBay-style marketplaces.

#### Scenario: Primary destinations

- **GIVEN** a user opens the app
- **WHEN** the primary navigation is shown
- **THEN** it SHALL expose destinations for Home, Watching, Purchases, and account/preferences behavior

### Requirement: Bottom-docked app shell

The UI SHALL support a bottom-docked navigation structure that can map naturally to a future iPhone app.

#### Scenario: Primary navigation

- **GIVEN** the app is viewed on a supported screen size
- **WHEN** the user navigates between primary destinations
- **THEN** the UI SHALL provide a bottom-tab style navigation surface

### Requirement: Marketplace listing rows

The UI SHALL present candidate relistings and history items as compact marketplace-style listing rows.

#### Scenario: Candidate relisting review

- **GIVEN** a likely relisting candidate is shown
- **WHEN** the user reviews the item
- **THEN** the row SHALL show item image, title, price context, seller/condition metadata, time status, confidence, and review actions

### Requirement: Account preferences hub

The account area SHALL group local user state, eBay connection state, and preferences in a familiar account/settings layout.

#### Scenario: Review connection setup

- **GIVEN** a user opens the account/preferences area
- **WHEN** eBay Sandbox config is incomplete
- **THEN** the UI SHALL show a non-secret readiness message and disable connection actions until ready
