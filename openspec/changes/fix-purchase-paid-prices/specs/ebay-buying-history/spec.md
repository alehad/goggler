## ADDED Requirements

### Requirement: Purchase prices use transaction evidence
The server SHALL prefer a purchase transaction amount in its original currency over a listing price when resolving paid item prices. Missing or blank numeric amounts SHALL NOT become zero. Listing-only zero amounts SHALL NOT establish a free purchase. Both clients SHALL consume the same server-resolved values.

#### Scenario: Won listing contains a zero placeholder
- **WHEN** a won item has a zero listing price and an associated nonzero transaction price
- **THEN** the server returns and persists the transaction amount and its currency as the purchase price

#### Scenario: A purchase has no trustworthy price
- **WHEN** neither transaction evidence nor a trustworthy stored purchase price is available
- **THEN** the server represents the paid price as unavailable and does not supply an invented zero to analytics

#### Scenario: Existing purchase history is refreshed
- **WHEN** authenticated refresh retrieves authoritative transaction evidence for an affected stored purchase
- **THEN** the read-only preview proposes the repair for user approval; ordinary refresh preserves the existing purchase amount and currency until a separately approved repair is applied

#### Scenario: A recent purchase needs order enrichment
- **WHEN** a purchase is newer than the older 60–90 day supplement
- **THEN** the server includes recent supported order history in its transaction lookup rather than omitting that purchase solely because it is recent

### Requirement: Listing authority is resolved before product matching
The server SHALL assemble observations of the same eBay listing with WonList above LostList above WatchList. Lower-authority observations MAY fill missing display metadata but SHALL NOT provide purchase prices, bid outcomes or transaction dates. Different listings SHALL remain distinct even when product matching links them. Both clients SHALL consume server-assembled analytics membership and outcome flags.

#### Scenario: A captured listing is also won
- **WHEN** a captured watched observation and a purchase share a listing identity
- **THEN** one analytics item uses the purchase price, currency, date and won status while preserving capture status

#### Scenario: A lost bid is also watched
- **WHEN** a lost bid and watched observation share a listing identity
- **THEN** one item uses the lost bid's financial facts and outcome, without changing the stored watched observation

#### Scenario: A higher-authority price is missing
- **WHEN** a won purchase lacks a price but its watched observation has a price
- **THEN** the watched price is not treated as paid and does not reappear through currency or product-group filtering

### Requirement: Database repair is previewed before application
The system SHALL support a read-only, session-authenticated and CSRF-protected preview of proposed paid-price changes based on same-listing transaction evidence. Unverified zero records SHALL remain unresolved in the preview when evidence is unavailable. The operator SHALL obtain user verification and a verified local schema-and-data recovery copy before applying production repairs.

#### Scenario: Only a watched price is available
- **WHEN** a stored zero purchase has no authoritative transaction evidence
- **THEN** the preview marks it unresolved rather than proposing a watched-price substitution or mutating the database

#### Scenario: Ordinary refresh discovers a different paid price
- **WHEN** a normal authenticated refresh resolves a transaction price different from an existing purchase price
- **THEN** the importer preserves the stored amount and currency and does not bypass the repair-review gate

### Requirement: Seller identity and display username are resolved separately
The server SHALL preserve the original seller identity and return separate display-name and profile-link fields. It SHALL infer an identity-to-username association only from unambiguous same-listing evidence within the requesting user's dataset, never product-title matching or cross-user caches. Explicit username evidence SHALL take priority over legacy observations. Clients SHALL render the server-resolved values.

#### Scenario: Won identity and captured username describe the same seller
- **WHEN** a won listing carries an opaque seller identity and the same captured listing carries a known username
- **THEN** the server preserves the won identity and financial facts while supplying the username as its display label, including for other items with the same unambiguous identity

#### Scenario: Conflicting or unavailable username evidence
- **WHEN** equal-strength username evidence conflicts or no association is established
- **THEN** the server uses a seller-ID fallback label and omits a username-based profile link

#### Scenario: A real username contains only digits
- **WHEN** an explicitly username-bearing eBay response supplies a numeric-only username
- **THEN** the server may display and link that username without treating it as an opaque identifier
