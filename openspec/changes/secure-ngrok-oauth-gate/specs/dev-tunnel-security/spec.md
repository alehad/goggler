# Capability: Development Tunnel Security

## ADDED Requirements

### Requirement: OAuth-gated development tunnel

The project SHALL provide a documented ngrok Traffic Policy for local HTTPS testing that requires an OAuth identity provider before public tunnel traffic reaches the local app.

#### Scenario: Anonymous tunnel visitor

- **GIVEN** the local app is exposed through the documented ngrok OAuth policy
- **WHEN** an anonymous browser requests the ngrok URL
- **THEN** ngrok SHALL require OAuth authentication before forwarding the request to the app

#### Scenario: Authenticated tunnel user starts eBay OAuth

- **GIVEN** the browser has an authenticated ngrok OAuth session
- **AND** the user has started eBay OAuth from goggler
- **WHEN** eBay redirects the browser to `/api/auth/ebay/callback` with `code` and `state`
- **THEN** the request SHALL reach goggler with the eBay callback parameters preserved
- **AND** goggler SHALL continue to validate its signed eBay OAuth state before exchanging the code

#### Scenario: Callback preservation fallback

- **GIVEN** full tunnel OAuth gating fails to preserve eBay callback parameters during manual testing
- **WHEN** the fallback tunnel policy is used
- **THEN** the app UI SHALL remain protected by ngrok OAuth
- **AND** `/api/auth/ebay/callback` MAY be allowed through the tunnel without ngrok OAuth
- **AND** the callback route SHALL still rely on goggler's signed state, replay protection, and session-scoped token handling

#### Scenario: Fallback policy governance

- **GIVEN** a callback-bypass fallback policy exists
- **WHEN** a developer reviews the policy
- **THEN** the policy SHALL document that the bypass is limited to `/api/auth/ebay/callback`
- **AND** it SHALL document the app-side protections that make the callback route safe to expose during local development
- **AND** it SHALL state that the fallback is used only when full tunnel OAuth breaks callback parameter preservation
