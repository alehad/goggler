## Overview

Purchases should become a compact analytics surface backed by the existing `wonItems` response data. The view remains client-side: it derives stats and chart points from the already loaded buying-history response.

## Data Model

Use each won item from `history.wonItems`:

- `itemId` as the stable identity for chart selection and list highlighting.
- `currentPrice.value` as the paid price.
- `currentPrice.currency` for display, expected to be GBP for current eBay UK data.
- `endTime` as the purchase/won date for the horizontal chart axis.
- `title`, `sellerUserId`, `conditionDisplayName`, `imageUrl`, and `itemWebUrl` for the list card.

Items missing a usable price should be omitted from numeric stats and chart points. Items missing a usable date can still appear in the list, but should not be plotted.

## Stats

The top card row should show:

- average price paid, calculated as mean of won item prices with valid numeric values
- lowest price paid
- highest price paid

When no valid paid prices exist, show `-` rather than `£0.00` to avoid implying a zero-price purchase.

## Chart

The chart should be an inline SVG or equivalent lightweight client-rendered chart, avoiding a new charting dependency unless the implementation becomes meaningfully complex.

Behavior:

- horizontal axis maps valid `endTime` values from earliest to latest purchase date
- vertical axis maps valid paid prices from lowest to highest
- each plotted point is clickable/focusable and selects the corresponding item
- selected point has a stronger visual treatment
- chart handles single-point and same-price cases without divide-by-zero layout issues

## Won Item List

Below the chart, won items should use the same visual language as Home feed cards:

- thumbnail where available
- title, seller, condition, date
- paid price
- optional external eBay link when `itemWebUrl` is present

Selecting a chart point should highlight and scroll/anchor the corresponding list item if practical. A first implementation may highlight without automatic scrolling if keeping the layout simpler.

## Empty And Loading States

If buying history is unavailable, keep the existing shared empty state. If there are no won items, show the Purchases tab with empty stats and a concise empty panel in place of the chart/list.
