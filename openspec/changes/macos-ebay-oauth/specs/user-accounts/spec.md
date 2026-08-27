## ADDED Requirements

### Requirement: A session's token can be rotated without losing the session

The system SHALL support minting a fresh raw session token for an existing, still-valid session, invalidating the previous token, without creating a new session or losing any state (including a held eBay authorization) already attached to that session's ID.

#### Scenario: Reissuing a token for a valid session

- **GIVEN** an existing, unexpired session
- **WHEN** its token is reissued
- **THEN** a new raw token SHALL be returned
- **AND** the previous token SHALL no longer authenticate that session
- **AND** any eBay authorization already attached to that session's ID SHALL remain attached and unaffected

#### Scenario: Reissuing a token for an unknown or expired session

- **GIVEN** a session ID that does not exist, or has expired
- **WHEN** a token reissue is attempted
- **THEN** no token SHALL be returned

### Requirement: The eBay OAuth callback can redirect to a native app instead of the web root

The OAuth start route SHALL accept an explicit marker indicating the flow was initiated by a native client, threaded through the signed OAuth state; the callback route SHALL redirect to a fixed custom URL scheme rather than the web root when that marker is present, carrying the outcome and, on success, a freshly-issued session token.

#### Scenario: A native-flagged flow completes successfully

- **GIVEN** `/api/auth/ebay/start` was called with the native marker
- **WHEN** the OAuth flow completes successfully
- **THEN** the callback SHALL redirect to the fixed custom URL scheme with a success indicator and a newly-issued token for the session the authorization was attached to
- **AND** SHALL NOT redirect to the web root

#### Scenario: A native-flagged flow fails

- **GIVEN** `/api/auth/ebay/start` was called with the native marker
- **WHEN** the OAuth flow fails at any validated stage (invalid state, replayed state, missing local session, token exchange failure, or eBay itself returning an error)
- **THEN** the callback SHALL redirect to the fixed custom URL scheme with an error indicator
- **AND** SHALL NOT include a session token

#### Scenario: A web flow is unaffected

- **GIVEN** `/api/auth/ebay/start` was called without the native marker
- **WHEN** the OAuth flow completes, successfully or not
- **THEN** the callback SHALL redirect to the web root exactly as it does today
- **AND** no custom-scheme redirect or reissued token SHALL be involved
