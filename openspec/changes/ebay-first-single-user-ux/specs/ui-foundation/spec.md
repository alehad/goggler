# Capability: UI Foundation

## ADDED Requirements

### Requirement: eBay-first account control

The app SHALL present eBay connection as the primary visible account state.

#### Scenario: eBay is disconnected

- **GIVEN** the app has no active session-scoped eBay authorization
- **WHEN** the user views the app header
- **THEN** the top-right account control SHALL invite the user to connect eBay
- **AND** the user SHALL NOT need to visit `My` to start the eBay connection flow

#### Scenario: eBay is connected with known identity

- **GIVEN** the app has active session-scoped eBay authorization
- **AND** the connected eBay display name is available
- **WHEN** the user views the app header
- **THEN** the top-right account control SHALL show the connected eBay display name
- **AND** the UI SHALL show the remaining connection time in the account control or dropdown

#### Scenario: eBay is connected without known identity

- **GIVEN** the app has active session-scoped eBay authorization
- **AND** the connected eBay display name is unavailable
- **WHEN** the user views the app header
- **THEN** the top-right account control SHALL show `Signed into eBay`
- **AND** the UI SHALL show the remaining connection time in the account control or dropdown

#### Scenario: User opens connected account dropdown

- **GIVEN** eBay is connected
- **WHEN** the user opens the top-right account control
- **THEN** the dropdown SHALL include a disconnect action
- **AND** the disconnect action SHALL allow the user to reconnect with a different eBay account

### Requirement: My tab without auth setup

The `My` tab SHALL not be the primary place for local sign-in or eBay connection setup.

#### Scenario: User opens My tab

- **GIVEN** the app uses the eBay-first account control
- **WHEN** the user opens `My`
- **THEN** the tab SHALL NOT show local goggler sign-in/sign-out controls
- **AND** the tab SHALL NOT show the primary eBay connect/disconnect controls
