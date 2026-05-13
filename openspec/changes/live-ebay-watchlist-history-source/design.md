# Design: Live eBay watchlist history source

## Overview

The current app has two important pieces:

- A real local/eBay OAuth connection flow with session-scoped token storage.
- A fixture-backed history API that returns lost bids, won items, watchlist rows, and Home feed rows.

This change adds the first live read path behind the same history API contract. When `GOGGLER_EBAY_HISTORY_SOURCE=live`, the server should use the active session-scoped eBay OAuth token to call Trading API `GetMyeBayBuying` for the authenticated user's `WatchList`, `LostList`, and `WonList`.

Live reads should be proven against Sandbox first. Automated tests should use mocked eBay XML responses.

## eBay API Direction

Use eBay Trading API `GetMyeBayBuying` because it can retrieve authenticated My eBay buying data, including:

- `WatchList`: active watched items.
- `LostList`: ended items the user did not win.
- `WonList`: ended items the user won.

OAuth-backed Trading API calls should continue to send the session-scoped user token in the `X-EBAY-API-IAF-TOKEN` header. Token material must not be placed in XML request bodies, logs, browser responses, or persistent storage.

`AddToWatchList` is intentionally out of scope. It should be investigated and implemented separately after endpoint, OAuth scope, Sandbox behavior, and user-facing consent/error copy are confirmed.

## Source Selection

`GOGGLER_EBAY_HISTORY_SOURCE` keeps the same values:

- `fixture`: deterministic fixture data.
- `live`: live eBay read path.

Fixture mode should remain the default outside production so UX work is stable. Production defaults to `live`, but production calls should not be exercised as part of this change.

## Request Shape

Extend the existing Trading API request builder to support:

- `WatchList`
- `LostList`
- `WonList`

Each request should include:

- `X-EBAY-API-CALL-NAME: GetMyeBayBuying`
- `X-EBAY-API-SITEID: 3` by default for eBay UK.
- `X-EBAY-API-IAF-TOKEN: <session access token>`
- XML body with the selected list container and pagination controls.

The implementation may fetch each list separately at first. Combining multiple containers in one call can be considered later after the parsing and paging behavior is stable.

## Paging And Safety Limits

Live reads must use explicit paging controls:

- Default entries per page should stay small enough for local iteration.
- Each list should have a maximum page safety limit.
- If eBay reports more pages than the safety limit, return the pages fetched and include a recoverable truncation signal in server-side result metadata.

The first UI response can omit a visible warning if the fixture-shaped row counts are small, but route/service code should preserve enough state to expose such a warning later.

## Normalization

The live source should normalize eBay data into the existing route response contract used by Home, Watching, and Purchases:

- `lostItems`
- `wonItems`
- `watchlistItems`
- `relistingCandidates`
- `homeFeed`
- aggregate `counts`

For the first live version:

- Watchlist rows should come directly from `WatchList`, preserving eBay response order as the modeled watchlist order.
- Lost and won rows should come from `LostList` and `WonList`.
- Relisting candidate detection may remain minimal. If an active watchlist item can be tied to a lost bid by a direct fixture/test relation or exact normalized title match, tag it as a relisting candidate; otherwise show it as a normal watchlist row.
- Non-watchlist relisting candidates can remain empty until active search/matching is implemented.

## Error Handling

Live source failures should be recoverable and non-secret:

- Missing local session: `local_auth_required`.
- Missing/expired eBay session token: `ebay_reauth_required`.
- eBay HTTP failure or Trading API failure acknowledgement: normalized live-source error.
- XML response missing expected containers: normalized malformed-response error.

Error messages must not include access tokens, refresh tokens, client secrets, authorization codes, or raw request headers.

## Manual Sandbox Verification

Manual verification should use ngrok because eBay OAuth callbacks require HTTPS:

1. Set `GOGGLER_EBAY_HISTORY_SOURCE=live` locally.
2. Start `npm run dev`.
3. Ensure ngrok forwards to `localhost:3000` and the eBay Sandbox RuName callback matches the ngrok URL.
4. Sign into goggler locally.
5. Connect eBay using the Sandbox buyer user.
6. Open Home, Watching, and Purchases.
7. Confirm the app handles empty or sparse Sandbox lists gracefully.

## Open Questions

- Does Sandbox buyer watchlist ordering from `GetMyeBayBuying` match the user-visible eBay web/app ordering?
- Which response fields are consistently present in Sandbox `WatchList` items?
- Should the first live source perform exact title matching between watchlist and lost items, or wait for the later matching feature?
- What is the right user-facing message when live Sandbox history is empty?
