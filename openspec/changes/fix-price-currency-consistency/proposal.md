# Change: Fix price currency consistency

## Why

Prices shown across the Home, Watching, and Won tabs mix eBay's actual listing currency (e.g. $) with a GBP amount, and this keeps resurfacing despite repeated fixes. Live investigation against Production eBay (see debug capture in this change's history) found the real mechanism:

Our own code tells eBay's APIs which marketplace/site to respond for (`X-EBAY-C-MARKETPLACE-ID: EBAY_GB` for the Browse API, `X-EBAY-API-SITEID: 3` for the Trading API). eBay honors that by returning GBP as the *primary* price for both endpoints — and, when the listing's real currency differs, usually also includes the true native price as secondary metadata:

- Trading API (`GetMyeBayBuying`): a sibling `ConvertedCurrentPrice` (GBP) next to `CurrentPrice` (native), when both are returned.
- Browse API (`item_summary/search`, `get_item_by_legacy_id`): `convertedFromValue`/`convertedFromCurrency` fields on the `price` object, when a conversion happened.

Our code never reads the native-currency metadata — `browse-client.ts`'s `moneyValue()` only reads `price.value`/`price.currency` (the converted GBP figure), and the same defect exists in `marketplace-insights-client.ts`. Confirmed against a real listing (`MASARU IMADA GREEN CATERPILLAR`, itemId `366519294132`, verified USD-listed by the user directly on eBay): Browse API's `get_item_by_legacy_id` returned `price: { value: 130.62, currency: GBP, convertedFromValue: 174.50, convertedFromCurrency: USD }` — eBay is handing us the true native price and we are discarding it.

Separately, `GetMyeBayBuying`'s watchlist data is not a reliable source for native currency once an item has real bid activity: the same Green Caterpillar item's Trading API response contained only `<CurrentPrice currencyID="GBP">130.42</CurrentPrice>` with **no** `ConvertedCurrentPrice` sibling at all — the Trading API gives us no way to recover the native currency for that item. The Browse API per-item lookup is the only endpoint that reliably discloses it in both cases (bid-active or not), so it becomes the authoritative source for "what currency is this item currently listed in."

A prior fix (`lost-bid-price-currency-detail`) already dealt with a related "force GBP" fallback for lost-list rows; the watchlist path had its own independent copy of a similar mistake (`{ value: 0, currency: "GBP" }` when `CurrentPrice` didn't parse at all), which is part of why this class of bug keeps resurfacing — there's no single place enforcing "never show a converted or fabricated currency."

Separately from the currency bug: the Won tab's "Average paid / Lowest paid / Highest paid" cards (`buildPurchaseStats` in `src/ebay/purchase-analytics.ts`) aggregate raw price across every won item regardless of currency *or* what the item actually is (a phone case vs. a laptop), which is not a meaningful figure at all.

## What Changes

- `browse-client.ts` (`moneyValue`) and the Search tab / relisting-discovery results it powers: prefer `convertedFromValue`/`convertedFromCurrency` over `price.value`/`price.currency` (and the same for `currentBidPrice`) whenever eBay includes them, so cross-border listings show their true native price instead of a silently-converted GBP figure.
- Add a Browse API per-item lookup (`get_item_by_legacy_id`) used as the authoritative price/currency source for active watchlist rows, replacing reliance on `GetMyeBayBuying`'s `CurrentPrice`, which cannot reliably disclose native currency once an item has bid activity. Falls back to the Trading API's parsed price if the Browse lookup fails for a given item, and to "unavailable" (no fabricated currency) if neither source has a price.
- Remove the `{ value: 0, currency: "GBP" }} ` fallback in `toWatchlistItem` — no code path fabricates a price/currency anymore.
- Remove the Average paid / Lowest paid / Highest paid metric cards from the Won tab, and the `buildPurchaseStats` aggregation behind them. The purchase price chart and per-item cards already show each item's own price in its own currency and are unaffected.
- No currency conversion is introduced anywhere; every displayed amount continues to be exactly the currency eBay says the item is natively listed in.

## Out Of Scope

- Won/lost (historical, ended) item prices from `GetOrders`/`GetMyeBayBuying`. Browse API's item lookup generally only serves active listings, so it cannot cross-check ended transactions the way it can for the active watchlist. This is a known residual risk (the same silent-conversion behavior may affect historical prices too) but is a separate, larger investigation — out of scope for this fix.
- `marketplace-insights-client.ts`'s `buildMarketHistoryStats` and its `moneyValue()` (same latent defect as `browse-client.ts`). Not currently called from the UI (`/api/ebay/market-history` has no frontend caller) — fixing unreachable code is out of scope for this bug fix.
- Currency conversion or FX rates.
- Consolidating the three independent eBay API money-parsing implementations into one shared utility. Worth doing to prevent this class of bug recurring a third time, but a larger refactor than this bug fix needs.

## Success Criteria

- A live watchlist item verified as USD-listed on eBay (e.g. the Green Caterpillar item) displays in USD in goggler, not GBP.
- Search tab and relisting-candidate results show a cross-border listing's native currency, not a silently-converted GBP figure.
- A live watchlist item that eBay returns without a parseable price from either source never displays as "£0.00"; it displays as unavailable.
- The Won tab no longer shows Average paid / Lowest paid / Highest paid cards.
- Regression tests cover: a Browse API response with `convertedFromValue`/`convertedFromCurrency`, a watchlist item where Trading API has no parseable price, and a watchlist item where the Browse API lookup fails (Trading API price used as fallback).
