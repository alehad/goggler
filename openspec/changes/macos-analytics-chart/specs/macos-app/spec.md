## ADDED Requirements

### Requirement: Analytics tab shows a matched-sales price chart

When an item is selected in the Analytics tab's list, the tab SHALL fetch and display a chart of matched-sale prices over time for that item, matching the web app's Analytics chart behavior.

#### Scenario: Selecting an item shows its matched-sales chart

- **GIVEN** an Analytics-tab item with a `relistingGroupId` and a known price currency
- **WHEN** the user selects it
- **THEN** the app SHALL fetch matched sales for that item's relisting group and currency
- **AND** SHALL plot each matched sale as a point positioned by date and price
- **AND** SHALL visually distinguish sales the user won from sales they did not

#### Scenario: Tapping a chart point selects the corresponding item

- **GIVEN** the chart is showing matched-sale points
- **WHEN** the user taps a point
- **THEN** the item corresponding to that point SHALL become the selected item, same as tapping its row in the list

#### Scenario: Selecting an item scrolls the chart into view

- **GIVEN** the chart panel is not currently visible on screen
- **WHEN** the user selects an item
- **THEN** the view SHALL scroll so the chart panel becomes visible

#### Scenario: No item is selected

- **GIVEN** no item is currently selected
- **THEN** the chart SHALL show a message prompting the user to select an item, rather than an empty or broken chart

#### Scenario: Matched sales are loading

- **GIVEN** an item was just selected and its matched sales are still being fetched
- **THEN** the chart SHALL show a loading message

#### Scenario: Selected item has no matchable data

- **GIVEN** the selected item has no `relistingGroupId` or no known price currency
- **THEN** the chart SHALL show a message explaining the item doesn't have enough data to match other sales, without issuing a fetch

#### Scenario: Selected item has no matched sales

- **GIVEN** the selected item's matched-sales fetch completes successfully with zero results
- **THEN** the chart SHALL show a message indicating no matched sales were found

#### Scenario: Metrics summarize the matched sales

- **GIVEN** matched sales were fetched successfully and at least one sale was returned
- **THEN** the view SHALL show the sales count, the user's own price paid, the average, lowest, and highest matched prices
