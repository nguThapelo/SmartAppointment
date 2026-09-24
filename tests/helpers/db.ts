import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/server/auth/password";
import { signSession } from "@/server/auth/session";

/** Empty every application table (keeps the migrations table). */
export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }
}

let counter = 0;
export const TEST_PASSWORD = "correct-horse-battery";

/** Create a user directly in the DB and return it with a valid session token. */
export async function createUser(role: Role = "CLIENT", overrides: { email?: string; isActive?: boolean } = {}) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `${role.toLowerCase()}${counter}-${Date.now()}@test.local`,
      passwordHash: await hashPassword(TEST_PASSWORD),
      firstName: `${role[0]}${role.slice(1).toLowerCase()}`,
      lastName: `User${counter}`,
      role,
      isActive: overrides.isActive ?? true,
    },
  });
  const token = await signSession({ sub: user.id, sv: user.sessionVersion });
  return { user, token };
}
