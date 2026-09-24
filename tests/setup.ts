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
// Never talk to real providers from tests, whatever is in .env.
process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_for_tests";
process.env.CRON_SECRET = "test-cron-secret-0123456789";
process.env.WHATSAPP_APP_SECRET = "test-meta-app-secret";
process.env.WHATSAPP_VERIFY_TOKEN = "test-verify-token";
process.env.WHATSAPP_ACCESS_TOKEN = "test-meta-access-token";
process.env.WHATSAPP_INSECURE_DEV = "false";
process.env.GEMINI_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";

beforeAll(async () => {
  const { resetDatabase } = await import("./helpers/db");
  await resetDatabase();
});
