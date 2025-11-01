import { z } from "zod";

export const LLMModels = [
  // GPT-5 series (latest generation - August 2025)
  "gpt-5",                      // GPT-5 flagship - multimodal, reasoning traces, 128k context, state-of-the-art intelligence
  "gpt-5-thinking",             // GPT-5 with enhanced reasoning and thought process visibility
  "gpt-5-mini",                 // Smaller, faster GPT-5 - 32k context, cost-effective
  "gpt-5-nano",                 // Most cost-effective GPT-5 - 16k context, fastest inference

  // GPT-4o series (multimodal, stable)
  "chatgpt-4o-latest",          // Dynamic latest 4o - auto-updates to newest version
  "gpt-4o",                     // GPT-4o stable - multimodal, 128k context
  "gpt-4o-mini",                // Smaller 4o - 128k context, cost-effective
  "gpt-4o-2024-11-20",          // GPT-4o November snapshot
  "gpt-4o-2024-08-06",          // GPT-4o August snapshot
] as const;

export const STTModels = [
  "gpt-4o-transcribe", // Next-gen transcription model - higher accuracy
  "whisper-1" // Legacy Whisper model for compatibility
] as const;

export const TTSModels = [
  "gpt-4o-mini-tts", // Next-gen TTS with better steerability and naturalness
  "tts-1", // Standard quality
  "tts-1-hd" // High definition
] as const;

export const TTSVoices = [
  "alloy",    // Neutral, balanced
  "echo",     // Male, clear
  "fable",    // British accent
  "onyx",     // Deep, authoritative
  "nova",     // Female, energetic
  "shimmer",  // Female, soft
] as const;

export type LLMModel = (typeof LLMModels)[number];
export type STTModel = (typeof STTModels)[number];
export type TTSModel = (typeof TTSModels)[number];
export type TTSVoice = (typeof TTSVoices)[number];

export interface VoiceAgentSettings {
  // General LLM settings
  llmModel: LLMModel;
  temperature: number;
  maxTokens: number;
  topP: number;
  
  // Voice settings
  sttModel: STTModel;
  sttLanguage: string;
  ttsModel: TTSModel;
  ttsVoice: TTSVoice;
  
  // Prompt
  systemPrompt: string;
  
  // Advanced
  streamSentences: boolean;
  autoPlayAudio: boolean;
}

export const defaultSettings: VoiceAgentSettings = {
  llmModel: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1.0,
  
  sttModel: "gpt-4o-transcribe",
  sttLanguage: "pt",
  ttsModel: "gpt-4o-mini-tts",
  ttsVoice: "alloy",
  
  systemPrompt: "Você é um assistente virtual prestativo e amigável.",
  
  streamSentences: true,
  autoPlayAudio: true,
};

// Helper to detect if model is GPT-5 series
export function isGPT5Model(model: LLMModel): boolean {
  return model.startsWith("gpt-5");
}

// Helper to detect if model is GPT-5 thinking model
export function isGPT5ThinkingModel(model: LLMModel): boolean {
  return model === "gpt-5-thinking";
}

// Helper to get model display name with grouping
export function getModelLabel(model: LLMModel): string {
  if (model.startsWith("gpt-5")) {
    if (model === "gpt-5-thinking") return `${model} (thinking + reasoning)`;
    if (model === "gpt-5-nano") return `${model} (fastest, cheapest)`;
    if (model === "gpt-5-mini") return `${model} (fast, cost-effective)`;
    return `${model} (latest generation)`;
  }
  if (model === "chatgpt-4o-latest") return `${model} (always updated)`;
  if (model.startsWith("gpt-4o")) return `${model} (multimodal)`;
  return model;
}

// Zod schema for voice settings validation
export const voiceSettingsSchema = z.object({
  llmModel: z.enum(LLMModels),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(1).max(4000),
  topP: z.number().min(0).max(1),
  sttModel: z.enum(STTModels),
  sttLanguage: z.string().min(1),
  ttsModel: z.enum(TTSModels),
  ttsVoice: z.enum(TTSVoices),
  systemPrompt: z.string().min(1).max(2000),
  streamSentences: z.boolean(),
  autoPlayAudio: z.boolean(),
});
