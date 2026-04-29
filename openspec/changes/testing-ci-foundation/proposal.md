# Change: Testing CI foundation

## Why

goggler is moving from a visual prototype and planning specs into authentication, eBay integration, import, and matching behavior. These areas touch user-owned data and external API boundaries, so the project needs a clear testing strategy and automated verification before implementation accelerates.

Authentication should be the first functional component covered because it establishes local user ownership, session-scoped eBay authorization, and the rule that eBay token values are never stored at rest.

## What Changes

- Define the repository's testing layers: unit, route/API, persistence, adapter contract, integration, and end-to-end smoke tests.
- Define auth-first test expectations for local sessions, eBay OAuth callback handling, session-scoped token use, disconnect, and import authorization.
- Define GitHub Actions checks for linting, type checking, unit tests, integration tests, and production build verification.
- Define an optional advisory AI review workflow for pull requests, configurable with a separate model from the implementation assistant.
- Establish that CI should start focused and fast, then expand as database-backed behavior and browser flows are implemented.

## Out Of Scope

- Implementing the auth feature itself.
- Adding production secrets or real eBay credentials to the repository.
- Making AI review a required merge gate in the first version.
- Full browser end-to-end coverage for workflows that do not exist yet.
- Load, performance, and security penetration testing.

## Success Criteria

- The auth implementation has tests for happy paths, negative paths, session expiry, and token non-persistence.
- Pull requests run automated lint, type, test, and build checks.
- Database-backed tests can run against an isolated CI PostgreSQL service.
- eBay-dependent tests use mocked or recorded responses and never call production eBay by default.
- The optional AI review workflow can run with a configurable model and produce advisory PR feedback without blocking merges initially.
