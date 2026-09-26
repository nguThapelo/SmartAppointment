import { PrismaClient } from "@prisma/client";

// One PrismaClient per process (briefcase pattern). In dev, Next's hot reload
// re-evaluates modules, so the client is parked on globalThis to avoid leaking
// connections — which matters with a small RDS instance's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Db = PrismaClient | Tx;
