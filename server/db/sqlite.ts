import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleNeon, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "../config/env";
import { schema } from "@shared/schema";

let db: BetterSQLite3Database<typeof schema>;

if (env.DATABASE_URL) {
  // For now, always use SQLite even in production for consistency
  // TODO: Implement separate databases for sessions (SQLite) and data (Neon)
  console.warn("[DB] DATABASE_URL set but using SQLite for consistency");
}

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, "dev.db");
const sqlite = new Database(dbFile);
db = drizzle(sqlite, { schema });

export { db };
