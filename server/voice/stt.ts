import { openai } from "../services/openai";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface STTResult {
  text: string;
}

export type STTModel = "whisper-1" | "gpt-4o-transcribe";

/**
 * Transcribe audio using OpenAI Whisper API or GPT-4o-transcribe
 * Saves audio to temp file and uses createReadStream (works better than toFile)
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  format: "webm" | "mp3" | "wav" = "webm",
  model: STTModel = "whisper-1",
  language: string = "pt"
): Promise<STTResult> {
  let tempFilePath: string | null = null;

  try {
    console.log(`Transcribing audio: ${audioBuffer.length} bytes, format: ${format}, model: ${model}, language: ${language}`);

    // Create temp directory if doesn't exist
    const tmpDir = path.join(process.cwd(), "data", "tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Save buffer to temp file (this is the trick that works!)
    const ext = format === "webm" ? "webm" : format;
    tempFilePath = path.join(tmpDir, `${randomUUID()}.${ext}`);
    fs.writeFileSync(tempFilePath, audioBuffer);

    const fileStats = fs.statSync(tempFilePath);
    const firstBytes = audioBuffer.slice(0, 20).toString('hex');
    console.log(`Temp file saved: ${tempFilePath}`);
    console.log(`File size: ${fileStats.size}, First bytes (hex): ${firstBytes}`);

    let transcription: string;

    if (model === "gpt-4o-transcribe") {
      // Use GPT-4o-transcribe API
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath) as any,
        model: "gpt-4o-transcribe",
        language: language,
        response_format: "text",
      });
      transcription = response;
    } else {
      // Use legacy Whisper API
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath) as any,
        model: "whisper-1",
        language: language,
        response_format: "text",
      });
    }

    console.log(`Transcription successful: ${transcription.substring(0, 50)}...`);

    return {
      text: transcription,
    };
  } catch (error) {
    console.error("STT Error:", error);
    throw new Error(`Speech-to-text failed: ${error}`);
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Temp file deleted: ${tempFilePath}`);
      } catch (e) {
        console.error("Failed to delete temp file:", e);
      }
    }
  }
}
