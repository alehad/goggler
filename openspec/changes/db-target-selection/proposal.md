# Change: Named, startup-selectable database target (default Neon)

## Why

Local Postgres and Neon now both hold a verified, matching copy of the data. The app should be able to point at either one, chosen once at startup, with Neon as the default now that it's the durable, always-available copy — local Postgres becomes the secondary/backup target rather than the primary.

## What Changes

- A new named target concept: `local` (→ `DATABASE_URL`) and `neon` (→ `NEON_DATABASE_URL`) — reusing the existing env vars as-is, not renaming them (so Prisma's own CLI, which reads `DATABASE_URL` directly via `prisma.config.ts`, is unaffected).
- A new env var, `GOGGLER_DB_TARGET`, read once at startup, selecting which named target the app's `PrismaClient` actually connects to.
- **Default changes to `neon`** when `GOGGLER_DB_TARGET` is unset — this is an intentional behavior change: once this ships, running the app with no extra config talks to Neon, not local Postgres. Set `GOGGLER_DB_TARGET=local` to explicitly use local Postgres instead.
- An unrecognized `GOGGLER_DB_TARGET` value (e.g. a typo) SHALL fail loudly at startup rather than silently falling back to the default — this selects which real database gets read/written, so a silent misconfiguration here is exactly the kind of mistake worth refusing to guess through.
- The existing host-based driver-adapter selection (`createAdapter`, `neon.tech` → `PrismaNeon`, else `PrismaPg`) is unchanged and composes with this cleanly: target-selection picks *which* connection string to use, adapter-selection picks *how* to speak to it. No overlap, no redundancy.

## Out Of Scope (deliberately deferred)

- **Local-as-backup sync** (item 4 of the original request): keeping local Postgres in sync with Neon on some cadence. Explicitly not building this now — worth its own design once we've decided how often and by what mechanism (a scheduled script re-using the same read-via-one-Prisma-client/write-via-another approach already proven for the initial migration is the likely shape, but that's a separate change).
- Any change to how tests select their database — `test:persistence` continues to always use `TEST_DATABASE_URL` directly, untouched by `GOGGLER_DB_TARGET`.
- Unlocking local Postgres's read-only lock — left as-is until the sync strategy (above) is decided; there's no reason to unlock it before then.

## Success Criteria

- Running the app with no `GOGGLER_DB_TARGET` set talks to Neon.
- Setting `GOGGLER_DB_TARGET=local` talks to local Postgres, unchanged from today's behavior.
- Setting `GOGGLER_DB_TARGET` to anything else fails fast at startup with a clear error, rather than silently defaulting.
