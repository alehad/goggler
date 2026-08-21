## ADDED Requirements

### Requirement: The eBay OAuth callback is the only path publicly reachable when using Tailscale

When the Tailscale tunnel target is used, the system SHALL be configured so that only the eBay OAuth callback path is reachable from outside the tailnet; the rest of the app SHALL remain reachable only to tailnet members.

#### Scenario: Primary app origin is tailnet-only

- **GIVEN** the app is served via Tailscale Serve on its primary port with no Funnel enabled for that port
- **WHEN** a request for the app root arrives from within the tailnet
- **THEN** it SHALL be served normally

#### Scenario: Callback path is publicly reachable on a separate port

- **GIVEN** the eBay OAuth callback path is registered via Tailscale Funnel on a separate port from the primary app origin
- **WHEN** an anonymous request arrives at that path on the funnel port
- **THEN** it SHALL reach the callback route handler and receive an application-level response (not a platform-level 404)

#### Scenario: No other path is reachable on the funnel port

- **GIVEN** only the callback path is registered on the funnel port
- **WHEN** a request arrives at any other path on the funnel port
- **THEN** it SHALL NOT reach the application
- **AND** it SHALL receive a 404 with no handler registered

#### Scenario: Post-login redirect lands on the primary origin, not the funnel port

- **GIVEN** the eBay OAuth callback completes (success or failure) while reached via the funnel port
- **WHEN** the app redirects the user's browser back into the app
- **THEN** the redirect target SHALL be the primary tailnet-trusted origin, not the origin the callback request itself arrived through
