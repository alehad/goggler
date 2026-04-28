# Capability: UI Foundation

## ADDED Requirements

### Requirement: App shell navigation

The system SHALL provide an app shell with persistent navigation for the first dashboard workflows.

#### Scenario: Switch app sections

- **GIVEN** the user is viewing the app
- **WHEN** the user selects Dashboard, Tracking, Won, or Account
- **THEN** the visible content SHALL change without leaving the app shell

### Requirement: Candidate relisting review cards

The dashboard SHALL present candidate relistings as reviewable cards.

#### Scenario: Review candidate context

- **GIVEN** unresolved candidate relistings exist
- **WHEN** the user views the Dashboard tab
- **THEN** each candidate SHALL show title, pricing context, time remaining, confidence, explanation signals, and review actions

### Requirement: Early purchase analytics view

The system SHALL include an early Won tab for validating future purchase analytics interactions.

#### Scenario: View won item summary

- **GIVEN** won-item data exists
- **WHEN** the user opens the Won tab
- **THEN** the app SHALL show highest, lowest, and median price summaries alongside won items

