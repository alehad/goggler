# Capability: Testing And CI

## ADDED Requirements

### Requirement: Layered automated tests

The system SHALL use layered automated tests to verify behavior at the smallest reliable boundary.

#### Scenario: Pure auth helper behavior

- **GIVEN** auth helper logic such as session expiry or OAuth state validation
- **WHEN** the behavior can be tested without network, database, or browser dependencies
- **THEN** the behavior SHALL be covered by unit tests

#### Scenario: API route behavior

- **GIVEN** an application route handles authentication or import authorization
- **WHEN** the route is tested
- **THEN** the test SHALL verify the route response and side effects with external providers mocked

#### Scenario: Database-backed behavior

- **GIVEN** behavior depends on persisted users, sessions, connected account metadata, import runs, or auction records
- **WHEN** the behavior is tested in CI
- **THEN** it SHALL run against an isolated test database

### Requirement: Pull request CI checks

Pull requests SHALL run deterministic automated checks before merge.

#### Scenario: Pull request opened or updated

- **GIVEN** a pull request changes application code, specs, or CI configuration
- **WHEN** GitHub Actions runs
- **THEN** CI SHALL install dependencies, lint, typecheck when available, run tests, and build the app

#### Scenario: External provider dependencies

- **GIVEN** CI runs on a pull request
- **WHEN** tests exercise eBay OAuth or eBay API behavior
- **THEN** tests SHALL use mocked or recorded provider responses by default
- **AND** SHALL NOT require production eBay credentials

### Requirement: Secret-safe verification

Automated checks SHALL avoid exposing credentials, tokens, or authorization codes.

#### Scenario: Test or CI failure

- **GIVEN** a test or CI job fails during authentication or provider integration behavior
- **WHEN** failure output is logged
- **THEN** the output SHALL NOT include session tokens, eBay access tokens, eBay refresh tokens, OAuth authorization codes, or provider secrets

#### Scenario: Test artifacts uploaded

- **GIVEN** a CI workflow uploads logs, traces, screenshots, or other artifacts
- **WHEN** those artifacts are retained by GitHub Actions
- **THEN** they SHALL NOT contain session tokens, eBay token values, OAuth authorization codes, or provider secrets

### Requirement: Advisory AI review

The system MAY use advisory AI review after deterministic checks are available.

#### Scenario: Local AI review enabled

- **GIVEN** local AI review tooling such as VS Code GitHub Copilot review or GitHub Copilot CLI is available
- **WHEN** implementation changes are ready for review
- **THEN** the user MAY run an advisory local review of uncommitted changes or branch changes before commit or pull request

#### Scenario: Hosted AI review unavailable

- **GIVEN** hosted AI review credentials, model configuration, or paid repository review features are absent
- **WHEN** a pull request is opened or updated
- **THEN** deterministic CI checks SHALL continue to run
- **AND** the missing hosted AI review configuration SHALL NOT block merge

#### Scenario: Hosted AI review enabled later

- **GIVEN** hosted AI review is configured by a later change
- **WHEN** a pull request is opened or updated
- **THEN** the hosted review SHALL provide advisory feedback without blocking merge by model judgment
