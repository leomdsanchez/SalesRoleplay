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

  it("should transcribe audio buffer successfully", async () => {
    const mockTranscription = "Hello, this is a test";
    
    vi.mocked(openaiService.openai.audio.transcriptions.create).mockResolvedValue(
      mockTranscription as any
    );

    const audioBuffer = Buffer.from("fake audio data");
    const result = await transcribeAudio(audioBuffer, "webm");

    expect(result.text).toBe(mockTranscription);
    expect(openaiService.openai.audio.transcriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "whisper-1",
        language: "pt",
        response_format: "text",
      })
    );
  });

  it("should handle transcription errors", async () => {
    vi.mocked(openaiService.openai.audio.transcriptions.create).mockRejectedValue(
      new Error("API error")
    );

    const audioBuffer = Buffer.from("fake audio data");

    await expect(transcribeAudio(audioBuffer, "webm")).rejects.toThrow(
      "Speech-to-text failed"
    );
  });

  it("should support different audio formats", async () => {
    const mockTranscription = "Test audio";
    
    vi.mocked(openaiService.openai.audio.transcriptions.create).mockResolvedValue(
      mockTranscription as any
    );

    const audioBuffer = Buffer.from("fake audio data");
    
    await transcribeAudio(audioBuffer, "mp3");
    await transcribeAudio(audioBuffer, "wav");

    expect(openaiService.openai.audio.transcriptions.create).toHaveBeenCalledTimes(2);
  });
});
