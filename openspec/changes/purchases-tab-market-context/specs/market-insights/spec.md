## ADDED Requirements

### Requirement: Batch matched-sales summary

The system SHALL provide a way to compute matched-sales summary statistics (count, average, lowest, highest) for multiple relisting groups in one request.

#### Scenario: Requesting summaries for multiple groups

- **GIVEN** a set of `(relistingGroupId, currency)` pairs belonging to the current user's data
- **WHEN** a batch summary is requested
- **THEN** the response SHALL include, for each pair, the count/average/lowest/highest of its matched sales, or an explicit empty result if there are none

#### Scenario: Summary excludes other users' data

- **GIVEN** a relisting group with matched sales belonging to a different user
- **WHEN** a batch summary is requested by the current user
- **THEN** those other-user sales SHALL NOT be included in the computed statistics
