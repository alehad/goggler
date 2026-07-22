## ADDED Requirements

### Requirement: Purchases tab search

The Purchases tab SHALL provide a text search that narrows the purchase list by title/seller.

#### Scenario: User searches by title

- **GIVEN** the Purchases tab is showing won items
- **WHEN** the user types a search term
- **THEN** the list SHALL show only items whose title (or seller) matches the term

### Requirement: Purchase card market-context stats

Each purchase card SHALL show its matched-sales average, minimum, and maximum price, and a diff between the paid price and the average, right-aligned next to the paid-price block.

#### Scenario: Paid price below average

- **GIVEN** a purchase whose matched-sales average is higher than the price paid
- **WHEN** the purchase card is shown
- **THEN** the diff SHALL be shown in green with both the absolute and percentage difference

#### Scenario: Paid price above average

- **GIVEN** a purchase whose matched-sales average is lower than the price paid
- **WHEN** the purchase card is shown
- **THEN** the diff SHALL be shown in red with both the absolute and percentage difference

#### Scenario: No matched-sales data yet

- **GIVEN** a purchase whose relisting group has no matched sales, or whose relisting group cannot be computed
- **WHEN** the purchase card is shown
- **THEN** the stats SHALL show a placeholder rather than an error or a stale value

### Requirement: Purchase-to-Analytics navigation

Selecting a purchase's price-history action SHALL switch to the Analytics tab with that item selected and its matched-sales chart shown.

#### Scenario: User clicks the price-history action on a purchase

- **GIVEN** the user is on the Purchases tab
- **WHEN** the user clicks a purchase card's price-history action
- **THEN** the active tab SHALL switch to Analytics
- **AND** that item SHALL be selected and scrolled into view
- **AND** the chart SHALL show that item's matched sales

### Requirement: Won items visible in Analytics tab

The Analytics tab's item list SHALL include won items that were never on the watchlist, in addition to ended watchlist items, interleaved by date.

#### Scenario: Navigating to a won item that was never watched

- **GIVEN** a won item that never appeared in the ended-watchlist list
- **WHEN** the Analytics tab item list is shown
- **THEN** that item SHALL appear in the list, tagged as won
- **AND** it SHALL be selectable to drive the matched-sales chart

### Requirement: Analytics tag badges and win-status filter

Each Analytics tab row SHALL be tagged with its capture status (captured/not captured) and win status (won/eventually won/never won), shown as badges, and the tab SHALL provide a win-status filter alongside the existing capture-status filter.

#### Scenario: Item won via a different listing in the same group

- **GIVEN** an ended-watchlist item that was not itself won
- **AND** the user won a different listing sharing that item's relisting group
- **WHEN** the item is shown in the Analytics tab
- **THEN** it SHALL be tagged "eventually won"

#### Scenario: Filtering by win status

- **GIVEN** the Analytics tab item list is visible
- **WHEN** the user selects a win-status filter option
- **THEN** the list SHALL show only items matching that win status
- **AND** the existing capture-status filter SHALL continue to apply together with it
