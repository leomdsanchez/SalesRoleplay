import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "../server/db/sqlite";
import { voiceSettings } from "@shared/schema";
import { settingsStorage } from "../server/storage/settings";
import { defaultSettings } from "@shared/settings-schema";
import { eq } from "drizzle-orm";

describe("Settings Storage", () => {
  const testUserId = "test-user-123";

  beforeEach(async () => {
    // Clean up before each test
    db.delete(voiceSettings).run();
  });

  afterEach(async () => {
    // Clean up after each test
    db.delete(voiceSettings).run();
  });

  describe("get", () => {
    it("should return default settings for new user", async () => {
      const settings = settingsStorage.get("nonexistent-user");

      expect(settings).toEqual(defaultSettings);
    });

    it("should return saved settings for existing user", async () => {
      const customSettings = {
        ...defaultSettings,
        temperature: 0.8,
        maxTokens: 1500,
        llmModel: "gpt-5" as const,
      };

      // Save settings first
      settingsStorage.save(testUserId, customSettings);

      // Retrieve settings
      const retrievedSettings = settingsStorage.get(testUserId);

      expect(retrievedSettings).toEqual(customSettings);
    });
  });

  describe("save", () => {
    it("should save new settings", async () => {
      const customSettings = {
        ...defaultSettings,
        temperature: 0.9,
        sttModel: "whisper-1" as const,
      };

      settingsStorage.save(testUserId, customSettings);

      // Verify in database
      const rows = db
        .select()
        .from(voiceSettings)
        .where(eq(voiceSettings.userId, testUserId))
        .all();

      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].settings)).toEqual(customSettings);
      expect(typeof rows[0].updatedAt).toBe("number");
    });

    it("should update existing settings", async () => {
      // Save initial settings
      const initialSettings = {
        ...defaultSettings,
        temperature: 0.5,
      };
      settingsStorage.save(testUserId, initialSettings);

      // Update settings
      const updatedSettings = {
        ...defaultSettings,
        temperature: 0.9,
        maxTokens: 3000,
      };
      settingsStorage.save(testUserId, updatedSettings);

      // Verify only one record exists with updated values
      const rows = db
        .select()
        .from(voiceSettings)
        .where(eq(voiceSettings.userId, testUserId))
        .all();

      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].settings)).toEqual(updatedSettings);
    });

    it("should handle concurrent saves", async () => {
      const settings1 = { ...defaultSettings, temperature: 0.1 };
      const settings2 = { ...defaultSettings, temperature: 0.2 };

      // Save concurrently
      await Promise.all([
        Promise.resolve(settingsStorage.save(testUserId, settings1)),
        Promise.resolve(settingsStorage.save(testUserId, settings2)),
      ]);

      // Should have only one record with the last save
      const rows = db
        .select()
        .from(voiceSettings)
        .where(eq(voiceSettings.userId, testUserId))
        .all();

      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].settings).temperature).toBe(0.2);
    });
  });
});
