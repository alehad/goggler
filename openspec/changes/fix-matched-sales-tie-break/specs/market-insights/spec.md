## MODIFIED Requirements

### Requirement: Batch matched-sales summary

The system SHALL provide a way to compute matched-sales summary statistics (count, average, lowest, highest) for multiple relisting groups in one request. When multiple matched sales tie for the lowest or highest price, the most recent tied sale SHALL be reported, deterministically.

#### Scenario: Requesting summaries for multiple groups

- **GIVEN** a set of `(relistingGroupId, currency)` pairs belonging to the current user's data
- **WHEN** a batch summary is requested
- **THEN** the response SHALL include, for each pair, the count/average/lowest/highest of its matched sales, or an explicit empty result if there are none

#### Scenario: Summary excludes other users' data

- **GIVEN** a relisting group with matched sales belonging to a different user
- **WHEN** a batch summary is requested by the current user
- **THEN** those other-user sales SHALL NOT be included in the computed statistics

#### Scenario: Multiple sales tie for the highest or lowest price

- **GIVEN** two or more matched sales in a group share the same lowest (or highest) price on different dates
- **WHEN** the summary is computed
- **THEN** the most recent of the tied sales SHALL be reported as the lowest (or highest)
