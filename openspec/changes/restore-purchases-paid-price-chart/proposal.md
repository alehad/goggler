## Why

The Purchases tab should always provide the local paid-price view for won items. The selected-record marketplace-history mode can make the chart disappear or show unavailable data when eBay Marketplace Insights access is not approved.

The user wants the previously working graph of prices they paid for won items restored as the primary Purchases experience.

## What Changes

- Keep the won-item paid-price chart visible in Purchases regardless of Marketplace Insights availability.
- Selecting a chart point or purchase card highlights the corresponding won item without switching the chart to marketplace comparable-sales mode.
- Keep purchase analytics based only on authenticated buying-history `wonItems`.

## Out Of Scope

- Removing the marketplace-history API route.
- Implementing one-year marketplace sold-price history.
- Adding Marketplace Insights approval or alternate marketplace data providers.
