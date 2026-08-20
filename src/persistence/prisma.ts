import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const NEON_HOST_SUFFIX = ".neon.tech";

const DB_TARGETS = ["local", "neon"] as const;
type DbTarget = (typeof DB_TARGETS)[number];

const DB_TARGET_ENV_VARS: Record<DbTarget, string> = {
  local: "DATABASE_URL",
  neon: "NEON_DATABASE_URL"
};

const globalForPrisma = globalThis as typeof globalThis & {
  gogglerPrisma?: PrismaClient;
};

/**
 * Neon connections need the HTTP/WebSocket-based adapter (works over the
 * same port as regular web traffic, unlike raw Postgres TCP which some
 * networks block outbound); everything else keeps using the plain TCP
 * adapter. Purely a function of the connection string's host, so there's
 * no separate flag to keep in sync with which database is actually in use.
 */
export function createAdapter(connectionString: string) {
  const { hostname } = new URL(connectionString);
  return hostname.endsWith(NEON_HOST_SUFFIX) ? new PrismaNeon({ connectionString }) : new PrismaPg({ connectionString });
}

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: createAdapter(connectionString)
  });
}

function resolveDbTarget(): DbTarget {
  const raw = process.env.GOGGLER_DB_TARGET;
  if (raw === undefined) {
    return "neon";
  }
  if ((DB_TARGETS as readonly string[]).includes(raw)) {
    return raw as DbTarget;
  }
  throw new Error(`Invalid GOGGLER_DB_TARGET "${raw}" — expected one of: ${DB_TARGETS.join(", ")}`);
}

/**
 * Which named database target to use — defaults to Neon (the durable,
 * always-available copy) unless GOGGLER_DB_TARGET explicitly says
 * otherwise. An unrecognized value fails loudly rather than silently
 * falling back, since this decides which real database gets read and
 * written.
 */
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
