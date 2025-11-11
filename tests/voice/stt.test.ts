import { describe, it, expect, vi, beforeEach } from "vitest";
import { transcribeAudio } from "../../server/voice/stt";
import * as openaiService from "../../server/services/openai";

// Mock OpenAI
vi.mock("../../server/services/openai", () => ({
  openai: {
    audio: {
      transcriptions: {
        create: vi.fn(),
      },
    },
  },
}));

describe("STT (Speech-to-Text)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should transcribe audio buffer successfully with text response", async () => {
    const mockTranscription = "Hello, this is a test";
    
    vi.mocked(openaiService.openai.audio.transcriptions.create).mockResolvedValue(
      mockTranscription as any
    );

    const audioBuffer = Buffer.from("fake audio data");
    const result = await transcribeAudio(audioBuffer, { format: "webm", responseFormat: "text" });

    expect(result.text).toBe(mockTranscription);
    expect(result.metadata.format).toBe("text");
    expect(openaiService.openai.audio.transcriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "whisper-1",
        language: "pt",
        response_format: "text",
      })
    );
  });

  it("should capture structured metadata for verbose_json", async () => {
    const mockTranscription = {
      text: "Hola Ana",
      duration: 3.2,
      language: "es",
      segments: [{ start: 0, end: 1.5, text: "Hola" }],
      words: [{ start: 0, end: 0.3, word: "Hola" }],
    };
    
    vi.mocked(openaiService.openai.audio.transcriptions.create).mockResolvedValue(
      mockTranscription as any
    );

    const audioBuffer = Buffer.from("fake audio data");
    const result = await transcribeAudio(audioBuffer, {
      format: "webm",
      responseFormat: "verbose_json",
      timestampGranularity: "word",
    });

    expect(result.text).toBe("Hola Ana");
    expect(result.metadata.format).toBe("verbose_json");
    expect(result.metadata.durationSeconds).toBe(3.2);
    expect(result.metadata.language).toBe("es");
    expect(result.metadata.segments).toEqual(mockTranscription.segments);
    expect(result.metadata.words).toEqual(mockTranscription.words);
    expect(openaiService.openai.audio.transcriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      })
    );
  });

  it("should handle transcription errors", async () => {
    vi.mocked(openaiService.openai.audio.transcriptions.create).mockRejectedValue(
      new Error("API error")
    );

    const audioBuffer = Buffer.from("fake audio data");

    await expect(transcribeAudio(audioBuffer, { format: "webm" })).rejects.toThrow(
      "Speech-to-text failed"
    );
  });

  it("should support different audio formats", async () => {
    const mockTranscription = { text: "Test audio" };
    
    vi.mocked(openaiService.openai.audio.transcriptions.create).mockResolvedValue(
      mockTranscription as any
    );

    const audioBuffer = Buffer.from("fake audio data");
    
    await transcribeAudio(audioBuffer, { format: "mp3" });
    await transcribeAudio(audioBuffer, { format: "wav" });

    expect(openaiService.openai.audio.transcriptions.create).toHaveBeenCalledTimes(2);
  });
});
