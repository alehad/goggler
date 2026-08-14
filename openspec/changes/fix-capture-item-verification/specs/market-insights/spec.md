## MODIFIED Requirements

### Requirement: Captured price records are verified server-side before persisting

The system SHALL NOT persist a price value supplied directly by the client. Every captured record's price SHALL be independently resolved from eBay (via a per-item Browse API lookup keyed by that item's own id) at capture time, not trusted verbatim from the client. Non-price fields (title, seller, condition, end time, image, item URL) MAY come from data the client already has, since that data was itself sourced from an authenticated eBay fetch when the page loaded and is not security-sensitive.

#### Scenario: Client requests capture of specific items

- **GIVEN** the client submits a set of items to capture, each with its own item id and display data
- **WHEN** the server processes the capture request
- **THEN** it SHALL independently look up each item's current native price directly from eBay by item id
- **AND** it SHALL persist only the requested items whose price could be independently resolved
- **AND** it SHALL report which requested items were skipped because their price could not be resolved
- **AND** the persisted price SHALL be the item's native listing currency (Browse-resolved), never a client-supplied value

#### Scenario: A requested item's price cannot be independently resolved

- **GIVEN** the per-item Browse API price lookup fails for a requested item (e.g. the listing is no longer resolvable)
- **WHEN** the server processes the capture request
- **THEN** that item SHALL NOT be persisted
- **AND** it SHALL be included in the response's skipped list
