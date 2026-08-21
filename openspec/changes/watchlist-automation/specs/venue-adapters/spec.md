## ADDED Requirements

### Requirement: eBay Trading API supports adding an item to the watchlist

The system SHALL be able to add a specific eBay item to the authenticated user's eBay watchlist via the Trading API's `AddToWatchList` call, using the same request/authentication pattern as the existing `GetMyeBayBuying`/`GetOrders` calls.

#### Scenario: Successful add

- **GIVEN** a valid eBay item ID and a valid user access token
- **WHEN** the system calls `AddToWatchList` for that item
- **THEN** it SHALL report success when eBay's response `Ack` is `Success` or `Warning`

#### Scenario: Failed add does not throw for the caller's batch

- **GIVEN** eBay's response `Ack` is `Failure` for a given item
- **WHEN** the system processes an `AddToWatchList` failure
- **THEN** the failure SHALL be reported with eBay's error detail
- **AND** it SHALL NOT be silently swallowed or mistaken for success

### Requirement: Browse API search can be restricted to auction listings only

The system SHALL support filtering an eBay Browse API search to auction-format listings only, in addition to the existing default of both auction and fixed-price listings.

#### Scenario: Auction-only filter requested

- **GIVEN** a Browse API search is invoked with an auction-only filter
- **WHEN** the request is sent to eBay
- **THEN** the `buyingOptions` filter parameter SHALL restrict results to `AUCTION` listings only

#### Scenario: Existing callers unaffected

- **GIVEN** a Browse API search is invoked without specifying a buying-options filter
- **WHEN** the request is sent to eBay
- **THEN** it SHALL behave exactly as it did before this change (both auction and fixed-price listings)
