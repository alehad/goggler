## MODIFIED Requirements

### Requirement: Supplemental buyer orders for won items

The live eBay buying-history source SHALL supplement `GetMyeBayBuying.WonList` purchases with buyer orders returned by Trading API `GetOrders`. The `GetOrders` request's page size SHALL stay within eBay's limit for that call, independent of any larger page size used for `WatchList`/`LostList`/`WonList`.

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

#### Scenario: WatchList uses a larger page size than GetOrders can accept

- **GIVEN** the watchlist fetch is configured with a page size larger than eBay's `GetOrders` limit
- **WHEN** goggler builds live buying history
- **THEN** the `GetOrders` request SHALL use a page size within its own limit
- **AND** the `WatchList`/`LostList`/`WonList` requests SHALL still use the larger configured page size
