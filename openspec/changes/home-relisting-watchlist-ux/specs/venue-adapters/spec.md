# Capability: Venue Adapters

## ADDED Requirements

### Requirement: Watchlist-aware fixture data

The fixture adapter SHALL be able to model active watchlist state separately from lost/won buying-history records.

#### Scenario: Fixture watchlist items

- **GIVEN** fixture mode is enabled
- **WHEN** the app builds the Home feed
- **THEN** fixture data SHALL include active watchlist items
- **AND** SHALL distinguish watchlist items tied to lost bids from unrelated watchlist items
- **AND** SHALL include a stable display order for watchlist items

#### Scenario: Fixture add-to-watchlist action

- **GIVEN** fixture mode is enabled
- **AND** a relisting candidate is not on the modeled watchlist
- **WHEN** the user chooses to add it to the watchlist
- **THEN** the system SHALL update only fixture or local app state
- **AND** SHALL NOT call live eBay watchlist APIs
