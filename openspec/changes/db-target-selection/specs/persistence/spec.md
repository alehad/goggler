## ADDED Requirements

### Requirement: Database target is selectable at startup, defaulting to Neon

The system SHALL support selecting which configured database the app connects to via a startup-time environment variable, defaulting to the Neon-hosted database when unset.

#### Scenario: No target specified

- **GIVEN** `GOGGLER_DB_TARGET` is not set
- **WHEN** the app resolves its database connection
- **THEN** it SHALL use the Neon-hosted database (`NEON_DATABASE_URL`)

#### Scenario: Local target explicitly requested

- **GIVEN** `GOGGLER_DB_TARGET=local`
- **WHEN** the app resolves its database connection
- **THEN** it SHALL use the local database (`DATABASE_URL`), unchanged from prior behavior

#### Scenario: Unrecognized target value

- **GIVEN** `GOGGLER_DB_TARGET` is set to a value other than a known target
- **WHEN** the app resolves its database connection
- **THEN** it SHALL fail with a clear error naming the valid targets, rather than silently falling back to a default

#### Scenario: Target's underlying connection string is unset

- **GIVEN** a valid target is selected but its corresponding connection string environment variable is not set
- **WHEN** the app resolves its database connection
- **THEN** it SHALL behave as it already does when no database is configured (persistence unavailable), not throw
