# Design: eBay buying-history foundation

## Overview

This change adds the first eBay buying-history adapter layer without starting a persistent import. It keeps eBay token handling aligned with the current session-only OAuth design while giving later import and UI work a stable contract to call.

## Trading API Request Boundary

`GetMyeBayBuying` is a Trading API XML call. The request builder should accept the current eBay config, a session-scoped access token, and a selected list kind:

- `LostList` for auctions the user bid on but did not win.
- `WonList` for auctions the user won.

The request SHALL:

- POST to the configured Trading API endpoint.
- Use eBay UK site id `3` by default.
- Send the session-scoped OAuth token in `X-EBAY-API-IAF-TOKEN`.
- Avoid placing token values in the XML body.
- Avoid legacy `RequesterCredentials` token XML for OAuth-backed calls.
- Include pagination controls so later import work can page through history.

## Response Normalization

The foundation parser should map representative XML into a small normalized shape that later persistence and UI code can consume:

- eBay item id.
- title.
- source list kind.
- current/final price when available.
- listing end time when available.
- seller user id when available.
- condition display name when available.

This parser is intentionally small and fixture-driven for now. Later real Sandbox data may expand fields or replace the lightweight XML extraction with a fuller XML parser if response complexity requires it.

## Mocked Relisting Scenario

Local fixtures should model the product question directly:

- 10 lost bid items.
- 7 won items.
- 4 won items share a relisting identity with earlier lost bid items.
- eBay item ids remain distinct between the lost and won listings.

The shared relisting identity is not assumed to come from eBay directly in this change. It is a local fixture field that lets future matching and filtering work express the intended user outcome: "show me lost bids only when I never later won that item."

## Error Handling

Adapter errors should be normalized into app-level errors that include status or eBay acknowledgement state where useful, but never include OAuth access tokens, client secrets, or raw sensitive request material.
