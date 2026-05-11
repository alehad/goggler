# Design: Home relisting watchlist UX

## Overview

Home should be the place where the user answers: "Which lost auctions need my attention now?"

Instead of separating history, watchlist, and relisting candidates into unrelated lists, Home should present a unified action feed. The first section should show the user's current eBay watchlist in the order eBay returns or displays it, including items unrelated to prior goggler bids. After that, Home should show relisting candidates that are not on the watchlist yet, followed by lower-priority lost-bid history states.

The initial implementation should remain fixture-backed so we can refine layout, filters, and action language before connecting real eBay watchlist reads or writes.

## Inputs

The Home feed should eventually combine:

- Lost bid history from `GetMyeBayBuying` `LostList`.
- Won history from `GetMyeBayBuying` `WonList`, used to identify lost bids that were later resolved.
- Active eBay watchlist items, preserving their eBay watchlist order.
- goggler relisting candidates discovered by matching active listings against lost bids.
- Local app decisions such as confirmed match, dismissed candidate, or manually tracked item.

For the fixture-backed version, extend local fixtures to model the same relationships without calling eBay:

- Lost bids from the existing 10-item fixture set.
- Won items from the existing 7-item fixture set.
- Active watchlist items, some tied to lost bids and some unrelated, with explicit display order.
- Relisting candidate items, some already on the watchlist and some not.

## Feed Semantics

Home should prioritize items by usefulness:

1. Current eBay watchlist items in eBay watchlist order, regardless of whether the user previously bid on related items.
2. Relisting candidates not currently on the user's eBay watchlist, so the user can decide whether to add them.
3. Lost bids with no current candidate, grouped as lower-priority unresolved history.
4. Recently resolved lost bids where the user later won a relisting.

Watchlist rows may still show goggler context when available. For example, a watched item can also be tagged as a relisting candidate if it matches a past lost bid, but it should remain in the watchlist-first section rather than being duplicated lower down.

Rows should make the source relationship visible without requiring the user to inspect raw history:

- Original lost bid item and price.
- Current candidate/watchlist listing title and price.
- Watchlist position or source ordering when the row is part of the watchlist-first section.
- Time remaining or active listing status when available.
- Match confidence or match reason when it is a goggler candidate.
- Seller and condition metadata when available.
- Whether the current listing is already on eBay watchlist.

## Tags

Use compact tags to explain why a row is present:

- `Lost bid`
- `Never won`
- `Eventually won`
- `Relisting candidate`
- `On eBay watchlist`
- `Not watched`
- `Confirmed`
- `Dismissed`
- `Added by goggler`

Tags are state indicators, not primary actions. Primary actions should remain explicit buttons.

## Actions

Fixture-backed Home should include these actions:

- `Add to watchlist` for relisting candidates not already watched.
- `Open on eBay` for active candidate/watchlist listings.
- `Confirm match` when a candidate looks correct.
- `Dismiss` when a candidate is not relevant.

In the first fixture-backed implementation, `Add to watchlist` should update only local fixture/client state or use a mocked server response. The UI should avoid implying that the real eBay account was modified.

When live mutation is implemented later, the app must confirm the correct eBay API endpoint, required OAuth scope, rate limits, and error behavior before enabling real watchlist updates.

## Filters

Home should include simple filters that keep the feed actionable:

- `Needs action`: relisting candidates not on the watchlist and not dismissed.
- `On watchlist`: current listings already watched on eBay, preserving eBay watchlist order.
- `Relistings`: all candidate relistings.
- `Never won`: unresolved lost bids.
- `Resolved`: lost bids later won through a relisting.

Filters should compose with search later, but this change only plans the primary status filters.

## Empty And Connection States

Before local sign-in or eBay connection, Home should show the same connection requirement as Watching and Purchases. Once connected, fixture-backed Home may show fixture data in development.

If no candidates exist, Home should explain that goggler has history but no current relisting candidates yet, and it should still show a way to inspect unresolved lost bids.

## Open Questions

- Which eBay API endpoint supports reading the authenticated user's active watchlist for the current developer app?
- Which endpoint, scope, and consent language are required to add an item to the user's eBay watchlist?
- Does eBay Sandbox support watchlist mutation reliably enough for our local flow?
- Should confirmed/dismissed decisions persist before the database-backed import layer exists, or remain session/local-state only?
- How exactly does eBay order watchlist items in the API response, and does that match the user-visible eBay app ordering?
