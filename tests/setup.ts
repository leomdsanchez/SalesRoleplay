import { beforeEach, afterAll } from "vitest";
import { db } from "../server/db/sqlite";
import { users } from "@shared/schema";

// Clean database before each test
beforeEach(async () => {
  await db.delete(users);
});

// Close database connection after all tests
afterAll(() => {
  // SQLite connections are closed automatically
});
