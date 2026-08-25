## MODIFIED Requirements

### Requirement: eBay-first account control

The app SHALL present eBay connection as the primary visible account state. A network-level failure (no HTTP response at all) while checking or changing that state SHALL NOT be left unhandled.

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

#### Scenario: Config or session check fails at the network level

- **GIVEN** the app checks eBay config or session status in the background (on mount, or after a disconnect)
- **AND** the request fails at the network level (no HTTP response) rather than returning an error status
- **WHEN** the failure occurs
- **THEN** the app SHALL treat it the same as an unauthenticated/not-ready response
- **AND** SHALL NOT leave an unhandled promise rejection

#### Scenario: Disconnect fails at the network level

- **GIVEN** the user selects the disconnect action while eBay is connected
- **AND** the request fails at the network level rather than returning an error status
- **WHEN** the failure occurs
- **THEN** the account control SHALL show a clear "could not disconnect" message
- **AND** SHALL NOT silently do nothing

### Requirement: Marketplace-style search

The UI SHALL provide a top-level search field for finding live eBay listings. A search request that fails at the network level SHALL NOT leave the search results stuck in a loading state indefinitely.

#### Scenario: Execute Home search
- **GIVEN** the user has connected eBay
- **WHEN** the user enters a search query and submits the top search field
- **THEN** the app SHALL switch to the Home tab
- **AND** the Home feed SHALL show live eBay Search results
- **AND** the Search filter tab SHALL be active

#### Scenario: Return from search to watchlist
- **GIVEN** the Home feed is showing Search results
- **WHEN** the user selects the On watchlist filter
- **THEN** the Home feed SHALL show current eBay watchlist rows

#### Scenario: Search result tags remain visible
- **GIVEN** a live eBay search result is on the watchlist, relisted, won, or never won according to loaded goggler state
- **WHEN** the row is displayed in Search results
- **THEN** its existing status tags SHALL remain visible on the card

#### Scenario: Search fails at the network level

- **GIVEN** the user submits the top search field
- **AND** the request fails at the network level (no HTTP response) rather than returning an error status
- **WHEN** the failure occurs
- **THEN** the UI SHALL show a clear "could not reach the server" message in place of the search results
- **AND** SHALL NOT remain on the loading state indefinitely

### Requirement: Analytics tab for price history capture

The app SHALL provide an Analytics bottom tab listing ended watchlist items with their capture status, supporting individual and bulk capture. A captured status SHALL remain accurate across navigation away from and back to the Analytics tab within the same session. The bulk-action controls (capture-all/delete-all) SHALL be visually grouped together, independent of how many rows the filter controls themselves wrap onto. A capture request that fails at the network level SHALL be surfaced to the user, not left unhandled.

#### Scenario: Analytics tab lists ended items with capture status

- **GIVEN** the user has ended watchlist items
- **WHEN** the user opens the Analytics tab
- **THEN** each item SHALL show its title, final price, seller, condition, ended date, and a Captured/Not-captured status

#### Scenario: User captures a single item

- **GIVEN** an ended item is shown as Not captured
- **WHEN** the user selects the capture action for that item
- **THEN** the item SHALL be persisted to price history
- **AND** its status SHALL update to Captured

#### Scenario: User captures all visible not-captured items

- **GIVEN** the Analytics tab is showing a mix of captured and not-captured items
- **WHEN** the user selects the bulk capture action
- **THEN** every currently-filtered not-captured item SHALL be captured in one action

#### Scenario: User filters by capture status

- **GIVEN** the Analytics tab has both captured and not-captured items
- **WHEN** the user selects the Captured or Not-captured filter
- **THEN** the list SHALL show only items matching that status

#### Scenario: Captured status survives switching tabs and back

- **GIVEN** the user just captured an item (individually or via bulk capture) on the Analytics tab
- **WHEN** the user switches to a different tab and then returns to Analytics
- **THEN** that item SHALL still show as Captured, without requiring a full history refresh

#### Scenario: Bulk-action buttons stay grouped regardless of filter row height

- **GIVEN** the capture-status and win-status filter controls wrap onto more than one row (e.g. on a narrower viewport)
- **AND** one or both bulk-action buttons ("Capture all visible", "Delete all visible") are currently shown
- **WHEN** the Analytics tab renders
- **THEN** the bulk-action buttons SHALL render grouped together as their own unit, not individually centered against the filter row's height
- **AND** their label text SHALL NOT wrap onto multiple lines

#### Scenario: Capture fails at the network level

- **GIVEN** the user captures one item or a bulk selection
- **AND** the request fails at the network level (no HTTP response) rather than returning an error status
- **WHEN** the failure occurs
- **THEN** the UI SHALL show a clear "could not capture" message
- **AND** any pending/in-progress capture indicator SHALL clear rather than getting stuck
