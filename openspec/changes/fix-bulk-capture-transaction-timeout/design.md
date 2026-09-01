# Design: Fix bulk price-history capture timing out on larger batches

## The fix (revised): chunk into batches, not one bigger timeout

An earlier version of this fix raised the single transaction's `timeout` to 30s. Reconsidered: that just moves the same problem further out — it's still one fixed ceiling that a big-enough batch could someday exceed again, and it means one slow/huge batch holds a single long-running transaction the whole time.

Instead, `captureMarketPriceRecords` chunks `items` into groups of `CAPTURE_BATCH_SIZE = 10` and runs one `$transaction` per chunk, sequentially, using Prisma's **default** 5000ms timeout (no override) — each chunk of 10 upserts stays comfortably under 1s at the ~95ms/item rate observed live (63 items ≈ 6s in one transaction), regardless of how large the overall batch grows. This scales automatically if `MAX_CAPTURE_ITEMS` (currently 200, in `app/api/market-insights/capture/route.ts`) is ever raised — no timeout value to reconsider.

```ts
const CAPTURE_BATCH_SIZE = 10;

for (let start = 0; start < items.length; start += CAPTURE_BATCH_SIZE) {
  const batch = items.slice(start, start + CAPTURE_BATCH_SIZE);
  await prisma.$transaction(batch.map((item) => prisma.marketPriceRecord.upsert({ ... })));
}
```

## Accepted tradeoff: no longer all-or-nothing across the whole request

The previous single-transaction design meant the whole capture request was atomic — every item succeeded or none did. Chunking means each group of 10 is atomic, but a failure partway through (e.g. chunk 5 of 20) leaves earlier chunks already committed while later ones are never attempted — not a full rollback of everything requested. The route's catch-all still returns a flat `502` either way, so the *client-visible* behavior on failure is unchanged (a hard error, not a partial-success response) — but the *database* can now genuinely hold a partial capture after a failure, where before it held either all or nothing. Sequential (not concurrent) chunk processing was chosen over running chunks in parallel for the same reason: parallel chunks would multiply concurrent connections to the database with no real benefit here, and a partial-failure story is easier to reason about when chunks commit in a predictable order.

## Keeping the diagnostic logging

The route's catch-all previously logged only `{ type: "unexpected_error" }` — no message, no stack. Finding the actual cause required editing the route, redeploying, and reproducing live. Keeping `message`/`stack` in the log going forward (still not the full error object, and still behind a generic `502 capture_failed` in the response body — no internals leak to the client) means the next failure, whatever it is, is diagnosable from the existing server log alone.
