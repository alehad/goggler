## MODIFIED Requirements

### Requirement: Captured price records are verified server-side before persisting

The system SHALL NOT persist a price value supplied directly by the client. Captured records SHALL be derived from a fresh, authenticated eBay fetch performed server-side at capture time. Persisting a batch of captured items SHALL succeed reliably regardless of batch size up to the route's own maximum, without depending on a fixed database-transaction timeout that a large-but-within-limits batch could plausibly exceed.

#### Scenario: Client requests capture of specific items

- **GIVEN** the client submits a set of venue item ids to capture
- **WHEN** the server processes the capture request
- **THEN** it SHALL re-fetch the user's current ended watchlist items from eBay
- **AND** it SHALL persist only the requested items that are present in that freshly-fetched set
- **AND** it SHALL report which requested ids were skipped because they were not found
- **AND** the persisted price SHALL be the item's native listing currency (Browse-resolved when available), not a marketplace-converted figure

#### Scenario: A large batch is captured in one request

- **GIVEN** a batch of items up to the route's configured maximum (200)
- **WHEN** they are captured together in one request
- **THEN** the persistence transaction SHALL NOT time out due to the batch's size alone
- **AND** every verifiable item in the batch SHALL be persisted, not rolled back as a group due to exceeding a fixed timeout independent of batch size
