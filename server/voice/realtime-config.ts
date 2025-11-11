import type { VoiceAgentSettings, STTModel } from "@shared/settings-schema";

const SUPPORTED_REALTIME_MODELS: ReadonlySet<STTModel> = new Set([
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "whisper-1",
]);

export interface RealtimeSttCapability {
  /**
   * User explicitly enabled realtime via settings.
   */
  requested: boolean;
  /**
   * True when there are no blockers and we can create a realtime session.
   */
  isSupported: boolean;
  /**
   * Blocking reasons when realtime cannot be used.
   */
  blockers: string[];
  /**
   * Non-blocking notes that we can surface to the UI.
   */
  warnings: string[];
  /**
    * Normalized configuration applied to the OpenAI Realtime session.
    */
  config?: {
    model: STTModel;
    language?: string;
    prompt?: string;
    includeLogProbs: boolean;
    noiseReduction: "near_field" | "far_field" | null;
    turnDetection: "manual" | "server_vad";
  };
}

/**
 * Validate current voice settings and return whether realtime STT can run.
 */
export function resolveRealtimeSttCapability(settings: VoiceAgentSettings): RealtimeSttCapability {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!settings.realtimeSttEnabled) {
    return {
      requested: false,
      isSupported: false,
      blockers: ["Realtime STT disabled in user settings"],
      warnings,
    };
  }

  if (!SUPPORTED_REALTIME_MODELS.has(settings.sttModel)) {
    blockers.push(`Modelo ${settings.sttModel} não é suportado na API Realtime`);
  }

  if (settings.sttResponseFormat === "diarized_json") {
    blockers.push("Realtime STT não oferece diarização no momento");
  }

  if (settings.sttTimestampGranularity !== "none") {
    warnings.push("Realtime ignora granularidade de timestamps; usando padrão");
  }

  if (settings.sttTemperature !== 0) {
    warnings.push("Temperatura de STT não é suportada em realtime; ignorando valor");
  }

  const prompt = settings.sttPrompt?.trim();

  const capability: RealtimeSttCapability = {
    requested: true,
    isSupported: blockers.length === 0,
    blockers,
    warnings,
  };

  if (capability.isSupported) {
    capability.config = {
      model: settings.sttModel,
      language: settings.sttLanguage || undefined,
      prompt: prompt || undefined,
      includeLogProbs: true,
      noiseReduction: "near_field",
      turnDetection: "manual",
    };
  }

  return capability;
}
