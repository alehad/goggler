# Design: Auto-select Postgres driver adapter by host (Neon vs local)

## Change

`src/persistence/prisma.ts`:

```ts
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const NEON_HOST_SUFFIX = ".neon.tech";

function createAdapter(connectionString: string) {
  const { hostname } = new URL(connectionString);
  return hostname.endsWith(NEON_HOST_SUFFIX)
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });
}

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: createAdapter(connectionString) });
}
```

Confirmed via the installed packages: `PrismaPg implements SqlMigrationAwareDriverAdapterFactory` and `PrismaNeon implements SqlDriverAdapterFactory` (both from `@prisma/driver-adapter-utils`, the former a superset of the latter) — structurally compatible, so no explicit return-type annotation is needed; TypeScript infers a type `PrismaClient`'s `adapter` option already accepts, exactly as it does today for the single-adapter case.

`getPrismaClient()` is unchanged — it already just calls `createPrismaClient(connectionString)` with whatever `DATABASE_URL` resolves to; the branching happens entirely inside `createAdapter`.

## Why hostname-based, not an env flag

- Zero extra configuration to keep in sync — whichever `DATABASE_URL` a given environment (dev machine, CI, wherever the app eventually deploys) is pointed at, the right transport is used automatically.
- No startup-time network probing (slower, and adds a failure mode of its own) — this is a pure, deterministic function of the connection string already being passed in.
- `*.neon.tech` is stable and specific to Neon-issued connection strings, so there's no realistic collision risk with a local or other-provider `DATABASE_URL`.

## Testing

- Unit test for `createAdapter` (exported for testability, or tested indirectly via `createPrismaClient`): a `*.neon.tech` connection string produces a `PrismaNeon` instance; any other host (e.g. `localhost`) produces a `PrismaPg` instance. Constructing the adapter doesn't itself open a connection, so this test needs no network access or real database.
- Existing persistence integration tests (which all point at local Postgres via `TEST_DATABASE_URL`) continue to exercise the `PrismaPg` path unchanged — no test changes needed there.
