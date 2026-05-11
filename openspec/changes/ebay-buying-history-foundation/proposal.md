# Change: eBay buying-history foundation

## Why

goggler can now connect a local session to eBay through OAuth, but the app still needs a safe, testable boundary for reading eBay buying history before we wire that into persistence or UI import flows.

The next useful slice is to prove the eBay Trading API request shape, parse representative `GetMyeBayBuying` responses, and establish deterministic local fixtures for the product scenario where a user lost an auction, then won a relisted copy of the same item weeks later.

## What Changes

- Add a Trading API endpoint to eBay configuration for Sandbox and production.
- Add a `GetMyeBayBuying` request builder for `LostList` and `WonList` using the session-scoped OAuth token in `X-EBAY-API-IAF-TOKEN`.
- Parse representative Trading API XML responses into normalized buying-history item records.
- Normalize adapter failures without exposing token values.
- Add local mocked buying-history fixtures with 10 lost bid items and 7 won items.
- Mark 4 of the won items as relistings of earlier lost bid items, so future filtering can distinguish lost items that were eventually won from lost items never won.

## Out Of Scope

- Calling eBay from the UI.
- Paging through every won/lost history page.
- Persisting imported auction records.
- Storing import run summaries.
- Building the dashboard filters that consume the relisting relationship.
- Adding real eBay Sandbox fixture data from the developer account.

## Success Criteria

- Tests prove Trading API requests use the UK site id and place OAuth token material only in headers.
- Tests prove `WonList` and `LostList` requests can be built independently.
- Tests prove representative XML responses parse into normalized item records.
- Tests prove API and HTTP failures are normalized without leaking token values.
- Tests prove the mocked local scenario contains 10 lost bid items, 7 won items, 4 relisted wins, and 6 lost items that were never won.
