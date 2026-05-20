## Why

The Purchases tab now gives a useful overview of paid prices, but the chart can be more legible and more record-oriented. The next step is to make the view feel more polished, improve selected-item navigation, and support deeper market context for a selected record.

When a purchased record is selected, the user wants to compare their paid price against recent eBay sales for the same record. This should be designed carefully because eBay's official sold-item data availability may be limited.

## What Changes

- Improve the all-purchases chart styling:
  - use calmer visual treatment and stronger hierarchy
  - draw horizontal grid lines at roughly `$20`/currency-equivalent increments where appropriate
  - consider thumbnail markers for selected/hovered purchases while avoiding clutter
- Fix selected-item scrolling so the highlighted purchase card is not hidden behind the bottom tab bar.
- Add a selected-record mode in Purchases:
  - selecting a purchase can show market sales history for that record
  - the top cards switch to selected-record comparisons: highest sold, lowest sold, median sold, and the user's paid price
  - the chart switches from all purchases to comparable sold history
  - the user can switch back to the all-purchases overview

## API/Data Constraints

- eBay Marketplace Insights `item_sales` is the official sold-items read API candidate.
- Current eBay documentation describes sold-item history as available up to 90 days in the past, not 12 months.
- A 12-month chart should therefore be treated as a target UX with phased data availability:
  - Phase 1: use official eBay sold history when available, likely 90 days.
  - Phase 2: extend to 12 months only if API access/data availability supports it, or if goggler starts accumulating observed market data over time.

## Out of Scope

- Scraping eBay web pages.
- Write-capable eBay account actions.
- Persisting a market-history database in this change.
- Guaranteeing 12 months of sold history before confirming source availability.

## Validation

- Unit tests cover chart scale/grid helpers and selected-item scroll offset behavior where practical.
- Unit/API tests cover selected-record history request shaping and response normalization once the data source is implemented.
- UI/build validation confirms both all-purchases mode and selected-record mode remain usable on mobile and desktop.
