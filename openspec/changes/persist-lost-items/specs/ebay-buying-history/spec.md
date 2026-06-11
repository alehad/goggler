# ebay-buying-history Spec Delta

## ADDED Requirements

### Requirement: Durable lost-item history

The system SHALL persist normalized lost/not-won items owned by the current goggler user after a successful live eBay history refresh.

#### Scenario: New lost item is imported

- **GIVEN** eBay returns a lost item that is not already persisted for the current user
- **WHEN** the live buying-history refresh succeeds
- **THEN** the system SHALL persist the normalized lost item
- **AND** SHALL return it in `lostItems`

#### Scenario: Existing lost item is imported again

- **GIVEN** the same eBay lost item is already persisted for the current user
- **WHEN** a later live refresh returns that item again
- **THEN** the system SHALL update the existing record without creating a duplicate

#### Scenario: Lost item ages out of eBay history

- **GIVEN** a lost item was persisted from an earlier successful import
- **AND** a later live eBay response no longer includes that item
- **WHEN** the buying-history response is assembled
- **THEN** the persisted item SHALL remain available in `lostItems`

### Requirement: Distinct lost-item prices

The system SHALL persist the user's maximum bid independently from the final/sold price of a lost item.

#### Scenario: eBay returns both lost-item prices

- **GIVEN** eBay returns a maximum bid and a final/sold price for a lost item
- **WHEN** the lost item is persisted and later returned
- **THEN** both amounts SHALL remain distinct
- **AND** each amount SHALL retain its corresponding currency

### Requirement: Durable lost-item relisting source

The system SHALL use persisted lost items when classifying buying history and discovering potential relistings.

#### Scenario: Older lost item has aged out of eBay history

- **GIVEN** a persisted lost item is absent from the latest live eBay response
- **WHEN** goggler classifies lost history and searches for relistings
- **THEN** the older persisted lost item SHALL remain eligible for classification and relisting discovery

### Requirement: Separate transient candidate data

The system SHALL keep watchlist items and relisting candidates out of durable lost-item storage.

#### Scenario: Live candidate data is produced

- **GIVEN** a refresh returns watchlist items or discovers relisting candidates
- **WHEN** lost items are persisted
- **THEN** watchlist items and relisting candidates SHALL NOT be inserted into lost-item storage

### Requirement: Secret-free lost-item persistence

The system SHALL NOT persist eBay OAuth secrets or raw upstream request/response data with lost items or lost-item import runs.

This prohibition SHALL apply to all local, hosted, shared, development, test, staging, and production databases and durable stores. Encryption, hashing, encoding, or transformation SHALL NOT make OAuth credential persistence permissible.

#### Scenario: Lost items are imported

- **GIVEN** the current session has an eBay OAuth token
- **WHEN** lost items are persisted
- **THEN** no access token, refresh token, authorization code, request header, cookie, callback query string, or raw eBay XML SHALL be written to persistent storage
