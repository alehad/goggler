# Capability: eBay Buying History

## ADDED Requirements

### Requirement: Supplemental buyer orders for won items

The live eBay buying-history source SHALL supplement `GetMyeBayBuying.WonList` purchases with buyer orders returned by Trading API `GetOrders`.

#### Scenario: Purchase appears only in WonList

- **GIVEN** `WonList` returns a won item
- **AND** buyer `GetOrders` does not return the same purchase
- **WHEN** goggler builds live buying history
- **THEN** the won item SHALL remain in `wonItems`

#### Scenario: Purchase appears only in GetOrders

- **GIVEN** buyer `GetOrders` returns a purchase
- **AND** `WonList` does not return the same purchase
- **WHEN** goggler builds live buying history
- **THEN** the purchase SHALL be included in `wonItems`

#### Scenario: Purchase appears in both sources

- **GIVEN** `WonList` and buyer `GetOrders` return the same purchase
- **WHEN** goggler builds live buying history
- **THEN** the purchase SHALL appear once in `wonItems`
- **AND** the merged row SHALL preserve the richest available item data from either source

#### Scenario: GetOrders fails after WonList succeeds

- **GIVEN** `WonList` returns won items
- **AND** buyer `GetOrders` fails
- **WHEN** goggler builds live buying history
- **THEN** the app SHALL still return the `WonList` won items
- **AND** it SHALL include a non-secret warning that supplemental buyer orders were unavailable

### Requirement: Purchase source diagnostics

The live eBay buying-history response SHALL expose optional diagnostics for comparing won-item sources.

#### Scenario: Both purchase sources return data

- **GIVEN** `WonList` and buyer `GetOrders` both return purchases
- **WHEN** goggler builds live buying history
- **THEN** diagnostics SHALL include source counts, merged count, overlap count, date-window information, and truncation flags when available
