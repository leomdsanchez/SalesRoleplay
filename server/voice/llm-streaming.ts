import { openai } from "../services/openai";
import type { 
  ChatCompletionMessageParam,
  ChatCompletionChunk 
} from "openai/resources/chat/completions";
import { voiceAgentTools } from "./tools";
import { type VoiceAgentSettings, defaultSettings, isGPT5Model } from "@shared/settings-schema";

export interface StreamChunk {
  text?: string;
  isComplete: boolean;
  isSentence?: boolean; // true = complete sentence (for TTS), false = word chunk (for UI)
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
  conversationHistory: ChatCompletionMessageParam[] = [],
  settings?: VoiceAgentSettings
): AsyncGenerator<StreamChunk> {
  const effectiveSettings = settings || defaultSettings;
  const messages: ChatCompletionMessageParam[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // Prepare API parameters based on model type
  const isGPT5 = isGPT5Model(effectiveSettings.llmModel);
  const apiParams: any = {
    model: effectiveSettings.llmModel,
    messages,
    stream: true,
    temperature: effectiveSettings.temperature,
    top_p: effectiveSettings.topP,
    tools: voiceAgentTools,
    tool_choice: "auto",
  };

  // Use correct token parameter based on model
  if (isGPT5) {
    apiParams.max_completion_tokens = effectiveSettings.maxTokens;
    console.log(`[LLM] Using GPT-5 model ${effectiveSettings.llmModel} with max_completion_tokens: ${effectiveSettings.maxTokens}`);
  } else {
    apiParams.max_tokens = effectiveSettings.maxTokens;
    console.log(`[LLM] Using legacy model ${effectiveSettings.llmModel} with max_tokens: ${effectiveSettings.maxTokens}`);
  }

  const stream = await openai.chat.completions.create(apiParams);

  let buffer = "";
  let toolCallBuffer: any = null;
  const sentenceEndings = /[.!?]\s+/;
  let wordBuffer = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    
    // Handle tool calls
    if (delta?.tool_calls) {
      // Flush pending words
      if (wordBuffer.trim()) {
        yield {
          text: wordBuffer,
          isComplete: false,
          isSentence: false,
        };
        wordBuffer = "";
      }
      
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
    wordBuffer += content;

    // Stream text word-by-word for smooth UI
    if (wordBuffer.includes(" ")) {
      const words = wordBuffer.split(" ");
      const completeWords = words.slice(0, -1).join(" ");
      wordBuffer = words[words.length - 1];
      
      if (completeWords.trim()) {
        yield {
          text: completeWords,
          isComplete: false,
          isSentence: false,
        };
      }
    }

    // Check if we have a complete sentence (for TTS audio generation)
    const match = buffer.match(sentenceEndings);
    if (match) {
      // Flush remaining word buffer
      if (wordBuffer.trim()) {
        yield {
          text: wordBuffer,
          isComplete: false,
          isSentence: false,
        };
        wordBuffer = "";
      }
      
      const endIndex = match.index! + match[0].length;
      const sentence = buffer.slice(0, endIndex).trim();
      
      if (sentence) {
        yield {
          text: sentence,
          isComplete: false,
          isSentence: true, // This is a complete sentence for TTS
        };
      }

      buffer = buffer.slice(endIndex);
    }
  }

  // Flush any remaining words from wordBuffer
  if (wordBuffer.trim()) {
    console.log("[LLM] Flushing final words:", wordBuffer);
    yield {
      text: wordBuffer,
      isComplete: false,
      isSentence: false,
    };
    wordBuffer = "";
  }

  // Flush any remaining text from buffer (incomplete sentence)
  if (buffer.trim()) {
    console.log("[LLM] Flushing final buffer:", buffer);
    yield {
      text: buffer.trim(),
      isComplete: false,
      isSentence: true, // Treat as sentence for TTS
    };
  }

  // Yield tool call if present
  if (toolCallBuffer && toolCallBuffer.name) {
    yield {
      toolCall: toolCallBuffer,
      isComplete: false,
    };
  }

  // Final completion signal (no text)
  yield {
    text: "",
    isComplete: true,
  };
}

export async function getLLMResponse(
  userMessage: string,
  conversationHistory: ChatCompletionMessageParam[] = [],
  settings?: VoiceAgentSettings
): Promise<string> {
  const effectiveSettings = settings || defaultSettings;
  const messages: ChatCompletionMessageParam[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // Prepare API parameters based on model type
  const isGPT5 = isGPT5Model(effectiveSettings.llmModel);
  const apiParams: any = {
    model: effectiveSettings.llmModel,
    messages,
    temperature: effectiveSettings.temperature,
  };

  // Use correct token parameter based on model
  if (isGPT5) {
    apiParams.max_completion_tokens = effectiveSettings.maxTokens;
  } else {
    apiParams.max_tokens = effectiveSettings.maxTokens;
  }

  const response = await openai.chat.completions.create(apiParams);

  return response.choices[0]?.message?.content || "";
}
