// Server code reads its configuration from the environment; point it at the test database.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SESSION_SECRET ??= "test-only-session-secret-0123456789abcdef";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.MESSAGING_MODE = "mock";
process.env.STORAGE_DRIVER = "local";
