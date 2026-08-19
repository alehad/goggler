import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const NEON_HOST_SUFFIX = ".neon.tech";

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

export function getPrismaClient(): PrismaClient | undefined {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return undefined;
  }

  if (!globalForPrisma.gogglerPrisma) {
    globalForPrisma.gogglerPrisma = createPrismaClient(connectionString);
  }

  return globalForPrisma.gogglerPrisma;
}
