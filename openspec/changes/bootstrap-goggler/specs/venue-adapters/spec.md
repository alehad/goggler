# Capability: Venue Adapters

## ADDED Requirements

### Requirement: Isolated venue integration

The system SHALL isolate marketplace-specific API behavior behind a venue adapter boundary.

#### Scenario: Normalize marketplace data

- **GIVEN** an adapter receives marketplace-specific listing or buying-history data
- **WHEN** the adapter returns data to the application
- **THEN** the data SHALL use internal domain structures rather than raw provider response shapes

### Requirement: eBay UK initial adapter

The system SHALL provide an initial adapter for eBay UK.

#### Scenario: Import eBay buying history

- **GIVEN** a user has connected an eBay UK account
- **WHEN** the buying history import runs
- **THEN** the adapter SHALL return won and not-won auction records for that user

#### Scenario: Search active eBay UK auctions

- **GIVEN** a user has tracked a not-won auction item
- **WHEN** the search process runs
- **THEN** the adapter SHALL search active eBay UK auction listings for candidate relistings

