import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || "file:./data/dev.db";
const isNeon = databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: isNeon ? "postgresql" : "sqlite",
  dbCredentials: {
    url: databaseUrl,
  },
  migrations: {
    table: "__drizzle_migrations__",
  },
});
