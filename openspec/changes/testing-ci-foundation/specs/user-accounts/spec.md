# Capability: User Accounts

## ADDED Requirements

### Requirement: Auth behavior test coverage

The system SHALL include automated tests for local authentication and session-scoped eBay authorization behavior.

#### Scenario: Local session lifecycle

- **GIVEN** local authentication is implemented
- **WHEN** tests run
- **THEN** they SHALL cover session creation, lookup, expiry, and logout

#### Scenario: eBay OAuth state handling

- **GIVEN** eBay OAuth connection is implemented
- **WHEN** tests run
- **THEN** they SHALL cover valid, missing, expired, replayed, and tampered OAuth state values

#### Scenario: Session-only eBay token handling

- **GIVEN** eBay OAuth callback handling is implemented
- **WHEN** tests run
- **THEN** they SHALL verify eBay token values are stored only in server-side session state
- **AND** SHALL verify eBay token values are not persisted in database-backed models
- **AND** SHALL verify eBay token values are not returned to browser-visible responses
