import { openai } from "../services/openai";
import { toFile } from "openai/uploads";

export interface STTResult {
  text: string;
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  format: "webm" | "mp3" | "wav" = "webm"
): Promise<STTResult> {
  try {
    // Convert buffer to File using OpenAI's helper
    const file = await toFile(audioBuffer, `audio.${format}`, {
      type: format === "webm" ? "audio/webm" : `audio/${format}`,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt", // Portuguese - change if needed
      response_format: "text",
    });

    return {
      text: transcription,
    };
  } catch (error) {
    console.error("STT Error:", error);
    throw new Error(`Speech-to-text failed: ${error}`);
  }
}
