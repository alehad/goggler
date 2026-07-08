## ADDED Requirements

### Requirement: Market insights module boundary

The system SHALL expose historical price capture behind a dedicated `market-insights` module, so the underlying data source can change without requiring API route or UI changes.

#### Scenario: Capture candidates are read through the module

- **GIVEN** a live buying-history response with ended watchlist items
- **WHEN** the Analytics tab requests capture candidates
- **THEN** the request SHALL go through the `market-insights` module's public interface
- **AND** no caller outside that module SHALL depend on ended-watchlist-items being the underlying data source

### Requirement: Captured price records are verified server-side before persisting

The system SHALL NOT persist a price value supplied directly by the client. Captured records SHALL be derived from a fresh, authenticated eBay fetch performed server-side at capture time.

#### Scenario: Client requests capture of specific items

- **GIVEN** the client submits a set of venue item ids to capture
- **WHEN** the server processes the capture request
- **THEN** it SHALL re-fetch the user's current ended watchlist items from eBay
- **AND** it SHALL persist only the requested items that are present in that freshly-fetched set
- **AND** it SHALL report which requested ids were skipped because they were not found
- **AND** the persisted price SHALL be the item's native listing currency (Browse-resolved when available), not a marketplace-converted figure

### Requirement: Captured records persist independently of the live watchlist view

The system SHALL store captured price records in a durable table distinct from `WonItem` and `LostItem`, since ended watchlist items include items the user never bid on.

#### Scenario: A previously captured item is captured again

- **GIVEN** an item has already been captured
- **WHEN** the same item is captured again
- **THEN** the system SHALL update the existing record rather than create a duplicate

### Requirement: No eBay write actions are introduced

The system SHALL NOT call any eBay write operation (such as adding items to the watchlist) as part of price history capture.

#### Scenario: Capturing a price record

- **GIVEN** the user captures one or more ended watchlist items
- **WHEN** the capture request is processed
- **THEN** only read-only eBay API calls SHALL be made
- **AND** the user's real eBay watchlist SHALL remain unchanged
