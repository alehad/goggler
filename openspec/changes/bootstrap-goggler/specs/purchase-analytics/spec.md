# Capability: Purchase Analytics

## ADDED Requirements

### Requirement: Preserve won-item data

The system SHALL import and preserve won-item data even before purchase analytics views are implemented.

#### Scenario: Won item is imported

- **GIVEN** a won item exists in the connected user's buying history
- **WHEN** the buying history import runs
- **THEN** the system SHALL store the won item for that user

### Requirement: Future purchase price statistics

The system SHALL support future calculation of purchase price statistics from won items.

#### Scenario: Price statistics can be derived

- **GIVEN** won items with purchase prices are stored
- **WHEN** purchase analytics are implemented
- **THEN** the system SHALL be able to calculate highest, lowest, and median price paid

