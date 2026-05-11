# Tasks: eBay buying-history foundation

## 1. API Boundary

- [x] Confirm Trading API request shape for OAuth-backed `GetMyeBayBuying` calls.
- [x] Add Trading API endpoint configuration for Sandbox and production.
- [x] Implement `GetMyeBayBuying` request builder for `WonList` and `LostList`.
- [x] Keep session-scoped OAuth token material in request headers only.

## 2. Response Normalization

- [x] Add Trading API page fetch helper.
- [x] Parse representative `GetMyeBayBuying` XML responses.
- [x] Normalize eBay item fields into an internal buying-history item shape.
- [x] Normalize HTTP and eBay acknowledgement failures without leaking token values.

## 3. Mocked Buying-History Scenario

- [x] Add 10 mocked lost bid items.
- [x] Add 7 mocked won items.
- [x] Mark 4 won items as relistings of earlier lost bid items.
- [x] Add helper coverage for lost items eventually won vs. never won.

## 4. Verification

- [x] Add unit tests for request headers, body, and pagination controls.
- [x] Add unit tests for XML parsing and fetch behavior.
- [x] Add unit tests for the 10 lost / 7 won / 4 relisted fixture shape.
- [x] Run full unit test suite.
