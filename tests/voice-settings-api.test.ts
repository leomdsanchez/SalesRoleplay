import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import type { Express } from "express";
import { db } from "../server/db/sqlite";
import { users, voiceSettings } from "@shared/schema";
import { defaultSettings } from "@shared/settings-schema";
import { eq } from "drizzle-orm";

describe("Voice Settings API", () => {
  let app: Express;
  let agent: any;
  let testUserId: string;

  beforeEach(async () => {
    app = await createTestApp();

    // Clean database
    db.delete(voiceSettings).run();
    db.delete(users).run();

    // Create test user and login
    const registerResponse = await request(app)
      .post("/api/v1/auth/register")
      .send({
        username: "testuser",
        password: "testpass123",
      });

    expect(registerResponse.status).toBe(200);

    // Login and get session
    agent = request.agent(app);
    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .send({
        username: "testuser",
        password: "testpass123",
      });

    expect(loginResponse.status).toBe(200);

    // Get user ID from session
    const meResponse = await agent.get("/api/v1/auth/me");
    testUserId = meResponse.body.id;
  });

  afterEach(async () => {
    db.delete(voiceSettings).run();
    db.delete(users).run();
  });

  describe("GET /api/voice/settings", () => {
    it("should return default settings for new user", async () => {
      const response = await agent.get("/api/voice/settings");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(defaultSettings);
    });

    it("should return saved settings for existing user", async () => {
      const customSettings = {
        ...defaultSettings,
        temperature: 0.8,
        llmModel: "gpt-5" as const,
      };

      // Save settings directly to DB
      db.insert(voiceSettings).values({
        userId: testUserId,
        settings: JSON.stringify(customSettings),
        updatedAt: Date.now(),
      }).run();

      const response = await agent.get("/api/voice/settings");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(customSettings);
    });

    it("should require authentication", async () => {
      const unauthAgent = request(app);
      const response = await unauthAgent.get("/api/voice/settings");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized");
    });
  });

  describe("PUT /api/voice/settings", () => {
    it("should save valid settings", async () => {
      const validSettings = {
        llmModel: "gpt-5-mini",
        temperature: 0.9,
        maxTokens: 3000,
        topP: 0.8,
        reasoningEffort: "medium",
        verbosity: "high",
        sttModel: "whisper-1",
        sttLanguage: "en",
        ttsModel: "tts-1-hd",
        ttsVoice: "nova",
        ttsLanguage: "en",
        systemPrompt: "Custom prompt",
        streamSentences: false,
        autoPlayAudio: false,
      };

      const response = await agent
        .put("/api/voice/settings")
        .send(validSettings);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Settings saved successfully");

      // Verify in database
      const rows = db
        .select()
        .from(voiceSettings)
        .where(eq(voiceSettings.userId, testUserId))
        .all();

      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].settings)).toEqual(validSettings);
    });

    it("should reject invalid temperature", async () => {
      const invalidSettings = {
        ...defaultSettings,
        temperature: 3, // Above max 2
      };

      const response = await agent
        .put("/api/voice/settings")
        .send(invalidSettings);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("temperature");
    });

    it("should reject deprecated model", async () => {
      const invalidSettings = {
        ...defaultSettings,
        llmModel: "o1", // Deprecated model
      };

      const response = await agent
        .put("/api/voice/settings")
        .send(invalidSettings);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("llmModel");
    });

    it("should reject empty system prompt", async () => {
      const invalidSettings = {
        ...defaultSettings,
        systemPrompt: "", // Too short
      };

      const response = await agent
        .put("/api/voice/settings")
        .send(invalidSettings);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("systemPrompt");
    });

    it("should require authentication", async () => {
      const unauthAgent = request(app);
      const response = await unauthAgent
        .put("/api/voice/settings")
        .send(defaultSettings);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized");
    });
  });

  describe("POST /api/voice/settings/reset", () => {
    it("should reset to default settings", async () => {
      // Save custom settings first
      const customSettings = {
        ...defaultSettings,
        temperature: 0.5,
      };

      await db.insert(voiceSettings).values({
        userId: testUserId,
        settings: JSON.stringify(customSettings),
        updatedAt: Date.now(),
      }).run();

      const response = await agent.post("/api/voice/settings/reset");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(defaultSettings);

      // Verify in database
      const rows = db
        .select()
        .from(voiceSettings)
        .where(eq(voiceSettings.userId, testUserId))
        .all();

      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].settings)).toEqual(defaultSettings);
    });

    it("should require authentication", async () => {
      const unauthAgent = request(app);
      const response = await unauthAgent.post("/api/voice/settings/reset");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized");
    });
  });
});
