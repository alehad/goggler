# Capability: eBay Buying History

## ADDED Requirements

### Requirement: Configurable relisting matching

The live eBay buying-history source SHALL support configurable title matching criteria.

#### Scenario: Catalogue code criterion matches

- **GIVEN** a lost item title contains `TBM17`
- **AND** a live watchlist item title contains `TBM17`
- **WHEN** the configured criteria include `TBM\s*\d{1,4}`
- **THEN** the items SHALL share a relisting group

#### Scenario: Exact title fallback is enabled

- **GIVEN** two item titles do not match any configured criterion
- **AND** exact title matching is enabled
- **WHEN** their normalized titles are equal
- **THEN** the items SHALL share a relisting group

#### Scenario: Exact title fallback is disabled

- **GIVEN** two item titles do not match any configured criterion
- **AND** exact title matching is disabled
- **WHEN** their normalized titles are equal
- **THEN** the items SHALL NOT be grouped by exact title

#### Scenario: Invalid criterion is configured

- **GIVEN** the criteria text includes an invalid regex fragment
- **WHEN** live history matching runs
- **THEN** the invalid criterion SHALL be ignored
- **AND** buying history refresh SHALL NOT fail because of that criterion
