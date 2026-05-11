# Capability: Venue Adapters

## ADDED Requirements

### Requirement: eBay Trading API buying-history foundation

The eBay adapter SHALL provide a testable Trading API boundary for fetching authenticated eBay UK buying-history pages.

#### Scenario: Build a lost-list request

- **GIVEN** a session-scoped eBay OAuth access token
- **WHEN** the adapter builds a `GetMyeBayBuying` request for `LostList`
- **THEN** the request SHALL target the configured Trading API endpoint
- **AND** SHALL use eBay UK site id `3` by default
- **AND** SHALL send the token in `X-EBAY-API-IAF-TOKEN`
- **AND** SHALL NOT include token material in the XML body

#### Scenario: Build a won-list request

- **GIVEN** a session-scoped eBay OAuth access token
- **WHEN** the adapter builds a `GetMyeBayBuying` request for `WonList`
- **THEN** the request SHALL include `WonList` pagination controls
- **AND** SHALL NOT request `LostList` in the same request

#### Scenario: Normalize buying-history XML

- **GIVEN** eBay returns a successful representative `GetMyeBayBuying` XML response
- **WHEN** the adapter parses the response
- **THEN** it SHALL return normalized item records with item id, title, list kind, price, seller, end time, and condition when present

#### Scenario: Normalize Trading API failures

- **GIVEN** eBay returns an HTTP failure or non-success acknowledgement
- **WHEN** the adapter handles the response
- **THEN** it SHALL return a normalized adapter error
- **AND** SHALL NOT expose OAuth token values in the error message

### Requirement: Mocked relisting buying-history data

The eBay adapter foundation SHALL include deterministic local buying-history fixtures that model lost bids, won bids, and later relisted wins.

#### Scenario: Fixture counts

- **GIVEN** the local mocked buying-history fixtures
- **WHEN** tests inspect the fixture set
- **THEN** there SHALL be 10 lost bid items
- **AND** there SHALL be 7 won items
- **AND** 4 won items SHALL be marked as relistings of earlier lost bid items

#### Scenario: Never-won lost bid filtering

- **GIVEN** the local mocked buying-history fixtures
- **WHEN** lost bid items are filtered to exclude items later won through a relisting
- **THEN** 6 lost bid items SHALL remain
