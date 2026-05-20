## Why

The Home screen has a prominent search field, but it does not currently search eBay. The user needs to search live eBay listings from goggler while still seeing whether returned listings are already on their eBay watchlist, are likely relistings of records they did not win, or relate to won/not-won history.

## What Changes

- Make the top search field execute a live eBay Browse search from the Home screen.
- Add a Search filter tab immediately before On watchlist.
- When a search is executed, switch Home into Search results mode.
- Fetch live eBay listings server-side, using eBay app credentials without exposing tokens to the browser.
- Cross-tag live results against loaded goggler state so results show On watchlist, Relisting candidate, Never won, Won, and related status labels when applicable.
- Provide an empty search-results state when eBay returns no live listings.

## Out Of Scope

- Persisting search history.
- Server-side search indexing.
