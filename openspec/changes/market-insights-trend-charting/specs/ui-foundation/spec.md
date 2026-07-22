## ADDED Requirements

### Requirement: Analytics tab search

The Analytics tab SHALL provide a text search that narrows the ended-items list, in addition to the existing captured-status filter.

#### Scenario: User searches by title

- **GIVEN** the Analytics tab is showing ended watchlist items
- **WHEN** the user types a search term
- **THEN** the list SHALL show only items whose title (or seller) matches the term
- **AND** the existing captured/not-captured filter SHALL continue to apply together with the search term

### Requirement: Selected-item trend chart

The Analytics tab SHALL show a chart above the item list, updated to the selected item's matched sales.

#### Scenario: User selects an item from the list

- **GIVEN** the Analytics tab item list is visible
- **WHEN** the user selects an item
- **THEN** the chart SHALL show every matched sale for that item's relisting group and currency
- **AND** any matched sale the user won SHALL be visually distinguished from the rest

#### Scenario: Selected item has no relisting group

- **GIVEN** the selected item has no computed relisting group
- **WHEN** the chart is built
- **THEN** the chart SHALL show its empty state rather than an error

### Requirement: Selected-item summary cards

The Analytics tab SHALL show summary cards for the selected item's matched sales: count, the user's own paid price with its date, average price, lowest price with its date, and highest price with its date.

#### Scenario: Selected item has matched sales

- **GIVEN** a selected item has one or more matched sales
- **WHEN** the summary cards are shown
- **THEN** they SHALL reflect exactly the same filtered, same-currency set of sales as the chart

#### Scenario: Selected item includes a won purchase

- **GIVEN** the selected item's matched sales include one or more purchases the user won
- **WHEN** the summary cards are shown
- **THEN** the "my price paid" card SHALL show the most recent won purchase's price and date
