import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamLLMResponse, getLLMResponse } from "../../server/voice/llm-streaming";
import * as openaiService from "../../server/services/openai";

// Mock OpenAI
vi.mock("../../server/services/openai", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

describe("LLM Streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("streamLLMResponse", () => {
    it("should stream text chunks with sentence boundaries", async () => {
      // Mock streaming response
      const mockChunks = [
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: { content: " there." } }] },
        { choices: [{ delta: { content: " How are" } }] },
        { choices: [{ delta: { content: " you?" } }] },
      ];

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };

      vi.mocked(openaiService.openai.chat.completions.create).mockResolvedValue(
        mockStream as any
      );

      const chunks: any[] = [];
      for await (const chunk of streamLLMResponse("Test message")) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.text)).toBe(true);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
    });

    it("should handle tool calls in stream", async () => {
      const mockChunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: "call_123",
                    function: { name: "search_knowledge_base", arguments: "" },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    function: { arguments: '{"query":"test"}' },
                  },
                ],
              },
            },
          ],
        },
      ];

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };

      vi.mocked(openaiService.openai.chat.completions.create).mockResolvedValue(
        mockStream as any
      );

      const chunks: any[] = [];
      for await (const chunk of streamLLMResponse("Search something")) {
        chunks.push(chunk);
      }

      const toolCallChunk = chunks.find((c) => c.toolCall);
      expect(toolCallChunk).toBeDefined();
      expect(toolCallChunk.toolCall.name).toBe("search_knowledge_base");
    });

    it("should include conversation history", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: "Response." } }] };
        },
      };

      vi.mocked(openaiService.openai.chat.completions.create).mockResolvedValue(
        mockStream as any
      );

      const history = [
        { role: "user" as const, content: "Previous message" },
        { role: "assistant" as const, content: "Previous response" },
      ];

      for await (const chunk of streamLLMResponse("New message", history)) {
        // Just iterate
      }

      expect(openaiService.openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: "user", content: "Previous message" },
            { role: "assistant", content: "Previous response" },
            { role: "user", content: "New message" },
          ]),
        })
      );
    });
  });

  describe("getLLMResponse", () => {
    it("should get non-streaming response", async () => {
      vi.mocked(openaiService.openai.chat.completions.create).mockResolvedValue({
        choices: [{ message: { content: "Test response" } }],
      } as any);

      const result = await getLLMResponse("Test message");

      expect(result).toBe("Test response");
      expect(openaiService.openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o-mini",
          messages: expect.arrayContaining([
            { role: "user", content: "Test message" },
          ]),
        })
      );
    });

    it("should handle empty response", async () => {
      vi.mocked(openaiService.openai.chat.completions.create).mockResolvedValue({
        choices: [{ message: {} }],
      } as any);

      const result = await getLLMResponse("Test");

      expect(result).toBe("");
    });
  });
});
