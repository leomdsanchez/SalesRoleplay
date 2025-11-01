import type { WebSocket } from "ws";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { transcribeAudio } from "./stt";
import { streamLLMResponse } from "./llm-streaming";
import { textToSpeech, type TTSVoice } from "./tts";
import {
  VoiceMessageType,
  type VoiceMessage,
  type AudioChunkMessage,
  type StartSessionMessage,
} from "@shared/voice-types";

export class VoiceSession {
  private ws: WebSocket;
  private conversationHistory: ChatCompletionMessageParam[] = [];
  private audioBuffer: Buffer[] = [];
  private isProcessing = false;
  private userId?: string;
  private voice: TTSVoice = "alloy";

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.setupMessageHandlers();
  }

  private setupMessageHandlers() {
    this.ws.on("message", async (data: Buffer) => {
      try {
        const message: VoiceMessage = JSON.parse(data.toString());
        await this.handleMessage(message);
      } catch (error) {
        console.error("Message handling error:", error);
        this.sendError("Invalid message format");
      }
    });

    this.ws.on("close", () => {
      console.log("Voice session closed");
    });

    this.ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  }

  private async handleMessage(message: VoiceMessage) {
    switch (message.type) {
      case VoiceMessageType.START_SESSION:
        await this.handleStartSession(message as StartSessionMessage);
        break;

      case VoiceMessageType.AUDIO_CHUNK:
        await this.handleAudioChunk(message as AudioChunkMessage);
        break;

      case VoiceMessageType.END_SESSION:
        this.ws.close();
        break;

      default:
        this.sendError(`Unknown message type: ${message.type}`);
    }
  }

  private async handleStartSession(message: StartSessionMessage) {
    this.userId = message.data.userId;
    
    this.send({
      type: VoiceMessageType.SESSION_STARTED,
      data: { sessionId: Date.now().toString() },
    });
  }

  private async handleAudioChunk(message: AudioChunkMessage) {
    if (this.isProcessing) {
      // Buffer audio if already processing
      const audioBuffer = Buffer.from(message.data.audio, "base64");
      this.audioBuffer.push(audioBuffer);
      return;
    }

    this.isProcessing = true;

    try {
      // Step 1: Speech-to-Text
      const audioBuffer = Buffer.from(message.data.audio, "base64");
      const { text: userText } = await transcribeAudio(
        audioBuffer,
        message.data.format
      );

      // Send transcript to client
      this.send({
        type: VoiceMessageType.TRANSCRIPT,
        data: { text: userText, isFinal: true },
      });

      // Step 2: LLM Streaming with sentence chunking and tool calls
      const textChunks: string[] = [];
      const toolCalls: any[] = [];

      for await (const chunk of streamLLMResponse(
        userText,
        this.conversationHistory
      )) {
        // Handle tool calls
        if (chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
          
          // Notify client about tool call
          this.send({
            type: VoiceMessageType.TOOL_CALL,
            data: {
              name: chunk.toolCall.name,
              arguments: JSON.parse(chunk.toolCall.arguments || "{}"),
            },
          });

          // Execute tool and get result
          const { executeTool } = await import("./tools");
          const result = await executeTool(
            chunk.toolCall.name,
            chunk.toolCall.arguments,
            this.userId
          );

          // Send tool result back to client
          this.send({
            type: VoiceMessageType.TOOL_CALL,
            data: {
              name: chunk.toolCall.name,
              arguments: JSON.parse(chunk.toolCall.arguments || "{}"),
              result,
            },
          });

          continue;
        }

        // Handle text chunks
        if (chunk.text) {
          // Send text chunk to client (for UI streaming)
          this.send({
            type: VoiceMessageType.AGENT_TEXT,
            data: { text: chunk.text, isComplete: chunk.isComplete },
          });

          // Accumulate for history (only sentences)
          if (chunk.isSentence) {
            textChunks.push(chunk.text);
            
            // Step 3: Text-to-Speech (only for complete sentences)
            const audioBuffer = await textToSpeech(chunk.text, this.voice);
            const audioBase64 = audioBuffer.toString("base64");

            this.send({
              type: VoiceMessageType.AGENT_AUDIO,
              data: { audio: audioBase64, format: "mp3" },
            });
          }
        }
      }

      // Update conversation history
      this.conversationHistory.push(
        { role: "user", content: userText },
        { role: "assistant", content: textChunks.join(" ") }
      );

      // Process buffered audio if any
      if (this.audioBuffer.length > 0) {
        const nextAudio = this.audioBuffer.shift();
        if (nextAudio) {
          await this.handleAudioChunk({
            type: VoiceMessageType.AUDIO_CHUNK,
            data: {
              audio: nextAudio.toString("base64"),
              format: "webm",
            },
          });
        }
      }
    } catch (error) {
      console.error("Voice processing error:", error);
      this.sendError(`Processing failed: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private send(message: VoiceMessage) {
    if (this.ws.readyState === 1) {
      // OPEN
      this.ws.send(JSON.stringify({ ...message, timestamp: Date.now() }));
    }
  }

  private sendError(message: string) {
    this.send({
      type: VoiceMessageType.ERROR,
      data: { message },
    });
  }
}
