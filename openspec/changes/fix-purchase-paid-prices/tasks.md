# Tasks

## Current status

Implementation and the eleven approved production data repairs are complete. The user signed off the web functional test on 2026-11-04 and explicitly requested a commit. Updated macOS client functional sign-off remains required before merge. Automated macOS tests pass. No schema migration or release tag is part of this change.

## Planning and implementation

- [x] Inspect parsing, assembly, persistence, clients and affected records.
- [x] Obtain user approval of Won > Lost > Watched identity precedence before product matching.
- [x] Store assembly and paid-price diagrams in the design.
- [x] Clarify server-only pricing/search/source rules in AGENTS.md.
- [x] Add mandatory local schema/data recovery copies and full-stack stop/start routines; exclude private runbooks/backups from Git and Docker.
- [x] Implement shared listing assembly for history, Analytics, matched sales, trends/deals and AI tools.
- [x] Remove client analytics unions/outcome inference; calculate purchase comparisons and chart membership server-side.
- [x] Parse transaction-aware WonList prices and dates; reject empty/malformed numeric values; cover recent GetOrders history.
- [x] Preserve existing purchase amounts/currencies/dates during normal import so repairs cannot bypass review.
- [x] Add authenticated, CSRF-protected read-only repair preview.
- [x] Keep the existing schema: no durable provenance expansion or blind zero-price cleanup. Unverified records remain unresolved in previews until transaction evidence is available.

## Approved data repair and recovery

- [x] Inventory 11 zero-price purchases and investigate the two without captured observations.
- [x] Live transaction preview resolved all 11, including Lee Konitz USD 3.99 and Jim Hall USD 7.50; no warnings or unresolved rows.
- [x] Obtain user approval of exact prices and transaction timestamps before mutation.
- [x] Create fresh consistent schema/data snapshot, manifest/checksum, and verify full isolated restore before repair.
- [x] Rehearse atomic repair on the restored copy; prove one stale original value prevents all 11 updates.
- [x] Apply only the approved WonItem amount/currency/date corrections with original-value guards; verify every other row/field across all seven tables is unchanged.
- [x] Create and restore-verify a post-repair recovery copy before deploying for web testing.
- [x] Retain all recovery copies, approved plan and repair receipts through user verification; do not delete automatically.

Recovery artifacts are private under ignored `.local/db-backups/`; never add them to Git. The repair copy is `2026-11-04T11-10-03.093Z-neon-http/`, with the sealed plan and staged/production receipts. The post-repair pre-deployment copy is `2026-11-04T11-14-30.490Z-neon-http/`. Earlier recovery copies remain retained. Neon TCP was unreachable, so consistent repeatable-read HTTPS snapshots included all application tables/data, enum types, columns/defaults, constraints, indexes and migration history, excluding provider-managed schemas/role ownership/ACL. Every restored row and column/default/nullability was compared locally. PostgreSQL 18 named NOT NULL constraints use equivalent column declarations on local PostgreSQL 17.

## Verification and release gates

- [x] Unit tests: 236/236 pass.
- [x] Persistence tests: 68/68 pass; final date-preservation guard also checked by rerunning all 6 won-item integration tests. Runtime tests prove OAuth material is not persisted and preview makes no database writes.
- [x] macOS build/tests: 42/42 pass.
- [x] TypeScript check, production build, full OpenSpec validation (71/71) and diff whitespace checks pass.
- [x] Advisory security review found an automatic-refresh approval bypass; fixed with importer guards, added regression checks, and follow-up review returned no findings.
- [x] Deploy new web build with explicit user authorization; verify assets, private app access and callback-only public isolation.
- [x] User web functional sign-off: "this looks great, we should commit".
- [x] Record final pre-commit security review result; commit requested explicitly by user after web sign-off.
- [x] User reports macOS works; seller-label follow-up implemented under explicit approval to merge after security reviews.
- [x] All applicable test/review gates passed; user explicitly authorized final commit/merge after seller security review. PR merge/cleanup follows.

The lint script still invokes deprecated next lint; no interactive ESLint migration was attempted. The production build performed its standard lint/type validation.

## Running services

Corrected standalone backend is managed by com.goggler.server on port 3000. Private Serve and callback-only Funnel target it. The temporary read-only preview service on port 3001 was stopped after the user approved normal web testing. The old pre-fix artifact is retained privately for recovery but must not resume imports without reviewing its risk of restoring zero prices. Full-stack shutdown/startup follows AGENTS.md. Release tags and Docker publication/deployment remain separate approvals.

## Final pre-commit security follow-up

The final full review found that capture trusted client title/date metadata despite verifying price. Resolved within the approved server-only scope: requests supply selected IDs only; the route requires active eBay authorization; the server validates eligibility using per-user stored facts or freshly authenticated ended watchlist data and persists only server metadata and verified price. Regression checks reject forged titles/dates/status, other-user records and still-active/unknown IDs. Final unit tests 230/230, persistence tests 67/67, TypeScript/production build and OpenSpec checks pass. macOS source was unchanged by this backend follow-up; its 41 passing tests remain applicable. Follow-up Copilot review explicitly confirms the vulnerability is fixed and reports no blocking findings.

This capture follow-up is not yet deployed. Recheck capture functionally after deployment; previous web sign-off for other behavior is recorded above. Keep PR in draft pending that recheck and updated macOS functional sign-off. The commit is explicitly authorized; merge gates remain intact. No release tag or Docker publication is authorized.

## macOS functional feedback — seller metadata

User says the macOS app works, with a seller-label issue: numeric IDs are shown instead of the known username for the corrected purchases. Read-only diagnosis recorded in design. Seller IDs predate the price repair; 11 purchases share 201977996, 9 same-item captures show facerecords, and 2 other purchases have other numeric sellers. No seller metadata changed during investigation. Keep PR draft while discussing server-side identity/display-label resolution and obtaining design review for that amendment. Do not infer authorization for schema or data repairs from the screenshot alone.

## Seller amendment verification and merge authorization

The user approved implementing the seller-label amendment and explicitly requested commit/merge once security reviews pass. Preserve existing financial fields and seller IDs; this amendment changes response metadata only, with no schema or seller-record repair. Same-listing corroboration resolved all 11 numeric-identity purchases to facerecords in a read-only real-data check, including the two without captures. Unit tests cover ambiguous identity/name pairs, numeric usernames, masked labels and profile URL injection; the persistence test verifies per-user isolation and consistent top-level purchase/analytics/home-feed labels with immutable raw IDs.

Final checks: 236 unit tests, 68 persistence tests, 42 macOS tests, TypeScript and production build pass. Copilot advisory review reports no blocking findings; direct inspection confirms response-local maps, per-user inputs, safe first-party encoded links and no seller writes or schema changes. Claude Code's built-in security-review skill is not available to Codex and has not been claimed as run. Earlier capture hardening also passed its advisory re-review and is included in the final build. The latest explicit merge authorization supersedes the earlier outstanding manual-recheck pause; no additional human test is being claimed for that follow-up.

Final seller/capture build deployed after fresh restore-verified recovery copy `.local/db-backups/2026-11-04T13-41-59.761Z-neon-http/`. No seller data or schema rewrite performed. Existing backend LaunchAgent and tunnel configuration remain the normal app stack. Canonical accepted rules are now reflected under openspec/specs/ebay-buying-history/spec.md. User's explicit authorization is the basis for shipping after automated checks/security reviews; no additional unperformed manual sign-off is implied.
