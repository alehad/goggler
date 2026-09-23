## ADDED Requirements

### Requirement: Streamed buying-history loading progress

The system SHALL provide a streaming variant of the live buying-history fetch that reports incremental progress and partial results while the native-price-lookup and relisting-discovery stages are in flight, in addition to the existing non-streaming endpoint, which SHALL remain unchanged.

#### Scenario: Progress is reported as native prices and relistings are looked up

- **GIVEN** a signed-in user with an active eBay session requests buying history via the streaming endpoint
- **WHEN** native-price lookups and relisting searches are performed
- **THEN** the response SHALL include a sequence of progress events reporting a stage name, a completed count, and a total count
- **AND** the completed count SHALL increase monotonically up to the total for each stage

#### Scenario: The item list is usable before the fetch completes

- **GIVEN** the streaming endpoint is mid-fetch
- **WHEN** a partial snapshot event is emitted
- **THEN** it SHALL be a complete, valid buying-history response shaped identically to the endpoint's final result
- **AND** any item not yet enriched by an in-flight stage SHALL fall back to its already-known value rather than being omitted or left in an invalid state

#### Scenario: The final result matches the non-streaming endpoint

- **GIVEN** identical inputs (matching preferences, eBay account state)
- **WHEN** the streaming endpoint's final event and the non-streaming endpoint's response are compared
- **THEN** they SHALL contain the same buying-history content, including persisted-record merging and capture-status enrichment

#### Scenario: A failure after streaming has started is reported in-band

- **GIVEN** the live fetch fails after the streaming response has already begun
- **WHEN** the failure occurs
- **THEN** an error event SHALL be sent through the stream
- **AND** the stream SHALL close, rather than the connection hanging open

#### Scenario: Requests that fail before any data is fetched use ordinary HTTP error responses

- **GIVEN** a request fails an up-front check (invalid origin, eBay session not connected, re-authentication required, or the history source is unavailable)
- **WHEN** the failure is detected before any streaming has begun
- **THEN** the endpoint SHALL respond with a normal HTTP error status and JSON body, matching the non-streaming endpoint's behavior for the same failure

#### Scenario: Other consumers of buying history are unaffected

- **GIVEN** the macOS app or any other caller of the existing non-streaming buying-history endpoint
- **WHEN** it requests buying history
- **THEN** its request and response format SHALL be completely unchanged by the addition of the streaming endpoint
