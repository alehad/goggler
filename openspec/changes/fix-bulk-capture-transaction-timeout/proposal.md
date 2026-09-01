# Proposal: Fix bulk price-history capture timing out on larger batches

## Why

Discovered live while testing the new macOS Analytics tab: "Capture all visible" on a 63-item batch failed with a `502 capture_failed`, and nothing was captured. The individual capture and the web app's own "Capture all visible" are exposed to the exact same underlying bug for a large enough batch — this isn't macOS-specific.

## Root Cause

`captureMarketPriceRecords` (`src/persistence/market-price-records.ts`) wraps every item's `upsert` in one `prisma.$transaction([...])` call with no explicit `timeout`, defaulting to Prisma's built-in 5000ms. Against the real (remote, Neon) database, 63 sequential upserts took ~6 seconds — past the default timeout — so the whole transaction rolled back and **every** item in the batch failed together, not just the slow ones. Confirmed directly from the server log after adding temporary diagnostic logging to the route's previously-silent catch-all:

```
PrismaClientKnownRequestError: Transaction API error: A rollback cannot be executed on an
expired transaction. The timeout for this transaction was 5000 ms, however 5942 ms passed
since the start of the transaction.
```

## What Changes

- `captureMarketPriceRecords` chunks the batch into groups of 10 and runs one `$transaction` per chunk, sequentially, using Prisma's default 5000ms timeout unchanged — rather than raising a single transaction's timeout to a bigger fixed value, which just moves the same ceiling further out. Chunking scales automatically if the route's own batch-size cap (`MAX_CAPTURE_ITEMS = 200`) is ever raised, with no timeout value to reconsider.
- The route's capture catch-all (`app/api/market-insights/capture/route.ts`) keeps logging the actual error (message/stack), not just a generic string — this diagnostic was added live to find the root cause and is worth keeping; the previous silent `console.warn("...", { type: "unexpected_error" })` gave no way to diagnose a failure like this without redeploying extra logging under time pressure, as just happened.

## Out of Scope

- Restructuring the capture pipeline to avoid one large transaction entirely (e.g. chunked batches) — a real, larger change; the timeout increase is a proportionate fix for the actual failure observed.

## Success Criteria

- Capturing a large batch (confirmed live: 63 items) succeeds end-to-end, both via the macOS app and (unaffected by this change, but worth confirming) the web app.
- A capture failure, if one still occurs for another reason, now logs enough detail (message + stack) server-side to diagnose without needing to add logging under pressure again.
