# Capability: UI Foundation

## ADDED Requirements

### Requirement: Connected fixture history display

The UI SHALL render fixture-backed buying history only after local sign-in and eBay connection are established.

#### Scenario: Watching lost bid history

- **GIVEN** a signed-in user has connected eBay in the current session
- **AND** fixture history is available
- **WHEN** the user opens Watching
- **THEN** the UI SHALL show lost bid history from the fixture source
- **AND** SHALL provide filters for all lost bids, never won, and eventually won

#### Scenario: Purchases won history

- **GIVEN** a signed-in user has connected eBay in the current session
- **AND** fixture history is available
- **WHEN** the user opens Purchases
- **THEN** the UI SHALL show won item history from the fixture source

#### Scenario: History unavailable before connection

- **GIVEN** the user has not connected eBay in the current session
- **WHEN** the user opens Watching or Purchases
- **THEN** the UI SHALL show a concise connection prompt instead of fixture rows
