## Overview

This change should be implemented in two separable slices:

1. Purchases chart polish and selection ergonomics.
2. Selected-record market history mode.

The first slice is purely client-side and can ship quickly. The second depends on eBay sold-history access and should be implemented behind a graceful unavailable state if API access or lookback is limited.

## Chart Polish

Recommended approach:

- Keep simple dots for normal purchases.
- Use a larger thumbnail marker only for the selected point or hovered/focused point.
- Avoid using thumbnails for every plotted point by default because the chart will become visually noisy and overlapping as the purchase count grows.
- Add faint horizontal grid lines, initially at `$20` increments for USD data. For other currencies, use the same numeric increment unless the price range requires adaptive spacing.
- Keep vertical grid lines weekly for short ranges, but reduce visual weight so the chart reads as support rather than scaffolding.
- Preserve the 10% headroom above highest plotted price.

## Selected Card Scrolling

The bottom tab bar can cover a scrolled-to item. Selected-card scrolling should account for the fixed bottom navigation.

Implementation options:

- Preferred: add `scroll-margin-bottom` to purchase cards with enough space for the tab bar plus breathing room.
- Alternative: use manual `window.scrollTo` with card geometry and bottom inset.

The CSS option is simpler and less brittle.

## Selected-Record Mode

When the user selects a purchase card or chart point, Purchases can enter a selected-record mode.

Mode structure:

- Header control: `All purchases` / selected record title.
- Top cards:
  - Paid by me
  - Highest sold
  - Median sold
  - Lowest sold
- Chart:
  - sold records over the available lookback window
  - the user's purchase price shown as a reference line or highlighted point
- List:
  - comparable sold listings, if returned by API
  - current selected purchase card remains visible for context

Switching back to all-purchases mode should be a clear single action.

## Matching A Record To Sold History

Use the existing matching criteria as the first signal where possible.

Request inputs for the initial implementation:

- selected purchase title
- selected purchase item ID
- selected purchase image URL when useful
- extracted matching group/record code if available
- marketplace ID

The initial query should prefer precise record-code search strings (for example TBM/PAP-style criteria) and fall back to a sanitized title query.

## eBay Sold-History Source

The official candidate is the eBay Buy Marketplace Insights API. Documentation describes `item_sales` as retrieving sold items up to 90 days in the past.

Design implications:

- API route should expose `availableLookbackDays`.
- UI copy should say `Last 90 days` if that is what the source provides.
- The 12-month view should remain the target state but should not be shown as available unless the source actually provides it.
- If Marketplace Insights access is unavailable, return a typed unavailable response rather than failing the whole Purchases tab.

## Security

- Keep the data source read-only.
- Do not add write scopes.
- Avoid exposing OAuth tokens to the client.
- Sanitize and bound selected-record query strings.
- Continue using safe URL helpers for any returned item URLs and image URLs.
