# Capability: Venue Adapters

## ADDED Requirements

### Requirement: Buyer GetOrders read path

The eBay Trading adapter SHALL support retrieving buyer orders through `GetOrders` using the active session-scoped user OAuth token.

#### Scenario: Build buyer GetOrders request

- **GIVEN** the user has an active session-scoped eBay OAuth token
- **WHEN** the adapter builds a buyer `GetOrders` request
- **THEN** the request SHALL set `OrderRole` to `Buyer`
- **AND** it SHALL include explicit date filters and pagination controls
- **AND** it SHALL send OAuth token material only in the `X-EBAY-API-IAF-TOKEN` header
- **AND** it SHALL NOT place token material in the XML body

#### Scenario: Buyer order range exceeds eBay limits

- **GIVEN** goggler requests buyer orders over a period longer than eBay permits in one call
- **WHEN** the adapter fetches buyer orders
- **THEN** it SHALL split requests into valid date windows or reduce the lookback to eBay's supported range
- **AND** it SHALL expose a warning or diagnostic when the requested lookback is limited
