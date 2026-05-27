# Design: Restore Purchases Paid-Price Chart

Purchases should return to a simple local analytics surface:

- summary metrics from `buildPurchaseAnalytics(history.wonItems)`
- SVG chart plotting won items by purchase date and price paid
- won-item cards below the chart
- point/card selection highlights and scrolls the matching won item

Selecting a purchase should no longer trigger `/api/ebay/market-history` or switch the chart into comparable-sales mode. This keeps the feature independent from Marketplace Insights access.

The existing `PurchaseChart` and `PurchaseCard` components can remain. The Purchases tab should remove selected-market state and use the all-purchases analytics path unconditionally.
