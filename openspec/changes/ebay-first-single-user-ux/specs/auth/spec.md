# Capability: Auth

## ADDED Requirements

### Requirement: invisible single-user local session

The app SHALL treat the local goggler session as an internal single-user implementation detail.

#### Scenario: User starts eBay connection without visible local sign-in

- **GIVEN** the browser has no active local goggler session
- **WHEN** the user starts eBay connection from the top-right account control
- **THEN** the app SHALL establish the internal single-user local session needed for OAuth state binding
- **AND** the user SHALL NOT be asked to choose or sign into a local goggler account

#### Scenario: eBay OAuth state is created

- **GIVEN** the app starts eBay OAuth
- **WHEN** it creates the OAuth state
- **THEN** the state SHALL remain bound to the internal local session
- **AND** replay protection SHALL continue to apply

#### Scenario: eBay disconnect

- **GIVEN** eBay authorization is stored for the current internal local session
- **WHEN** the user disconnects eBay
- **THEN** eBay token values SHALL be cleared from server-side session memory
- **AND** eBay token values SHALL NOT be persisted at rest
