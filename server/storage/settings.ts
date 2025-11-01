import Database from "better-sqlite3";
import path from "path";
import { type VoiceAgentSettings, defaultSettings } from "@shared/settings-schema";

const db = new Database(path.join(process.cwd(), "data", "voice-settings.db"));

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS voice_settings (
    user_id TEXT PRIMARY KEY,
    settings TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

export const settingsStorage = {
  get(userId: string): VoiceAgentSettings {
    const row = db
      .prepare("SELECT settings FROM voice_settings WHERE user_id = ?")
      .get(userId) as { settings: string } | undefined;

    if (row) {
      return JSON.parse(row.settings);
    }

    return defaultSettings;
  },

  save(userId: string, settings: VoiceAgentSettings): void {
    const now = Date.now();
    db.prepare(`
      INSERT INTO voice_settings (user_id, settings, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        settings = excluded.settings,
        updated_at = excluded.updated_at
    `).run(userId, JSON.stringify(settings), now);
  },
};
