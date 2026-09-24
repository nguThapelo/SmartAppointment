import { config } from "dotenv";
import { beforeAll } from "vitest";
import { testDatabaseUrl } from "./testDb";

// Per-worker setup, runs before any app module is imported by a test file.
config({ quiet: true });
const url = testDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.DIRECT_DATABASE_URL = url;
process.env.APP_URL = "http://localhost:3000";
process.env.SESSION_SECRET ??= "test-session-secret-that-is-at-least-32-chars";

beforeAll(async () => {
  const { resetDatabase } = await import("./helpers/db");
  await resetDatabase();
});
