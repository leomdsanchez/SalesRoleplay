// Voice Agent Settings Schema
// Updated: Janeiro 2025

export const LLMModels = [
  // GPT-5 series (latest generation - Aug 2025)
  "gpt-5",                      // GPT-5 flagship
  "gpt-5-thinking",             // GPT-5 with reasoning traces
  "gpt-5-mini",                 // Smaller, faster GPT-5
  "gpt-5-nano",                 // Most cost-effective GPT-5
  
  // GPT-4o series (multimodal)
  "chatgpt-4o-latest",          // Dynamic latest 4o
  "gpt-4o",                     // GPT-4o stable
  "gpt-4o-mini",                // Smaller 4o
  "gpt-4o-2024-11-20",
  "gpt-4o-2024-08-06",
  
  // O1 series (reasoning models)
  "o1",                         // O1 full release
  "o1-pro",                     // O1 Pro (more compute)
  "o1-preview",                 // O1 preview
  "o1-mini",                    // Faster O1
  "o1-2024-12-17",
  
  // GPT-4 Turbo
  "gpt-4-turbo",
  "gpt-4-turbo-2024-04-09",
  
  // GPT-4 legacy
  "gpt-4",
  "gpt-4-0613",
  
  // GPT-3.5
  "gpt-3.5-turbo",
] as const;

export const STTModels = [
  "whisper-1" // Latest Whisper model
] as const;

export const TTSModels = [
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
  
  // O1 reasoning settings (only for o1 models)
  reasoningEffort?: "low" | "medium" | "high"; // o1 models only
  
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
  reasoningEffort: "medium",
  
  sttModel: "whisper-1",
  sttLanguage: "pt",
  ttsModel: "tts-1",
  ttsVoice: "alloy",
  
  systemPrompt: "Você é um assistente virtual prestativo e amigável.",
  
  streamSentences: true,
  autoPlayAudio: true,
};

// Helper to detect if model is o1 reasoning model
export function isO1Model(model: LLMModel): boolean {
  return model.startsWith("o1");
}

// Helper to detect if model is GPT-5 thinking model
export function isGPT5ThinkingModel(model: LLMModel): boolean {
  return model === "gpt-5-thinking" || model.startsWith("o1");
}

// Helper to get model display name with grouping
export function getModelLabel(model: LLMModel): string {
  if (model.startsWith("gpt-5")) {
    if (model === "gpt-5-thinking") return `${model} (thinking + reasoning)`;
    if (model === "gpt-5-nano") return `${model} (fastest, cheapest)`;
    if (model === "gpt-5-mini") return `${model} (fast, cost-effective)`;
    return `${model} (latest generation)`;
  }
  if (model.startsWith("o1")) {
    if (model === "o1-pro") return `${model} (maximum reasoning)`;
    return `${model} (reasoning)`;
  }
  if (model === "chatgpt-4o-latest") return `${model} (always updated)`;
  if (model.startsWith("gpt-4o")) return `${model} (multimodal)`;
  if (model.startsWith("gpt-4-turbo")) return `${model} (fast)`;
  if (model.startsWith("gpt-4")) return `${model} (quality)`;
  return model;
}
