# Capability: UI Foundation

## ADDED Requirements

### Requirement: Larger Home feed listing thumbnails

The Home feed SHALL present listing thumbnails as a primary visual cue when an item image is available.

#### Scenario: Home feed item has an image

- **GIVEN** a Home feed row has an `imageUrl`
- **WHEN** the row is displayed
- **THEN** the row SHALL show the listing thumbnail at a larger stable size than the previous compact icon treatment
- **AND** the row text SHALL remain readable without overlapping the thumbnail, price, tags, or actions

#### Scenario: Home feed item has no image

- **GIVEN** a Home feed row has no `imageUrl`
- **WHEN** the row is displayed
- **THEN** the row SHALL show the existing non-image placeholder treatment
- **AND** the card layout SHALL remain stable

### Requirement: Focused Home feed summary and filters

The Home feed SHALL prioritize unresolved buying outcomes over workflow-only categories in its top-level controls.

#### Scenario: User views Home summary metrics

- **GIVEN** buying history is loaded
- **WHEN** the user views the Home summary metrics
- **THEN** one of the summary metrics SHALL show the number of won items
- **AND** one of the summary metrics SHALL show the number of never-won items
- **AND** the won metric SHALL be placed before the never-won metric

#### Scenario: User views Home filters

- **GIVEN** buying history is loaded
- **WHEN** the user views the Home filter controls
- **THEN** the filters SHALL NOT include `Needs action`
- **AND** the filters SHALL NOT include `Resolved`
- **AND** the filters SHALL include `Won`
- **AND** the filters SHALL include `Never won`

#### Scenario: User first opens Home

- **GIVEN** buying history is loaded
- **WHEN** the user first views Home
- **THEN** the selected Home filter SHALL be `On watchlist`

#### Scenario: User refreshes after history has loaded

- **GIVEN** buying history is already displayed
- **WHEN** a refresh request fails with a server-side live-history error
- **THEN** the existing Home feed SHALL remain displayed
