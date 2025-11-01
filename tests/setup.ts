import { beforeAll, afterAll, vi } from "vitest";
import { db } from "../server/db/sqlite";
import { users } from "@shared/schema";

// Mock environment variables
vi.mock("../server/config/env", () => ({
  env: {
    NODE_ENV: "test",
    PORT: "5000",
    SESSION_SECRET: "test-secret",
    OPENAI_API_KEY: "test-key",
  },
}));

// Clean database before each test suite
beforeAll(async () => {
  await db.delete(users);
});

// Close database connection after all tests
afterAll(() => {
  // SQLite connections are closed automatically
});
