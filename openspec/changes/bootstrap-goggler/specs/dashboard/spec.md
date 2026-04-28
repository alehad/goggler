# Capability: Dashboard

## ADDED Requirements

### Requirement: Dashboard-first workflow

The system SHALL provide an in-app dashboard for the first user workflow.

#### Scenario: Review candidate relistings

- **GIVEN** candidate relistings exist for tracked items
- **WHEN** the user opens the dashboard
- **THEN** the dashboard SHALL show unresolved candidates with their confidence signals

### Requirement: eBay connection status

The dashboard SHALL show whether the signed-in user has connected an eBay account.

#### Scenario: eBay account not connected

- **GIVEN** the signed-in user has not connected an eBay account
- **WHEN** the user opens the dashboard
- **THEN** the dashboard SHALL make the disconnected state visible

### Requirement: Import status

The dashboard SHALL show buying-history import status for the signed-in user.

#### Scenario: Import has completed

- **GIVEN** a buying-history import has completed
- **WHEN** the user opens the dashboard
- **THEN** the dashboard SHALL show when the import last completed and whether it succeeded

