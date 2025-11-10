import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  // For SQLite, generate UUID in application code. Use TEXT PK.
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const voiceSettings = sqliteTable("voice_settings", {
  userId: text("user_id").primaryKey(),
  settings: text("settings").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type VoiceSettings = typeof voiceSettings.$inferSelect;

export const sessions = sqliteTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: integer("expire").notNull(),
});

export type Session = typeof sessions.$inferSelect;

export const ragChunks = sqliteTable("rag_chunks", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  order: integer("order_idx").notNull(),
  speaker: text("speaker").notNull(),
  text: text("text").notNull(),
  metadata: text("metadata"),
  embedding: text("embedding").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type RagChunk = typeof ragChunks.$inferSelect;

export const schema = { users, sessions, voiceSettings, ragChunks };
