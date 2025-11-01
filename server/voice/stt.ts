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
    console.log(`Transcribing audio: ${audioBuffer.length} bytes, format: ${format}`);
    
    // Convert buffer to File using OpenAI's helper
    // Use .webm extension explicitly
    const file = await toFile(audioBuffer, `audio.webm`, {
      type: "audio/webm",
    });

    console.log(`File created: name=${file.name}, type=${file.type}, size=${file.size}`);

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt", // Portuguese - change if needed
      response_format: "text",
    });

    console.log(`Transcription result: ${transcription}`);

    return {
      text: transcription,
    };
  } catch (error) {
    console.error("STT Error:", error);
    throw new Error(`Speech-to-text failed: ${error}`);
  }
}
