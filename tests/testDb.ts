/**
 * The test database URL: TEST_DATABASE_URL if set, otherwise DATABASE_URL with
 * the database name suffixed `_test`. Refuses anything that looks remote, so a
 * misconfigured .env can never wipe a Neon database.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = explicit ?? process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL (or TEST_DATABASE_URL) to run tests");

  const url = new URL(base);
  if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) {
    throw new Error(`Refusing to run tests against non-local database host "${url.hostname}"`);
  }
  if (!explicit && !url.pathname.endsWith("_test")) url.pathname = `${url.pathname}_test`;
  return url.toString();
}
