import { describe, it, expect, vi, beforeEach } from "vitest";
import { textToSpeech } from "../../server/voice/tts";
import * as openaiService from "../../server/services/openai";

// Mock OpenAI
vi.mock("../../server/services/openai", () => ({
  openai: {
    audio: {
      speech: {
        create: vi.fn(),
      },
    },
  },
}));

describe("TTS (Text-to-Speech)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should convert text to speech successfully", async () => {
    const mockAudioBuffer = Buffer.from("fake audio data");
    const mockArrayBuffer = mockAudioBuffer.buffer.slice(
      mockAudioBuffer.byteOffset,
      mockAudioBuffer.byteOffset + mockAudioBuffer.byteLength
    );

    vi.mocked(openaiService.openai.audio.speech.create).mockResolvedValue({
      arrayBuffer: async () => mockArrayBuffer,
    } as any);

    const result = await textToSpeech("Hello world", "alloy");

    expect(result).toBeInstanceOf(Buffer);
    expect(openaiService.openai.audio.speech.create).toHaveBeenCalledWith({
      model: "tts-1",
      voice: "alloy",
      input: "Hello world",
      response_format: "mp3",
    });
  });

  it("should handle TTS errors", async () => {
    vi.mocked(openaiService.openai.audio.speech.create).mockRejectedValue(
      new Error("API error")
    );

    await expect(textToSpeech("Test", "alloy")).rejects.toThrow(
      "Text-to-speech failed"
    );
  });

  it("should support different voices", async () => {
    const mockAudioBuffer = Buffer.from("fake audio data");
    const mockArrayBuffer = mockAudioBuffer.buffer.slice(
      mockAudioBuffer.byteOffset,
      mockAudioBuffer.byteOffset + mockAudioBuffer.byteLength
    );

    vi.mocked(openaiService.openai.audio.speech.create).mockResolvedValue({
      arrayBuffer: async () => mockArrayBuffer,
    } as any);

    await textToSpeech("Test", "echo");
    await textToSpeech("Test", "nova");

    expect(openaiService.openai.audio.speech.create).toHaveBeenCalledTimes(2);
    expect(openaiService.openai.audio.speech.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ voice: "echo" })
    );
    expect(openaiService.openai.audio.speech.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ voice: "nova" })
    );
  });

  it("should use tts-1 model for speed", async () => {
    const mockAudioBuffer = Buffer.from("fake audio data");
    const mockArrayBuffer = mockAudioBuffer.buffer.slice(
      mockAudioBuffer.byteOffset,
      mockAudioBuffer.byteOffset + mockAudioBuffer.byteLength
    );

    vi.mocked(openaiService.openai.audio.speech.create).mockResolvedValue({
      arrayBuffer: async () => mockArrayBuffer,
    } as any);

    await textToSpeech("Test");

    expect(openaiService.openai.audio.speech.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "tts-1" })
    );
  });
});
