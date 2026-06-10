# ebay-buying-history Spec Delta

## ADDED Requirements

### Requirement: Durable won-item history

The system SHALL persist normalized won items owned by the current goggler user after a successful live eBay history refresh.

#### Scenario: New won item is imported

- **GIVEN** eBay returns a won item that is not already persisted for the current user
- **WHEN** the live buying-history refresh succeeds
- **THEN** the system SHALL persist the normalized won item
- **AND** SHALL return it in `wonItems`

#### Scenario: Existing won item is imported again

- **GIVEN** the same eBay won item is already persisted for the current user
- **WHEN** a later live refresh returns that item again
- **THEN** the system SHALL update the existing record without creating a duplicate

#### Scenario: Won item ages out of eBay history

- **GIVEN** a won item was persisted from an earlier successful import
- **AND** a later live eBay response no longer includes that item
- **WHEN** the buying-history response is assembled
- **THEN** the persisted item SHALL remain available in `wonItems`

### Requirement: Narrow persistence scope

The first persistence implementation SHALL store won items only and SHALL keep other live eBay lists transient.

#### Scenario: Other live lists are retrieved

- **GIVEN** a live refresh returns lost items, watchlist items, or relisting candidates
- **WHEN** the refresh completes
- **THEN** those rows SHALL NOT be persisted by this change

### Requirement: Secret-free purchase persistence

The system SHALL NOT persist eBay OAuth secrets or raw upstream request/response data with won items or import runs.

This prohibition SHALL apply to all local, hosted, shared, development, test, staging, and production databases and durable stores. Encryption, hashing, encoding, or transformation SHALL NOT make OAuth credential persistence permissible.

#### Scenario: Won items are imported

- **GIVEN** the current session has an eBay OAuth token
- **WHEN** won items are persisted
- **THEN** no access token, refresh token, authorization code, request header, cookie, callback query string, or raw eBay XML SHALL be written to persistent storage
