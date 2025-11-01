import { describe, it, expect } from "vitest";
import {
  LLMModels,
  STTModels,
  TTSModels,
  TTSVoices,
  voiceSettingsSchema,
  defaultSettings,
  isGPT5Model,
  isGPT5ThinkingModel,
  getModelLabel
} from "../../shared/settings-schema";

describe("Settings Schema", () => {
  describe("Model Arrays", () => {
    it("should contain only valid GPT-5 and GPT-4o models", () => {
      expect(LLMModels).toContain("gpt-5");
      expect(LLMModels).toContain("gpt-5-thinking");
      expect(LLMModels).toContain("gpt-5-mini");
      expect(LLMModels).toContain("gpt-5-nano");
      expect(LLMModels).toContain("gpt-4o");
      expect(LLMModels).toContain("gpt-4o-mini");

      // Should not contain deprecated models
      expect(LLMModels).not.toContain("o1");
      expect(LLMModels).not.toContain("o1-pro");
      expect(LLMModels).not.toContain("gpt-4");
      expect(LLMModels).not.toContain("gpt-4-turbo");
      expect(LLMModels).not.toContain("gpt-3.5-turbo");
    });

    it("should contain updated voice models", () => {
      expect(STTModels).toContain("gpt-4o-transcribe");
      expect(STTModels).toContain("whisper-1");

      expect(TTSModels).toContain("gpt-4o-mini-tts");
      expect(TTSModels).toContain("tts-1");
      expect(TTSModels).toContain("tts-1-hd");
    });
  });

  describe("GPT-5 Model Detection", () => {
    it("should correctly identify GPT-5 models", () => {
      expect(isGPT5Model("gpt-5")).toBe(true);
      expect(isGPT5Model("gpt-5-thinking")).toBe(true);
      expect(isGPT5Model("gpt-5-mini")).toBe(true);
      expect(isGPT5Model("gpt-5-nano")).toBe(true);

      // Should not identify non-GPT-5 models
      expect(isGPT5Model("gpt-4o")).toBe(false);
      expect(isGPT5Model("gpt-4o-mini")).toBe(false);
      expect(isGPT5Model("chatgpt-4o-latest")).toBe(false);
    });

    it("should correctly identify GPT-5 thinking model", () => {
      expect(isGPT5ThinkingModel("gpt-5-thinking")).toBe(true);
      expect(isGPT5ThinkingModel("gpt-5")).toBe(false);
      expect(isGPT5ThinkingModel("gpt-5-mini")).toBe(false);
      expect(isGPT5ThinkingModel("gpt-4o")).toBe(false);
    });
  });

  describe("Zod Validation", () => {
    it("should validate correct voice settings", () => {
      const validSettings = {
        llmModel: "gpt-4o-mini" as const,
        temperature: 0.7,
        maxTokens: 2000,
        topP: 1.0,
        sttModel: "gpt-4o-transcribe" as const,
        sttLanguage: "pt",
        ttsModel: "gpt-4o-mini-tts" as const,
        ttsVoice: "alloy" as const,
        systemPrompt: "Test prompt",
        streamSentences: true,
        autoPlayAudio: true,
      };

      const result = voiceSettingsSchema.safeParse(validSettings);
      expect(result.success).toBe(true);
    });

    it("should reject invalid temperature", () => {
      const invalidSettings = {
        ...defaultSettings,
        temperature: 3, // Above max 2
      };

      const result = voiceSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain("temperature");
    });

    it("should reject invalid maxTokens", () => {
      const invalidSettings = {
        ...defaultSettings,
        maxTokens: 5000, // Above max 4000
      };

      const result = voiceSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain("maxTokens");
    });

    it("should reject deprecated models", () => {
      const invalidSettings = {
        ...defaultSettings,
        llmModel: "o1" as any, // Deprecated model
      };

      const result = voiceSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain("llmModel");
    });
  });

  describe("Helper Functions", () => {
    it("should generate correct model labels", () => {
      expect(getModelLabel("gpt-5")).toBe("gpt-5 (latest generation)");
      expect(getModelLabel("gpt-5-thinking")).toBe("gpt-5-thinking (thinking + reasoning)");
      expect(getModelLabel("gpt-5-mini")).toBe("gpt-5-mini (fast, cost-effective)");
      expect(getModelLabel("gpt-5-nano")).toBe("gpt-5-nano (fastest, cheapest)");
      expect(getModelLabel("gpt-4o")).toBe("gpt-4o (multimodal)");
      expect(getModelLabel("chatgpt-4o-latest")).toBe("chatgpt-4o-latest (always updated)");
    });
  });

  describe("Default Settings", () => {
    it("should use updated default models", () => {
      expect(defaultSettings.llmModel).toBe("gpt-4o-mini");
      expect(defaultSettings.sttModel).toBe("gpt-4o-transcribe");
      expect(defaultSettings.ttsModel).toBe("gpt-4o-mini-tts");
    });

    it("should validate default settings", () => {
      const result = voiceSettingsSchema.safeParse(defaultSettings);
      expect(result.success).toBe(true);
    });
  });
});
