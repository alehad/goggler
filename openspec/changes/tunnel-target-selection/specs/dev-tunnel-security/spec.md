## ADDED Requirements

### Requirement: Trusted tunnel host is selectable at startup, defaulting to Tailscale, matched exactly

The system SHALL support selecting which tunnel mechanism's exact public hostname is trusted for the eBay OAuth callback redirect via a startup-time environment variable, defaulting to Tailscale Funnel when unset. The trusted hostname for each target SHALL be matched exactly, not by suffix, since both `*.ts.net` and `*.ngrok-free.dev` are shared public suffixes operated by their respective providers and not exclusively controlled by this app's deployment.

#### Scenario: No target specified

- **GIVEN** `GOGGLER_TUNNEL_TARGET` is not set
- **AND** `GOGGLER_TAILSCALE_HOSTNAME` is set to this deployment's Tailscale Funnel hostname
- **AND** a request arrives with a forwarded host exactly equal to that hostname and an HTTPS forwarded proto
- **WHEN** the app resolves the public origin for the post-OAuth redirect
- **THEN** it SHALL trust and use that forwarded origin

#### Scenario: Ngrok target explicitly requested

- **GIVEN** `GOGGLER_TUNNEL_TARGET=ngrok`
- **AND** `GOGGLER_NGROK_HOSTNAME` is set to this deployment's reserved ngrok hostname
- **AND** a request arrives with a forwarded host exactly equal to that hostname and an HTTPS forwarded proto
- **WHEN** the app resolves the public origin for the post-OAuth redirect
- **THEN** it SHALL trust and use that forwarded origin

#### Scenario: A different host under the same shared suffix is not trusted

- **GIVEN** `GOGGLER_TUNNEL_TARGET` is unset (defaulting to `tailscale`)
- **AND** `GOGGLER_TAILSCALE_HOSTNAME` is set to this deployment's own Tailscale Funnel hostname
- **AND** a request arrives with a forwarded host that also ends in `.ts.net` but does not exactly match the configured hostname
- **WHEN** the app resolves the public origin for the post-OAuth redirect
- **THEN** it SHALL NOT trust that forwarded host
- **AND** it SHALL fall back to the request's own origin, unchanged from today's behavior for untrusted hosts

#### Scenario: Non-selected target's host is not trusted

- **GIVEN** `GOGGLER_TUNNEL_TARGET` is unset (defaulting to `tailscale`)
- **AND** a request arrives with a forwarded host matching this deployment's configured ngrok hostname
- **WHEN** the app resolves the public origin for the post-OAuth redirect
- **THEN** it SHALL NOT trust that forwarded host, since `ngrok` is not the selected target

#### Scenario: Unrecognized target value

- **GIVEN** `GOGGLER_TUNNEL_TARGET` is set to a value other than a known target
- **WHEN** the app resolves the public origin
- **THEN** it SHALL fail with a clear error naming the valid targets, rather than silently trusting nothing or falling back to a default

#### Scenario: Localhost and explicitly configured origins remain trusted

- **GIVEN** any value of `GOGGLER_TUNNEL_TARGET`
- **WHEN** a request's forwarded origin is `localhost` (any port) or is listed in `GOGGLER_ALLOWED_PUBLIC_ORIGINS`
- **THEN** it SHALL be trusted regardless of the selected tunnel target
