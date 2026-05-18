## Why

The Purchases tab currently lists won items with only basic summary metrics. It should help the user understand buying patterns at a glance: average paid price, lowest/highest paid price, when purchases happened, and which list item corresponds to a point in the price history.

## What Changes

- Replace the current Purchases summary with three purchase analytics cards:
  - average price paid
  - lowest price paid
  - highest price paid
- Add a purchase scatter plot with purchase date on the horizontal axis and paid price on the vertical axis.
- Plot each won item as an interactive dot.
- When a dot is selected, highlight the corresponding won item in the list below.
- Render won items below the chart using the same compact item-card format as the Home feed where possible.

## Out of Scope

- Persisting chart selections across sessions.
- Server-side aggregation or new eBay API calls.
- Filtering purchases by date range or category.
- Comparing purchase prices against current market listings.
- Exporting chart data.

## Validation

- Unit tests cover purchase stats and chart point preparation.
- UI/build validation covers empty purchase states and selected-point/list highlighting behavior.
- Existing eBay live/fixture history route contracts remain unchanged.
