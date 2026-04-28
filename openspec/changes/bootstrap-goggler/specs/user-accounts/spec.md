# Capability: User Accounts

## ADDED Requirements

### Requirement: Local users

The system SHALL model app users even when the deployment is personal and single-operator.

#### Scenario: User-owned data

- **GIVEN** a signed-in user
- **WHEN** the user imports buying history, tracks an item, or reviews a candidate listing
- **THEN** the resulting records SHALL be associated with that user

### Requirement: Local sign-in

The system SHALL provide a local sign-in mechanism sufficient for switching which app user is viewing data.

#### Scenario: Switch visible account

- **GIVEN** more than one local user exists
- **WHEN** a different user signs in
- **THEN** the dashboard SHALL show data owned by that user

