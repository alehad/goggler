## ADDED Requirements

### Requirement: The Analytics tab shows ended watchlist and won items with capture/win filters

The macOS app's Analytics tab SHALL render `endedWatchlistItems` plus any `wonItems` not already present in that list, from the same shared buying-history load Home/Watchlist/Purchases already use, filterable by capture status and win status, and searchable by title or seller.

#### Scenario: Filtering by capture status

- **GIVEN** the Analytics tab has loaded items with a mix of captured and not-captured status
- **WHEN** the user selects "Captured" or "Not captured"
- **THEN** the list SHALL show only items matching that status

#### Scenario: Filtering by win status

- **GIVEN** the Analytics tab has loaded items with a mix of won, eventually-won, and never-won outcomes
- **WHEN** the user selects one of the win-status filter options
- **THEN** the list SHALL show only items matching that outcome

#### Scenario: Analytics shares the backend call with Home, Watchlist, and Purchases

- **GIVEN** the shared store has already loaded buying history
- **WHEN** the user switches to the Analytics tab
- **THEN** the app SHALL NOT make an additional `POST /api/ebay/buying-history` call

### Requirement: Items can be captured into and removed from price history

The Analytics tab SHALL let the user add an ended watchlist item's final price to price history, and remove it again, both individually and in bulk across all currently-filtered items — updating the already-loaded list in place on success, without a full refresh.

#### Scenario: Capturing a single item

- **GIVEN** an ended watchlist item is shown as not captured
- **WHEN** the user captures it and the request succeeds
- **THEN** the item SHALL immediately show as captured
- **AND** no full history refresh SHALL be required

#### Scenario: Capturing all visible items

- **GIVEN** the Analytics tab is showing a mix of captured and not-captured items under the current filter
- **WHEN** the user selects "Capture all visible"
- **THEN** every currently-filtered, capturable, not-captured item SHALL be captured in one action

#### Scenario: Removing an item requires confirmation

- **GIVEN** a captured item is shown
- **WHEN** the user selects the remove action, individually or via "Delete all visible"
- **THEN** the app SHALL ask for confirmation before making the request
- **AND** SHALL only call the delete endpoint if the user confirms
