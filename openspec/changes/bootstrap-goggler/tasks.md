# Tasks: Bootstrap goggler

## 1. Specification

- [ ] Review and refine bootstrap OpenSpec proposal.
- [ ] Define accepted baseline specs for users, venue adapters, auction tracking, dashboard, and purchase analytics.
- [ ] Validate current eBay API capabilities, scopes, and UK marketplace behavior.

## 2. Application Scaffold

- [ ] Create a Next.js TypeScript application.
- [ ] Add formatting, linting, and test tooling.
- [ ] Add Prisma and initial PostgreSQL configuration.
- [ ] Create initial environment variable template.

## 3. Domain Model

- [ ] Model users and sessions.
- [ ] Model connected venue accounts.
- [ ] Model imported auctions.
- [ ] Model tracked items.
- [ ] Model search runs and candidate listings.
- [ ] Model match decisions.

## 4. eBay Adapter

- [ ] Implement eBay OAuth flow.
- [ ] Implement buying history import.
- [ ] Normalize won and not-won items.
- [ ] Implement active auction search for eBay UK.
- [ ] Add adapter-level tests using recorded or mocked responses.

## 5. Dashboard

- [ ] Build local sign-in flow.
- [ ] Build eBay connection status view.
- [ ] Build buying history import view.
- [ ] Build tracked lost-items view.
- [ ] Build candidate relistings review view.

## 6. Verification

- [ ] Add unit tests for matching logic.
- [ ] Add integration tests for repository/domain flows.
- [ ] Add basic end-to-end smoke test for dashboard navigation.

