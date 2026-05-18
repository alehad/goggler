# Capability: UI Foundation

## ADDED Requirements

### Requirement: Matching preferences controls

The `My goggler` page SHALL let the user configure simple relisting matching preferences.

#### Scenario: User views matching preferences

- **GIVEN** the user opens `My goggler`
- **WHEN** matching preferences are displayed
- **THEN** the page SHALL show an `Exact title match` checkbox
- **AND** the page SHALL show a semicolon-separated criteria text field

#### Scenario: Default criteria are shown

- **GIVEN** no matching preferences have been changed in the browser
- **WHEN** the user opens `My goggler`
- **THEN** the criteria field SHALL include a `TBM` pattern matching up to four digits
- **AND** the criteria field SHALL include a `PAP` pattern matching up to four digits

#### Scenario: User edits matching preferences

- **GIVEN** the user changes matching preferences
- **WHEN** buying history is refreshed
- **THEN** the refresh SHALL use the current matching preferences
