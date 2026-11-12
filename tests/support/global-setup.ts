/**
 * Applies migrations to the test database once per run. Tests create their own firms, so they
 * never depend on existing rows. Skipped when no test database is configured.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("TEST_DATABASE_URL is not set: database integration tests will be skipped.");
    return;
  }
  const { migrate } = await import("../../scripts/migrate.mjs");
  await migrate(url, { log: () => {} });
}
