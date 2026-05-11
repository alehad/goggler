# Change: Fixture history UI

## Why

goggler now has eBay OAuth connection plumbing and a tested buying-history fixture set, but there is not yet a way to see that history in the running app. Building the full persistence layer first would force database/import decisions before the user experience has been exercised.

This change adds a development-only fixture history source so we can connect eBay through the real local/Sandbox flow, then render deterministic lost and won history in the UI for UX refinement.

## What Changes

- Add a configurable buying-history source with `fixture` and `live` modes.
- Allow fixture history only outside production.
- Add an authenticated history API route that requires local sign-in and an active session-scoped eBay connection.
- Serve the mocked 10 lost bid items and 7 won items in fixture mode.
- Show lost bid history and won history in the app instead of hardcoded page arrays.
- Add lost-bid filters for all lost bids, never won, and eventually won.

## Out Of Scope

- Database persistence.
- Real Trading API import paging from the UI.
- Storing import run summaries.
- Relisting search against active eBay listings.
- Production fixture/demo mode.

## Success Criteria

- A signed-in, eBay-connected local session can fetch fixture buying history.
- Anonymous or eBay-disconnected sessions cannot fetch fixture buying history.
- Fixture mode cannot be enabled in production.
- The app can render the 10 lost bids, 7 won items, 4 eventually won lost bids, and 6 never-won lost bids.
- Unit tests cover the source configuration and API route behavior.
