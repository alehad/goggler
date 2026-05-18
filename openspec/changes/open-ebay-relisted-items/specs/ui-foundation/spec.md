## ADDED Requirements

### Requirement: External eBay item action

The Home feed SHALL provide a usable external eBay item action for active listing rows that have a trusted eBay item URL.

#### Scenario: Relisting row has an eBay URL

- **GIVEN** a Home feed row represents an active relisting candidate
- **AND** the row has a trusted eBay item URL
- **WHEN** the row is rendered
- **THEN** the row SHALL show a `View on eBay` action
- **AND** selecting the action SHALL open the URL in a separate browsing context

#### Scenario: Relisting row has no trusted URL

- **GIVEN** a Home feed row represents an active relisting candidate
- **AND** the row does not have a trusted eBay item URL
- **WHEN** the row is rendered
- **THEN** the row SHALL NOT show an enabled `View on eBay` action

### Requirement: Preserve read-only intent

The UI SHALL distinguish the external eBay action from native watchlist mutation.

#### Scenario: User needs to add an item to watchlist

- **GIVEN** the user sees a relisted item that is not already watched
- **WHEN** the user wants to add it to their eBay watchlist
- **THEN** the UI SHALL route them to eBay for that action
- **AND** SHALL rely on a later feed refresh to show whether eBay now reports the item as watched
