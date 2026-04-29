# Capability: User Accounts

## ADDED Requirements

### Requirement: Session-owned eBay connection

The system SHALL require a signed-in local user before starting or modifying an eBay account connection.

#### Scenario: Anonymous connection attempt

- **GIVEN** no local app user is signed in
- **WHEN** a request starts the eBay connection flow
- **THEN** the system SHALL reject the request or redirect the visitor to local sign-in

#### Scenario: Connected account ownership

- **GIVEN** a signed-in local app user completes eBay consent
- **WHEN** the system stores the connected eBay account
- **THEN** the connected account SHALL be associated with that local user

### Requirement: Session-only eBay token material

The system SHALL keep eBay token values scoped to the active server-side goggler session and SHALL NOT persist eBay token values at rest.

#### Scenario: Receive OAuth token values

- **GIVEN** the app receives eBay access and refresh tokens
- **WHEN** the system handles the OAuth callback
- **THEN** token values SHALL be stored only in server-side session state for the current goggler login
- **AND** token values SHALL NOT be written to the database
- **AND** token values SHALL NOT be returned to the browser UI

#### Scenario: End goggler session

- **GIVEN** a user has authenticated with eBay during the current goggler session
- **WHEN** the goggler session expires or the user signs out
- **THEN** the eBay token values SHALL no longer be available to the application
- **AND** the user SHALL be required to authenticate with eBay again during a later goggler session

#### Scenario: Log connection errors

- **GIVEN** an eBay OAuth or import request fails
- **WHEN** the system records or logs the failure
- **THEN** the recorded message SHALL exclude raw access tokens, refresh tokens, authorization codes, and OAuth callback query strings
