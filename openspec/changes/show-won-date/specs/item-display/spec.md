# item-display Spec Delta

## ADDED Requirements

### Requirement: Won-item date metadata

The system SHALL display the available won date alongside condition and seller metadata for won-item rows.

#### Scenario: Won item has a valid timestamp

- **GIVEN** a won item has a valid normalized won timestamp
- **WHEN** the item is shown in Home or Purchases
- **THEN** the metadata SHALL include a compact absolute `won: <date>` value

#### Scenario: Won item has no valid timestamp

- **GIVEN** a won item has no timestamp or an invalid timestamp
- **WHEN** the item is shown
- **THEN** the metadata SHALL omit the won-date value
- **AND** SHALL continue showing available condition and seller metadata

#### Scenario: Non-won item is shown

- **GIVEN** an item is lost, watched, a search result, or a relisting candidate
- **WHEN** the item is shown
- **THEN** it SHALL NOT display won-date metadata
