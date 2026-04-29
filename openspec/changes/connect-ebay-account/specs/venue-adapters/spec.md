# Capability: Venue Adapters

## ADDED Requirements

### Requirement: eBay OAuth user consent

The eBay adapter SHALL connect a user's eBay account through eBay OAuth user consent.

#### Scenario: Start eBay connection

- **GIVEN** a signed-in local app user
- **WHEN** the user chooses to connect eBay
- **THEN** the system SHALL redirect the user to eBay's authorization endpoint with a signed state value

#### Scenario: Complete eBay connection

- **GIVEN** eBay redirects back with an authorization code and matching state
- **WHEN** the system exchanges the authorization code successfully
- **THEN** the system SHALL store eBay token values only in server-side session state
- **AND** SHALL update only non-secret persistent connection metadata when available
- **AND** the active session SHALL be usable for authenticated eBay adapter calls

#### Scenario: Invalid callback state

- **GIVEN** eBay redirects back with a missing or invalid state value
- **WHEN** the callback route handles the request
- **THEN** the system SHALL reject the callback
- **AND** SHALL NOT store token material

### Requirement: eBay session authorization

The eBay adapter SHALL require a valid session-scoped eBay access token before making authenticated eBay calls.

#### Scenario: Import with active eBay session

- **GIVEN** a user has authenticated with eBay during the current goggler session
- **WHEN** a buying-history import starts
- **THEN** the adapter SHALL use the session-scoped eBay access token for eBay buying-history APIs

#### Scenario: Import without active eBay session

- **GIVEN** a user has not authenticated with eBay during the current goggler session
- **WHEN** a buying-history import starts
- **THEN** the adapter SHALL require eBay reauthorization
- **AND** the import SHALL fail with a recoverable connection error

#### Scenario: Session-scoped token expired

- **GIVEN** the session-scoped eBay access token has expired
- **WHEN** the adapter needs authenticated eBay access
- **THEN** the adapter SHALL require eBay reauthorization unless a non-persisted session-scoped refresh is available
- **AND** SHALL NOT read a refresh token from persistent storage

### Requirement: eBay buying-history import

The eBay adapter SHALL import authenticated eBay UK won and not-won buying history for the connected user.

#### Scenario: Import won and not-won lists

- **GIVEN** a signed-in user has connected an eBay UK account
- **WHEN** the user runs a buying-history import
- **THEN** the adapter SHALL request the user's won and lost buying-history lists from eBay
- **AND** SHALL persist normalized won and not-won auction records owned by the local user

#### Scenario: Idempotent reimport

- **GIVEN** an imported eBay auction record already exists for the user
- **WHEN** a later import returns the same eBay item identity
- **THEN** the system SHALL update the existing record instead of creating a duplicate

#### Scenario: Import run summary

- **GIVEN** a buying-history import finishes
- **WHEN** the system records the import result
- **THEN** it SHALL store status, start time, finish time, imported counts, updated counts, skipped counts, and a recoverable error message when applicable
