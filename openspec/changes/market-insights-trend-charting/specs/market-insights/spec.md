## ADDED Requirements

### Requirement: Matched-sales lookup by relisting group and currency

The `market-insights` module SHALL provide a read path that returns all sales matching a given `relistingGroupId` and currency, merging captured price-history records with the user's own Won purchases for that group.

#### Scenario: A captured sale and a Won purchase are the same listing

- **GIVEN** a `MarketPriceRecord` and a `WonItem` share the same `venueItemId` for the requesting user
- **WHEN** matched sales are requested for that item's relisting group and currency
- **THEN** it SHALL appear once in the result, flagged as won

#### Scenario: A Won purchase was never captured

- **GIVEN** the user won an item that was never on their watchlist, so no `MarketPriceRecord` exists for it
- **AND** its title matches the requested relisting group and its price currency matches the requested currency
- **WHEN** matched sales are requested for that group
- **THEN** the win SHALL appear in the result, flagged as won

#### Scenario: A matching sale exists in a different currency

- **GIVEN** a captured sale or Won purchase shares the requested relisting group but not the requested currency
- **WHEN** matched sales are requested
- **THEN** that sale SHALL NOT be included in the result and SHALL NOT be converted into the requested currency

### Requirement: No eBay calls for matched-sales lookups

Matched-sales lookups SHALL be served entirely from local persistence, without calling any eBay API.

#### Scenario: Matched sales are requested

- **GIVEN** the user selects an item to view matched sales for
- **WHEN** the request is processed
- **THEN** no eBay API call SHALL be made
