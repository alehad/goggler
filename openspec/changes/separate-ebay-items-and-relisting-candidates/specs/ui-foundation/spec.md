## MODIFIED Requirements

### Requirement: Live-source compatible history UI
The existing Home, Watching, and Purchases views SHALL consume the same history route contract for both fixture and live eBay read sources.

#### Scenario: Home separates eBay items from relisting candidates
- **GIVEN** buying history is loaded
- **WHEN** the Home feed contract is returned
- **THEN** it SHALL include direct eBay-sourced rows separately from relisting-candidate rows
- **AND** it SHALL retain a composed row list for rendering

#### Scenario: Never won shows direct eBay lost history
- **GIVEN** a live relisting candidate matches a never-won lost bid
- **WHEN** the user selects the `Never won` Home filter
- **THEN** the feed SHALL show direct eBay lost-history rows
- **AND** it SHALL NOT show the live relisting candidate row

#### Scenario: Relistings shows derived candidates
- **GIVEN** goggler has discovered relisting candidates
- **WHEN** the user selects the `Relistings` Home filter
- **THEN** the feed SHALL show relisting-candidate rows
- **AND** it SHALL NOT rely on direct eBay watchlist or lost-history rows to populate the candidate list
