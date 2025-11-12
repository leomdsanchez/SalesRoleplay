import { openai } from "../services/openai";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { logger } from "@shared/logger";
import {
  type STTModel,
  type STTResponseFormat,
  type STTTimestampGranularity,
} from "@shared/settings-schema";
import type { TranscriptMetadata } from "@shared/voice-types";

export interface STTResult {
  text: string;
  metadata: TranscriptMetadata;
}

export interface TranscribeAudioOptions {
  format?: "webm" | "mp3" | "wav" | "mp4";
  model?: STTModel;
  language?: string;
  responseFormat?: STTResponseFormat;
  timestampGranularity?: STTTimestampGranularity;
  temperature?: number;
  prompt?: string;
}

/**
 * Transcribe audio using OpenAI Whisper API or GPT-4o-transcribe
 * Saves audio to temp file and uses createReadStream (works better than toFile)
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options: TranscribeAudioOptions = {}
): Promise<STTResult> {
  let tempFilePath: string | null = null;
  const {
    format = "webm",
    model = "whisper-1",
    language = "pt",
    responseFormat = "json",
    timestampGranularity = "none",
    temperature = 0,
    prompt = "",
  } = options;

  try {
    logger.debug(
      `[STT] Transcribing audio (${audioBuffer.length} bytes, format=${format}, model=${model}, language=${language}, responseFormat=${responseFormat})`
    );

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
    const firstBytes = audioBuffer.slice(0, 20).toString("hex");
    logger.debug(`[STT] Temp file saved: ${tempFilePath}`);
    logger.debug(`[STT] File size=${fileStats.size} firstBytes=${firstBytes}`);

    let transcription: any;

    const coerceResponseFormat = (
      requested: STTResponseFormat,
      model: STTModel
    ): STTResponseFormat => {
      const supportsVerbose = model === "whisper-1";
      const supportsDiarized = model === "gpt-4o-transcribe-diarize";
      if (requested === "verbose_json" && !supportsVerbose) {
        console.warn(`[STT] Model ${model} does not support verbose_json. Falling back to json.`);
        return "json";
      }
      if (requested === "diarized_json" && !supportsDiarized) {
        console.warn(`[STT] Model ${model} does not support diarized_json. Falling back to json.`);
        return "json";
      }
      if (requested === "verbose_json" && supportsVerbose) {
        return requested;
      }
      if (requested === "diarized_json" && supportsDiarized) {
        return requested;
      }
      return requested;
    };

    const normalizedFormat = coerceResponseFormat(responseFormat, model);

    const requestPayload: any = {
      file: fs.createReadStream(tempFilePath) as any,
      model,
      language,
      response_format: normalizedFormat,
    };

    if (typeof temperature === "number") {
      requestPayload.temperature = Math.max(0, Math.min(1, temperature));
    }

    if (prompt?.trim()) {
      requestPayload.prompt = prompt.trim();
    }

    const timestampMap: Record<string, Array<"segment" | "word"> | undefined> = {
      none: undefined,
      segment: ["segment"],
      word: ["word"],
      segment_and_word: ["segment", "word"],
    };

    if (model === "whisper-1") {
      if (normalizedFormat === "verbose_json") {
        const mapped = timestampMap[timestampGranularity];
        if (mapped) {
          requestPayload.timestamp_granularities = mapped;
        }
      } else if (timestampGranularity !== "none") {
        console.warn(
          `[STT] Timestamp granularity "${timestampGranularity}" requires verbose_json response format. Current format: ${normalizedFormat}`
        );
      }
    } else if (timestampGranularity !== "none") {
      console.warn("[STT] Timestamp granularities are only supported for whisper-1. Ignoring setting.");
    }

    transcription = await openai.audio.transcriptions.create(requestPayload);

    const isStringResponse = typeof transcription === "string";
    const extractedText = isStringResponse
      ? transcription
      : typeof transcription?.text === "string"
        ? transcription.text
        : "";

    logger.debug(`[STT] Transcription successful: ${extractedText.substring(0, 50)}...`);

    const structured = isStringResponse ? undefined : transcription;
    const metadata: TranscriptMetadata = {
      format: normalizedFormat,
    };

    if (structured) {
      metadata.raw = structured;
      if (typeof structured?.duration === "number") {
        metadata.durationSeconds = structured.duration;
      } else if (typeof structured?.usage?.seconds === "number") {
        metadata.durationSeconds = structured.usage.seconds;
      }
      if (typeof structured?.language === "string") {
        metadata.language = structured.language;
      }
      if (Array.isArray(structured?.segments)) {
        metadata.segments = structured.segments;
        if (normalizedFormat === "diarized_json" || model === "gpt-4o-transcribe-diarize") {
          metadata.diarizedSegments = structured.segments;
        }
      }
      if (Array.isArray(structured?.words)) {
        metadata.words = structured.words;
      }
    }

    return {
      text: extractedText,
      metadata,
    };
  } catch (error) {
    logger.error("[STT] Error", error);
    throw new Error(`Speech-to-text failed: ${error}`);
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        logger.debug(`[STT] Temp file deleted: ${tempFilePath}`);
      } catch (e) {
        logger.error("[STT] Failed to delete temp file", e);
      }
    }
  }
}
