## Why

Relisted items that are not already on the user's eBay watchlist should be easy to act on from goggler without making goggler a write-capable eBay client yet.

The lowest-risk workflow is to open the live eBay item page from the Home feed so the user can add the item to their watchlist on eBay directly. This preserves the current read-only API posture while still supporting the practical review flow.

## What Changes

- Add a usable `View on eBay` action for active relisting/watchlist rows that have a trusted eBay listing URL.
- Carry a sanitized eBay item URL through the buying-history/home-feed response model.
- Keep goggler read-only: no `AddToWatchList` API call, no new write OAuth scope, and no mutation of the user's eBay account from inside goggler.
- Keep the existing local `Add` affordance non-authoritative until a later write-capable watchlist change.

## Out of Scope

- Calling eBay Trading API `AddToWatchList`.
- Requesting broader write-capable OAuth permissions.
- Persisting user watchlist actions locally.
- Automated relisting discovery beyond the active relisting candidates already present in the feed.

## Validation

- Unit tests cover trusted eBay listing URL parsing and unsafe URL rejection.
- Home feed tests cover the `open_on_ebay` action only appearing with a usable eBay URL.
- UI tests/build verify the action renders as an external link without breaking the dashboard layout.
