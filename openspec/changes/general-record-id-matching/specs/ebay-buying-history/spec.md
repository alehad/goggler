## MODIFIED Requirements

### Requirement: Configurable title matching criteria
The live eBay buying-history source SHALL support configurable title matching criteria.

#### Scenario: Generic record identifier match
- **GIVEN** a lost item title contains `BNJ71001`
- **AND** a live watchlist item title contains `BNJ71001`
- **WHEN** the configured criteria include the default generic record-ID pattern
- **THEN** both rows SHALL share the same relisting group

#### Scenario: Exact title fallback remains available
- **GIVEN** a lost item title and a live watchlist item title are identical
- **AND** no configured criteria match either title
- **WHEN** exact title matching is enabled
- **THEN** both rows SHALL share the same title relisting group

### Requirement: Selected purchase market-history query
The selected purchase market-history flow SHALL prefer a catalogue or record identifier query when one can be extracted from the selected title.

#### Scenario: Generic record identifier drives market-history search
- **GIVEN** a selected purchase title contains `BNJ71001`
- **WHEN** market history is requested
- **THEN** the eBay market-history search query SHALL be `BNJ71001`
