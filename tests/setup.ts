import { beforeAll, afterAll } from "vitest";
import { db } from "../server/db/sqlite";
import { users } from "@shared/schema";

// Clean database before each test suite
beforeAll(async () => {
  await db.delete(users);
});

// Close database connection after all tests
afterAll(() => {
  // SQLite connections are closed automatically
});
