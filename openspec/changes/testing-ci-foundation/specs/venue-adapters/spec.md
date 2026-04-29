# Capability: Venue Adapters

## ADDED Requirements

### Requirement: eBay adapter test coverage

The eBay adapter SHALL be covered by automated tests that avoid production eBay calls by default.

#### Scenario: OAuth provider contract

- **GIVEN** eBay OAuth token exchange is implemented
- **WHEN** adapter tests run
- **THEN** they SHALL use mocked provider responses to verify request construction, response parsing, and recoverable provider errors

#### Scenario: Buying-history provider contract

- **GIVEN** Trading API `GetMyeBayBuying` import is implemented
- **WHEN** adapter tests run
- **THEN** they SHALL verify request headers, XML request body construction, pagination handling, and XML response normalization using mocked or recorded responses

#### Scenario: Import authorization

- **GIVEN** a buying-history import route or service is implemented
- **WHEN** tests run
- **THEN** they SHALL verify import requires both a signed-in local user and active session-scoped eBay authorization
