# Design: Named, startup-selectable database target (default Neon)

## Change

`src/persistence/prisma.ts`:

```ts
const DB_TARGETS = ["local", "neon"] as const;
type DbTarget = (typeof DB_TARGETS)[number];

const DB_TARGET_ENV_VARS: Record<DbTarget, string> = {
  local: "DATABASE_URL",
  neon: "NEON_DATABASE_URL"
};

function resolveDbTarget(): DbTarget {
  const raw = process.env.GOGGLER_DB_TARGET;
  if (raw === undefined) {
    return "neon";
  }
  if ((DB_TARGETS as readonly string[]).includes(raw)) {
    return raw as DbTarget;
  }
  throw new Error(
    `Invalid GOGGLER_DB_TARGET "${raw}" — expected one of: ${DB_TARGETS.join(", ")}`
  );
}

export function resolveDatabaseUrl(): string | undefined {
  const target = resolveDbTarget();
  return process.env[DB_TARGET_ENV_VARS[target]];
}

export function getPrismaClient(): PrismaClient | undefined {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    return undefined;
  }

  if (!globalForPrisma.gogglerPrisma) {
    globalForPrisma.gogglerPrisma = createPrismaClient(connectionString);
  }

  return globalForPrisma.gogglerPrisma;
}
```

`createAdapter`/`createPrismaClient` are untouched — they still just take whatever connection string they're given and pick the right driver by host, same as the previous change. `resolveDatabaseUrl` is the only new piece, and it's the only thing that changes: instead of `getPrismaClient()` reading `process.env.DATABASE_URL` directly, it now goes through target resolution first.

## Why this shape

- **Reusing existing env var names** (`DATABASE_URL`, `NEON_DATABASE_URL`) rather than introducing new ones for the connection strings themselves means Prisma's own CLI tooling (`prisma migrate deploy`, `prisma generate`, which read `DATABASE_URL` directly via `prisma.config.ts`) keeps working exactly as it does today, pointed at local Postgres, without needing to also teach the CLI about `GOGGLER_DB_TARGET`.
- **Throwing on an unrecognized target** rather than silently defaulting: this variable decides which real database gets read and written. A typo silently falling back to some default could mean writing to (or reading from) the wrong database without any indication — worth failing loudly instead.
- **Not throwing when the target's underlying URL is simply unset** (e.g. target resolves to `neon` but `NEON_DATABASE_URL` isn't set): this matches `getPrismaClient()`'s existing, already-relied-upon behavior of returning `undefined` when persistence isn't configured, which callers throughout the app already treat as a legitimate degraded state (e.g. `if (!prisma) return [];`).

## Testing

- Unit tests for `resolveDatabaseUrl` (exported for testability), covering: unset `GOGGLER_DB_TARGET` resolves `NEON_DATABASE_URL`; `local` resolves `DATABASE_URL`; `neon` resolves `NEON_DATABASE_URL`; an unrecognized value throws with a message naming the valid options. Tests set/restore `process.env` directly around each case (no real database connection needed — this is pure resolution logic).

### A real regression caught during implementation, worth recording

The initial assumption — that integration tests are unaffected because they construct their own `PrismaClient` via `createPrismaClient(process.env.TEST_DATABASE_URL)` — was **wrong** for two test files: `test/market-insights/price-history.integration.mjs` and `test/market-insights/matched-sales.integration.mjs`. Those exercise `listCaptureCandidates`/`captureItems`/`listMatchedSales`, whose public signatures don't expose a `prisma` parameter at all — internally they call persistence functions that fall back to their own `prisma: PrismaClient | undefined = getPrismaClient()` default. Before this change, those tests worked by setting `process.env.DATABASE_URL = process.env.TEST_DATABASE_URL` in `before()`, relying on `getPrismaClient()` reading `DATABASE_URL` directly. Once `getPrismaClient()` started defaulting to the `neon` target instead, that override stopped mattering — the tests silently started talking to the **real Neon database** (since `NEON_DATABASE_URL` is also loaded from `.env.local` in every integration test file).

This was caught immediately by running the full test suite (10 tests failed on assertion mismatches, not connection errors — the real Neon data was there, just not what the tests expected) and confirmed by directly querying Neon: one test's `captureItems` call had written a real row (`venueItemId: "watch-ended"`) into the live `MarketPriceRecord` table under the real `userId`. It was identified precisely and deleted, and a full field-by-field re-comparison against local confirmed no other drift.

**Fix**: both test files now also set `process.env.GOGGLER_DB_TARGET = "local"` in `before()`, alongside the existing `DATABASE_URL` override — making explicit what was previously incidental. Re-ran the full suite clean afterward, plus an explicit Neon row-count check to confirm no residual pollution.

This is the reason `GOGGLER_DB_TARGET` throws instead of silently doing something unexpected on a bad value, and it's a concrete argument for why *any* code relying on `getPrismaClient()`'s implicit default (rather than an explicit, passed-in `PrismaClient`) is worth treating carefully going forward — it's an easy seam to miss.
