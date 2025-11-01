import { openai } from "../services/openai";

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

/**
 * Convert text to speech using OpenAI TTS API
 * Uses tts-1 model (optimized for speed)
 */
export async function textToSpeech(
  text: string,
  voice: TTSVoice = "alloy"
): Promise<Buffer> {
  try {
    const mp3Response = await openai.audio.speech.create({
      model: "tts-1", // Fast model, use tts-1-hd for better quality
      voice: voice,
      input: text,
      response_format: "mp3",
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("TTS Error:", error);
    throw new Error(`Text-to-speech failed: ${error}`);
  }
}
