# Capability: Venue Adapters

## ADDED Requirements

### Requirement: Live eBay watchlist and history source

The eBay adapter SHALL support a live read source that retrieves the connected user's eBay watchlist, lost buying history, and won buying history using the current session-scoped OAuth token.

#### Scenario: Fetch live watchlist and history

- **GIVEN** a signed-in local user has connected eBay in the current session
- **AND** the buying-history source is configured as `live`
- **WHEN** the app requests buying history
- **THEN** the adapter SHALL call eBay Trading API `GetMyeBayBuying` for `WatchList`, `LostList`, and `WonList`
- **AND** SHALL use the session-scoped OAuth token only in the `X-EBAY-API-IAF-TOKEN` header
- **AND** SHALL NOT persist eBay token values

#### Scenario: Preserve live watchlist order

- **GIVEN** eBay returns watchlist items in a specific order
- **WHEN** the adapter normalizes the live watchlist
- **THEN** the normalized watchlist rows SHALL preserve that response order as the modeled watchlist order

#### Scenario: Live source without eBay connection

- **GIVEN** the user has not connected eBay in the current session
- **AND** the buying-history source is configured as `live`
- **WHEN** the app requests buying history
- **THEN** the adapter SHALL require eBay reauthorization
- **AND** SHALL NOT call eBay

#### Scenario: Live eBay API failure

- **GIVEN** eBay returns an HTTP error, failure acknowledgement, or malformed XML
- **WHEN** the live source handles the response
- **THEN** it SHALL return a recoverable normalized error
- **AND** SHALL NOT expose OAuth token values, refresh token values, client secrets, or authorization codes

#### Scenario: Fixture source remains unchanged

- **GIVEN** the buying-history source is configured as `fixture`
- **WHEN** the app requests buying history
- **THEN** the adapter SHALL return fixture data without calling eBay
