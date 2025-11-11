import { db } from "../db/sqlite";
import { voiceSettings } from "@shared/schema";
import { type VoiceAgentSettings, defaultSettings } from "@shared/settings-schema";
import { eq } from "drizzle-orm";

export const settingsStorage = {
  get(userId: string): VoiceAgentSettings {
    const rows = db
      .select()
      .from(voiceSettings)
      .where(eq(voiceSettings.userId, userId))
      .all();

    if (rows.length > 0) {
      const stored = migrateLegacySettings(JSON.parse(rows[0].settings));
      return {
        ...defaultSettings,
        ...stored,
      };
    }

    return defaultSettings;
  },

  save(userId: string, settings: VoiceAgentSettings): void {
    const now = Date.now();
    db.insert(voiceSettings)
      .values({
        userId,
        settings: JSON.stringify(settings),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: voiceSettings.userId,
        set: {
          settings: JSON.stringify(settings),
          updatedAt: now,
        },
      })
      .run();
  },
};

function migrateLegacySettings(settings: any) {
  if (!settings || typeof settings !== "object") {
    return settings;
  }

  if (settings.confidenceModel && !settings.coachModel) {
    settings.coachModel = settings.confidenceModel;
  }
  if (settings.confidencePrompt && !settings.coachPrompt) {
    settings.coachPrompt = settings.confidencePrompt;
  }
  if (typeof settings.confidenceVisible === "boolean" && typeof settings.coachVisible !== "boolean") {
    settings.coachVisible = settings.confidenceVisible;
  }

  return settings;
}
