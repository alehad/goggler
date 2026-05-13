# Change: Live eBay watchlist history source

## Why

goggler currently renders a useful watchlist-first Home feed from deterministic fixture data after the user signs in locally and connects eBay. The next step is to prove that the same UI contract can be populated from live eBay Sandbox data using the session-scoped OAuth token.

This should happen before production eBay traffic or real watchlist mutation. The goal is to read live authenticated eBay buying/watchlist data safely, normalize it into the existing feed shape, and keep fixture mode available for UX work and tests.

## What Changes

- Extend the Trading API `GetMyeBayBuying` request support to include `WatchList` in addition to `LostList` and `WonList`.
- Add a live history-source implementation for `GOGGLER_EBAY_HISTORY_SOURCE=live`.
- Fetch Sandbox `WatchList`, `LostList`, and `WonList` using the current session-scoped eBay OAuth token.
- Page through live lists with explicit safety limits.
- Normalize live watchlist/lost/won responses into the existing Home feed input model.
- Keep fixture mode as the default local development source unless explicitly switched to `live`.
- Add tests with mocked eBay XML responses; do not require live eBay network calls in the automated suite.

## Out Of Scope

- Production eBay traffic.
- Real `AddToWatchList` mutation.
- Removing items from the eBay watchlist.
- Persisting imported records or import run summaries.
- Background imports after logout.
- Storing eBay access tokens or refresh tokens at rest.
- Matching active listings beyond what is directly available from the user's watchlist and buying-history data.

## Success Criteria

- The authenticated history route can return live-source data from mocked `GetMyeBayBuying` `WatchList`, `LostList`, and `WonList` responses.
- Live source calls use only the session-scoped OAuth token and never persist or expose token values.
- The Home feed contract remains stable for the UI.
- Fixture source behavior remains unchanged.
- Manual Sandbox verification can be run through ngrok with `GOGGLER_EBAY_HISTORY_SOURCE=live`.
- Production environment remains configured as `live` by default, but production use is not exercised until explicitly approved later.
