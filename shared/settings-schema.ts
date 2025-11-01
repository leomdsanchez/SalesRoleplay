// Voice Agent Settings Schema

export const LLMModels = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "o1-mini",
  "o1-preview",
] as const;

export const STTModels = ["whisper-1"] as const;

export const TTSModels = ["tts-1", "tts-1-hd"] as const;

export const TTSVoices = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
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
  
  sttModel: "whisper-1",
  sttLanguage: "pt",
  ttsModel: "tts-1",
  ttsVoice: "alloy",
  
  systemPrompt: "Você é um assistente virtual prestativo e amigável.",
  
  streamSentences: true,
  autoPlayAudio: true,
};
