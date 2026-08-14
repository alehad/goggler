## ADDED Requirements

### Requirement: Capture candidates include historical captures no longer in the live watchlist

The list of ended-watchlist items shown for capture (and their capture status) SHALL be the union of the live eBay watchlist fetch's ended items and every `MarketPriceRecord` already captured for this user, not just whichever items eBay's live fetch currently happens to return.

#### Scenario: A captured item is no longer in the live watchlist fetch

- **GIVEN** a `MarketPriceRecord` exists for an item that eBay's current live `WatchList` fetch no longer returns
- **WHEN** the capture-candidates list is built
- **THEN** that item SHALL still appear in the list, flagged as captured

#### Scenario: A live-fetched item is also already captured

- **GIVEN** an item appears in both the live watchlist fetch and this user's `MarketPriceRecord` table
- **WHEN** the capture-candidates list is built
- **THEN** that item SHALL appear exactly once, flagged as captured

#### Scenario: A live-fetched item has never been captured

- **GIVEN** an item appears in the live watchlist fetch but has no `MarketPriceRecord`
- **WHEN** the capture-candidates list is built
- **THEN** that item SHALL appear, flagged as not captured
