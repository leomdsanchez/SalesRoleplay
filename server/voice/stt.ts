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
  format: "webm" | "mp3" | "wav" = "wav"
): Promise<STTResult> {
  try {
    console.log(`Transcribing audio: ${audioBuffer.length} bytes, format: ${format}`);
    
    // Map format to proper MIME type and extension
    const mimeTypes = {
      wav: { type: "audio/wav", ext: "wav" },
      mp3: { type: "audio/mp3", ext: "mp3" },
      webm: { type: "audio/webm", ext: "webm" },
    };
    
    const { type, ext } = mimeTypes[format] || mimeTypes.wav;
    
    // Convert buffer to File using OpenAI's helper
    const file = await toFile(audioBuffer, `audio.${ext}`, {
      type: type,
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
