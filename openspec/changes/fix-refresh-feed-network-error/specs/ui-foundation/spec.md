## MODIFIED Requirements

### Requirement: Unified Home action feed

The Home screen SHALL present a unified action feed that starts with the user's current eBay watchlist, then shows unresolved lost-bid history and goggler relisting candidates. A refresh attempt that fails at the network level (no HTTP response at all) SHALL NOT leave the feed stuck in a loading state indefinitely.

#### Scenario: Current watchlist first

- **GIVEN** a signed-in user has connected eBay in the current session
- **AND** fixture data contains current eBay watchlist items
- **WHEN** the user opens Home
- **THEN** the UI SHALL show current eBay watchlist items before non-watchlist relisting candidates
- **AND** SHALL preserve the modeled eBay watchlist ordering
- **AND** SHALL include watchlist items even when they are unrelated to prior lost bids

#### Scenario: Relisting candidate not on watchlist

- **GIVEN** a signed-in user has connected eBay in the current session
- **AND** fixture history contains a lost bid with an active relisting candidate
- **AND** the candidate is not on the user's modeled eBay watchlist
- **WHEN** the user opens Home
- **THEN** the UI SHALL show the candidate after the current watchlist section
- **AND** SHALL show the candidate as needing action
- **AND** SHALL expose an `Add to watchlist` affordance

#### Scenario: Relisting candidate already watched

- **GIVEN** a relisting candidate is already present in the user's modeled eBay watchlist
- **WHEN** the user opens Home
- **THEN** the UI SHALL tag the row as `On eBay watchlist`
- **AND** SHALL NOT present it as needing the same add-to-watchlist action

#### Scenario: Lost bid later resolved

- **GIVEN** a lost bid is linked to a later won relisting
- **WHEN** the user filters Home to resolved items
- **THEN** the UI SHALL show the item as `Eventually won`

#### Scenario: No eBay connection

- **GIVEN** the user has not connected eBay in the current session
- **WHEN** the user opens Home
- **THEN** the UI SHALL show a concise connection prompt instead of fixture feed rows

#### Scenario: Refresh fails before reaching the server

- **GIVEN** the user presses "Refresh feed"
- **AND** the request fails at the network level (no HTTP response — e.g. connection refused, offline, a dropped tunnel) rather than the server returning an error status
- **WHEN** the failure occurs
- **THEN** the UI SHALL show the previously-loaded feed if one exists, rather than a permanent loading indicator
- **AND** SHALL show a clear "could not reach the server" message if no previous feed exists
- **AND** SHALL NOT remain on the loading state indefinitely
