import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const globalForPrisma = globalThis as typeof globalThis & {
  gogglerPrisma?: PrismaClient;
};

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString })
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
