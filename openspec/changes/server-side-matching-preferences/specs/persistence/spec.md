## ADDED Requirements

### Requirement: Matching preferences are persisted server-side per user

The system SHALL persist each user's matching preferences (`exactTitleMatch`, `criteriaText`) server-side, keyed by user id, rather than relying on any client to supply or remember them.

#### Scenario: Reading preferences for a user with none saved

- **GIVEN** a user has never saved matching preferences
- **WHEN** their preferences are read
- **THEN** the system SHALL return the default preferences without writing anything

#### Scenario: Saving preferences validates and bounds them

- **GIVEN** a save request for matching preferences
- **WHEN** the criteria text or title-match flag is invalid, oversized, or malformed
- **THEN** the system SHALL validate and bound the input the same way it already does for any matching-preferences input
- **AND** SHALL persist and return the bounded value, not the raw input

#### Scenario: Saved preferences are read back by every business route

- **GIVEN** a user has saved matching preferences
- **WHEN** any route that performs relisting matching, price history, chat, or search runs on behalf of that user
- **THEN** it SHALL use the persisted preferences
- **AND** SHALL NOT use any matching-preferences value supplied directly by the client in that request
