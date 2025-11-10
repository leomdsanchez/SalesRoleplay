import { openai } from "../services/openai";
import { log, logger } from "@shared/logger";

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type TTSModel = "tts-1" | "tts-1-hd" | "gpt-4o-mini-tts";

/**
 * Convert text to speech using OpenAI TTS API
 * Supports multiple models with different quality/speed trade-offs
 */
export async function textToSpeech(
  text: string,
  voice: TTSVoice = "alloy",
  model: TTSModel = "tts-1"
): Promise<Buffer> {
  try {
    log.audio(`Generating TTS: model=${model}, voice=${voice}, len=${text.length}`);

    let ttsModel: string;
    let responseFormat: "mp3" = "mp3";

    // Map our model names to OpenAI API model names
    switch (model) {
      case "gpt-4o-mini-tts":
        // Fallback to tts-1 if gpt-4o-mini-tts is not available/stable
        ttsModel = "tts-1"; // Temporarily use tts-1 for stability
        log.audio("[TTS] Using tts-1 instead of gpt-4o-mini-tts for stability");
        break;
      case "tts-1-hd":
        ttsModel = "tts-1-hd";
        break;
      case "tts-1":
      default:
        ttsModel = "tts-1";
        break;
    }

    const mp3Response = await openai.audio.speech.create({
      model: ttsModel,
      voice: voice,
      input: text,
      response_format: responseFormat,
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    log.audio(`TTS generated successfully: ${buffer.length} bytes, model: ${ttsModel}`);

    return buffer;
  } catch (error) {
    logger.error("TTS Error:", error);
    // Fallback to basic tts-1 if the requested model fails
    try {
      log.audio("[TTS] Attempting fallback to tts-1");
      const fallbackResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice,
        input: text,
        response_format: "mp3",
      });
      const buffer = Buffer.from(await fallbackResponse.arrayBuffer());
      log.audio(`TTS fallback successful: ${buffer.length} bytes`);
      return buffer;
    } catch (fallbackError) {
      logger.error("TTS Fallback Error:", fallbackError);
      throw new Error(`Text-to-speech failed: ${error}`);
    }
  }
}
