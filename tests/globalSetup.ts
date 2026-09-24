import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { testDatabaseUrl } from "./testDb";

// Runs once before the whole suite: make sure the dedicated test database
// exists and has every migration applied (so the hand-written SQL constraints
// are exercised too). Non-destructive — `migrate deploy`, not `migrate reset`;
// per-file isolation comes from truncating tables in tests/setup.ts.
export default async function setup() {
  config({ quiet: true });
  const url = new URL(testDatabaseUrl());
  const dbName = url.pathname.slice(1);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const maintenance = new PrismaClient({ datasourceUrl: admin.toString() });
  try {
    const exists = await maintenance.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (exists.length === 0) {
      // Identifier can't be parameterised; dbName comes from our own config and is validated here.
      if (!/^[a-z0-9_]+$/i.test(dbName)) throw new Error(`Unexpected test database name: ${dbName}`);
      await maintenance.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await maintenance.$disconnect();
  }

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url.toString(), DIRECT_DATABASE_URL: url.toString() },
  });
}
