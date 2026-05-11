# Capability: UI Foundation

## ADDED Requirements

### Requirement: Unified Home action feed

The Home screen SHALL present a unified action feed that starts with the user's current eBay watchlist, then shows unresolved lost-bid history and goggler relisting candidates.

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

### Requirement: Home feed filters

The Home screen SHALL provide filters that focus the user on candidate and watchlist status.

#### Scenario: Needs action filter

- **GIVEN** the Home feed includes candidates not on the watchlist
- **WHEN** the user selects `Needs action`
- **THEN** the UI SHALL show relisting candidates that are not already watched and have not been dismissed

#### Scenario: On watchlist filter

- **GIVEN** the Home feed includes active watchlist items
- **WHEN** the user selects `On watchlist`
- **THEN** the UI SHALL show active listings already on the modeled eBay watchlist
- **AND** SHALL preserve the modeled eBay watchlist ordering
