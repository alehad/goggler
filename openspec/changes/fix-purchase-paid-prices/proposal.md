# Fix purchase paid-price resolution

## Why
Read-only investigation confirms 11 of 38 stored purchases have zero USD prices. WonList parsing currently extracts nested Item blocks and takes CurrentPrice, losing transaction context. Merging prefers that value over GetOrders TransactionPrice. The default order supplement covers only days 60–90, leaving recent purchases without transaction enrichment. Empty numeric XML is also coerced to zero by Number(). These code paths explain risks; the precise upstream payload for each affected purchase still needs confirmation through the active-session flow.

## What changes
Resolve paid item prices server-side from purchase transaction evidence, preserve original currency, reject missing/empty numeric amounts, and reconcile affected stored records on authenticated refresh. Keep unknown purchase prices unavailable, without inventing amounts or using current Browse listing prices. Make the existing server-only invariant explicitly cover search and purchase-price decisions.

## Scope
Backend parsing, merging, order coverage, persistence reconciliation, server analytics consumers, and regression tests. Clients only render server results. No new credentials, schema columns, currency conversion, shipping/tax totals, background authentication, or broad client architecture audit.

## Review visual and recovery

See [the paid-price precedence diagram and examples](design.md#proposed-paid-price-resolution-review-before-implementation). Before any data or structural mutation, take and verify a local schema-and-data recovery copy under the AGENTS.md Database Safety Copies rule. Implementation remains pending diagram approval and resolution of the provenance design gate.

## Approved assembly scope

User approved Won > Lost > Watched reconciliation by listing identity before matching. Apply one server assembler to history, analytics and assistant paths. Preserve raw observations; show a dry-run database change table before commit or live repair. No schema expansion is approved.
