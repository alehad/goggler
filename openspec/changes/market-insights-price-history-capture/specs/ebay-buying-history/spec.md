## ADDED Requirements

### Requirement: Ended watchlist items are surfaced separately from active ones

The system SHALL expose ended watchlist items (items previously returned by `GetMyeBayBuying`'s `WatchList` whose listing has ended) as a distinct list from the active watchlist, rather than discarding them.

#### Scenario: Watchlist response contains both active and ended items

- **GIVEN** eBay returns `WatchList` items with a mix of future and past end times
- **WHEN** goggler builds the live buying-history response
- **THEN** items with a past end time SHALL appear in `endedWatchlistItems`
- **AND** they SHALL NOT appear in the active `watchlistItems` list used by Home/Watching

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

### Requirement: Ended watchlist item prices reflect the true native listing currency

Ended watchlist item prices SHALL prefer the native listing currency (resolved via the Browse API) over the marketplace-converted price `GetMyeBayBuying` returns, using the Trading API price only as a fallback when the Browse lookup is unavailable for that item.

#### Scenario: Browse API resolves the native price for an ended item

- **GIVEN** an ended watchlist item whose `GetMyeBayBuying` price is in the marketplace's default currency
- **AND** a Browse API lookup for that item returns a native price in a different currency
- **WHEN** goggler builds the ended watchlist item
- **THEN** the item's price SHALL be the Browse-resolved native price, not the Trading API price

#### Scenario: Browse API lookup fails for an ended item

- **GIVEN** an ended watchlist item whose Browse API lookup fails or returns no price
- **WHEN** goggler builds the ended watchlist item
- **THEN** the item's price SHALL fall back to the Trading API price rather than being fabricated or omitted
