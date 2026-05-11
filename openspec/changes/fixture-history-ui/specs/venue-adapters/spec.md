# Capability: Venue Adapters

## ADDED Requirements

### Requirement: Fixture buying-history source

The eBay adapter SHALL support a development-only fixture buying-history source for local UX testing.

#### Scenario: Fixture source after eBay connection

- **GIVEN** a signed-in local user has an active session-scoped eBay connection
- **AND** the buying-history source is configured as `fixture`
- **WHEN** the app requests buying history
- **THEN** the system SHALL return the local fixture lost and won item data
- **AND** SHALL NOT call eBay Trading API

#### Scenario: Fixture source without eBay connection

- **GIVEN** a signed-in local user has not connected eBay in the current session
- **WHEN** the app requests buying history
- **THEN** the system SHALL reject the request with a recoverable reauthorization requirement

#### Scenario: Fixture source in production

- **GIVEN** the runtime environment is production
- **AND** the buying-history source is configured as `fixture`
- **WHEN** the app requests buying history
- **THEN** the system SHALL reject the request
- **AND** SHALL NOT return fixture records

#### Scenario: Live source placeholder

- **GIVEN** the buying-history source is configured as `live`
- **WHEN** the app requests buying history before live imports are implemented
- **THEN** the system SHALL return a clear not-implemented response
