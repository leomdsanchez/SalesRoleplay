import { openai } from "../services/openai";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface STTResult {
  text: string;
}

/**
 * Transcribe audio using OpenAI Whisper API
 * Saves audio to temp file and uses createReadStream (works better than toFile)
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  format: "webm" | "mp3" | "wav" = "webm"
): Promise<STTResult> {
  let tempFilePath: string | null = null;
  
  try {
    console.log(`Transcribing audio: ${audioBuffer.length} bytes, format: ${format}`);
    
    // Create temp directory if doesn't exist
    const tmpDir = path.join(process.cwd(), "data", "tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Save buffer to temp file (this is the trick that works!)
    const ext = format === "webm" ? "webm" : format;
    tempFilePath = path.join(tmpDir, `${randomUUID()}.${ext}`);
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    console.log(`Temp file saved: ${tempFilePath}, size: ${fs.statSync(tempFilePath).size}`);

    // Use createReadStream (this is what works in production!)
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath) as any,
      model: "whisper-1",
      language: "pt", // Portuguese - change if needed
      response_format: "text",
    });

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
