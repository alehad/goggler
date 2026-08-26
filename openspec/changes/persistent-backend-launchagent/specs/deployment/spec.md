## ADDED Requirements

### Requirement: The backend can run persistently on this Mac without Docker

The system SHALL support running the Next.js server persistently on the local machine via a `launchd` LaunchAgent, started at login and restarted automatically if the process exits, running a production build rather than dev mode.

#### Scenario: The server starts automatically at login

- **GIVEN** the LaunchAgent is installed and loaded
- **WHEN** the user logs in
- **THEN** the goggler server SHALL start automatically, with no manual `npm run dev`/`npm run start` needed

#### Scenario: The server restarts if it exits

- **GIVEN** the LaunchAgent is running the server
- **WHEN** the server process exits for any reason (crash, manually killed)
- **THEN** `launchd` SHALL restart it automatically within a few seconds

#### Scenario: The server runs a production build, not dev mode

- **GIVEN** the LaunchAgent's configured command
- **WHEN** it starts the server
- **THEN** it SHALL run `next start` against a `next build` output, not `next dev`
- **AND** `next dev` SHALL remain separately available, unaffected, for active development

#### Scenario: Server output is captured, not silently discarded

- **GIVEN** the server is running under the LaunchAgent
- **WHEN** it logs anything to stdout/stderr
- **THEN** that output SHALL be captured to a log file the user can inspect
- **AND** SHALL NOT be silently dropped the way an unmanaged background process's output would be

### Requirement: Tailscale connectivity persistence is a documented host preference, not app-managed

The system SHALL document enabling Tailscale's own "Open at Login" preference as the way Tailscale itself stays connected across reboots, rather than the app or this repo managing Tailscale's process lifecycle.

#### Scenario: Tailscale reconnects without app involvement

- **GIVEN** Tailscale's "Open at Login" preference is enabled
- **WHEN** the user logs in after a reboot
- **THEN** Tailscale SHALL reconnect on its own
- **AND** the previously-configured `tailscale serve` mapping SHALL still be active, requiring no command to be re-run
