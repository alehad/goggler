# Capability: Venue Adapters

## ADDED Requirements

### Requirement: Production eBay read-only configuration

The eBay adapter SHALL support an explicit production read-only configuration path for authenticated user watchlist and buying-history reads.

#### Scenario: Production environment selected

- **GIVEN** `EBAY_ENVIRONMENT` is `production`
- **WHEN** the eBay adapter loads configuration
- **THEN** it SHALL require production-specific eBay OAuth credentials and scopes
- **AND** it SHALL select production eBay OAuth and Trading API endpoints
- **AND** it SHALL NOT fall back to Sandbox or generic OAuth credential variables

#### Scenario: Sandbox remains the local default

- **GIVEN** `EBAY_ENVIRONMENT` is unset
- **WHEN** the eBay adapter loads configuration
- **THEN** it SHALL default to Sandbox endpoints
- **AND** it SHALL require Sandbox-specific eBay OAuth credentials and scopes

#### Scenario: Production read-only live history

- **GIVEN** a user has signed into goggler and connected a real eBay account in production mode
- **WHEN** the app requests live buying history
- **THEN** the adapter SHALL retrieve watchlist, lost, and won lists through read-only eBay API calls
- **AND** token values SHALL remain session-scoped and SHALL NOT be persisted at rest
