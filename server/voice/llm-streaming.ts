import { openai } from "../services/openai";
import type { 
  ChatCompletionMessageParam,
  ChatCompletionChunk 
} from "openai/resources/chat/completions";
import { voiceAgentTools } from "./tools";

export interface StreamChunk {
  text?: string;
  isComplete: boolean;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
}

/**
 * Stream LLM response with sentence-based chunking
 * Yields complete sentences for optimal TTS processing
 */
export async function* streamLLMResponse(
  userMessage: string,
  conversationHistory: ChatCompletionMessageParam[] = []
): AsyncGenerator<StreamChunk> {
  const messages: ChatCompletionMessageParam[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Fast and cheap, use gpt-4o for better quality
    messages,
    stream: true,
    temperature: 0.7,
    tools: voiceAgentTools,
    tool_choice: "auto",
  });

  let buffer = "";
  let toolCallBuffer: any = null;
  const sentenceEndings = /[.!?]\s+/;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    
    // Handle tool calls
    if (delta?.tool_calls) {
      const toolCall = delta.tool_calls[0];
      if (toolCall) {
        if (!toolCallBuffer) {
          toolCallBuffer = {
            id: toolCall.id || "",
            name: toolCall.function?.name || "",
            arguments: "",
          };
        }
        if (toolCall.function?.arguments) {
          toolCallBuffer.arguments += toolCall.function.arguments;
        }
      }
      continue;
    }

    // Handle text content
    const content = delta?.content || "";
    if (!content) continue;

    buffer += content;

    // Check if we have a complete sentence
    const match = buffer.match(sentenceEndings);
    if (match) {
      const endIndex = match.index! + match[0].length;
      const sentence = buffer.slice(0, endIndex).trim();
      
      if (sentence) {
        yield {
          text: sentence,
          isComplete: false,
        };
      }

      buffer = buffer.slice(endIndex);
    }
  }

  // Yield tool call if present
  if (toolCallBuffer && toolCallBuffer.name) {
    yield {
      toolCall: toolCallBuffer,
      isComplete: false,
    };
  }

  // Yield remaining buffer as final chunk
  if (buffer.trim()) {
    yield {
      text: buffer.trim(),
      isComplete: true,
    };
  } else if (!toolCallBuffer) {
    // If no text and no tool call, yield empty completion
    yield {
      text: "",
      isComplete: true,
    };
  }
}

/**
 * Simple non-streaming LLM call (for tool responses, etc.)
 */
export async function getLLMResponse(
  userMessage: string,
  conversationHistory: ChatCompletionMessageParam[] = []
): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "";
}
