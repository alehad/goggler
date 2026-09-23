## MODIFIED Requirements

### Requirement: Selected-item trend chart

The Analytics tab SHALL show a chart above the item list, updated to the selected item's matched sales. Selecting an item SHALL scroll the chart into view at the top of the viewport, so the updated chart is visible without the user needing to scroll back up manually — regardless of how far down the item list the selection was made.

#### Scenario: User selects an item from the list

- **GIVEN** the Analytics tab item list is visible
- **WHEN** the user selects an item
- **THEN** the chart SHALL show every matched sale for that item's relisting group and currency
- **AND** any matched sale the user won SHALL be visually distinguished from the rest

#### Scenario: Selected item has no relisting group

- **GIVEN** the selected item has no computed relisting group
- **WHEN** the chart is built
- **THEN** the chart SHALL show its empty state rather than an error

#### Scenario: Selecting an item scrolls the chart into view

- **GIVEN** the user has scrolled down the Analytics item list, far enough that the chart is off-screen
- **WHEN** the user selects an item from the list
- **THEN** the page SHALL scroll so the chart panel is at the top of the viewport
