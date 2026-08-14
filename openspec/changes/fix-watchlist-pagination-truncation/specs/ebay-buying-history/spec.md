## MODIFIED Requirements

### Requirement: Ended watchlist items are surfaced separately from active ones

The system SHALL expose ended watchlist items (items previously returned by `GetMyeBayBuying`'s `WatchList` whose listing has ended) as a distinct list from the active watchlist, rather than discarding them. The watchlist fetch SHALL be paginated deeply enough to cover this account's actual scale, and any remaining truncation SHALL be reported rather than silently dropping items.

#### Scenario: Watchlist response contains both active and ended items

- **GIVEN** eBay returns `WatchList` items with a mix of future and past end times
- **WHEN** goggler builds the live buying-history response
- **THEN** items with a past end time SHALL appear in `endedWatchlistItems`
- **AND** they SHALL NOT appear in the active `watchlistItems` list used by Home/Watching

#### Scenario: A large combined watchlist is fetched in full

- **GIVEN** the account's combined active-plus-ended watchlist exceeds the previous 150-entry fetch cap
- **WHEN** goggler builds the live buying-history response
- **THEN** the watchlist fetch SHALL cover up to the new, larger cap before considering the list complete

#### Scenario: The watchlist is still truncated despite the raised cap

- **GIVEN** the combined watchlist still exceeds the fetch's page limit
- **WHEN** goggler builds the live buying-history response
- **THEN** a truncation warning SHALL be included in the response's `warnings`, not silently dropped

#### Scenario: Fixture mode includes ended items

- **GIVEN** the app is running with `GOGGLER_EBAY_HISTORY_SOURCE=fixture`
- **WHEN** the buying-history response is built
- **THEN** `endedWatchlistItems` SHALL include representative fixture data so the Analytics tab is testable without a live eBay connection

#### Scenario: Ended items never reach the Home feed

- **GIVEN** `endedWatchlistItems` is populated
- **WHEN** the Home feed is built (`buildHomeFeed`)
- **THEN** `endedWatchlistItems` SHALL NOT be passed as an input to `buildHomeFeed`
- **AND** no Home, Watching, or search row SHALL be derived from an ended watchlist item
- **AND** ended watchlist items SHALL only be reachable through the Analytics tab's capture-candidates list
