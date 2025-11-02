import WebSocket from "ws";
import { streamLLMResponse } from "./llm-streaming";
import { textToSpeech } from "./tts";
import { transcribeAudio } from "./stt";
import { log, logger } from "@shared/logger";
import { settingsStorage } from "../storage/settings";
import { type VoiceAgentSettings } from "@shared/settings-schema";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
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
  private shouldCancelStreaming = false;
  private userId?: string;
  private settings?: VoiceAgentSettings;

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
        logger.error(`Message handling error: ${error}`);
        this.sendError("Invalid message format");
      }
    });

    this.ws.on("close", () => {
      log.ws("Voice session closed");
    });

    this.ws.on("error", (error) => {
      log.voice(`WebSocket error: ${error}`);
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

      case VoiceMessageType.CANCEL_STREAMING:
        log.voice("Cancelling streaming");
        this.shouldCancelStreaming = true;
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
    
    // Load user settings
    if (this.userId) {
      this.settings = settingsStorage.get(this.userId);
      log.voice(`Loaded settings for user ${this.userId}: llmModel=${this.settings.llmModel}, ttsVoice=${this.settings.ttsVoice}`);
    }
    
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
    this.shouldCancelStreaming = false; // Reset flag for new request

    try {
      // Step 1: Speech-to-Text
      const audioBuffer = Buffer.from(message.data.audio, "base64");
      const { text: userText } = await transcribeAudio(
        audioBuffer,
        message.data.format,
        this.settings?.sttModel,
        this.settings?.sttLanguage
      );

      // Send transcript to client
      this.send({
        type: VoiceMessageType.TRANSCRIPT,
        data: { text: userText, isFinal: true },
      });

      // Step 2: LLM Streaming with sentence chunking and tool calls
      const textChunks: string[] = [];
      const toolCalls: any[] = [];

      // Add system prompt if this is the first message
      const history = this.conversationHistory.length === 0 && this.settings?.systemPrompt
        ? [{ role: "system" as const, content: this.settings.systemPrompt }, ...this.conversationHistory]
        : this.conversationHistory;

      for await (const chunk of streamLLMResponse(
        userText,
        history,
        this.settings
      )) {
        // Check if streaming should be cancelled
        if (this.shouldCancelStreaming) {
          log.voice("Streaming cancelled by user");
          break;
        }

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
        if (chunk.text || chunk.isComplete) {
          // Send text chunk to client (for UI streaming)
          this.send({
            type: VoiceMessageType.AGENT_TEXT,
            data: { 
              text: chunk.text ?? "", 
              isComplete: chunk.isComplete,
              isSentence: chunk.isSentence ?? false,
            },
          });

          // Accumulate for history (only sentences)
          const sentenceText = chunk.text ?? "";
          if (chunk.isSentence && sentenceText) {
            textChunks.push(sentenceText);
            
            // Step 3: Text-to-Speech (only for complete sentences)
            const ttsVoice = this.settings?.ttsVoice || "alloy";
            const ttsModel = this.settings?.ttsModel || "tts-1";
            log.voice(`Generating TTS for sentence: "${sentenceText}" (voice: ${ttsVoice}, model: ${ttsModel})`);
            const audioBuffer = await textToSpeech(sentenceText, ttsVoice, ttsModel);
            const audioBase64 = audioBuffer.toString("base64");
            
            log.voice(`TTS generated: ${audioBuffer.length} bytes, base64 length: ${audioBase64.length}`);
            
            // Validate base64
            if (!audioBase64 || audioBase64.length < 100) {
              logger.error(`Invalid audio data: base64 length ${audioBase64.length}`);
              // Send error message to client
              this.send({
                type: VoiceMessageType.ERROR,
                data: { 
                  message: "Failed to generate audio for response",
                  code: "TTS_FAILED"
                },
              });
              return; // Skip sending invalid audio
            }

            // Validate that it's proper base64
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(audioBase64)) {
              logger.error(`Invalid base64 format`);
              this.send({
                type: VoiceMessageType.ERROR,
                data: { 
                  message: "Audio format error",
                  code: "INVALID_AUDIO_FORMAT"
                },
              });
              return;
            }

            this.send({
              type: VoiceMessageType.AGENT_AUDIO,
              data: { audio: audioBase64, format: "mp3" },
            });
            
            log.voice(`Audio sent to client (${audioBase64.length} chars)`);
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
      logger.error(`VoiceSession processing error: ${error}`);
      
      // Send more specific error messages based on error type
      let errorMessage = "Processing failed";
      if (error instanceof Error) {
        if (error.message.includes("max_tokens") || error.message.includes("max_completion_tokens")) {
          errorMessage = "Model configuration error - please check your settings";
        } else if (error.message.includes("transcribe")) {
          errorMessage = "Speech recognition failed - please try again";
        } else if (error.message.includes("speech")) {
          errorMessage = "Audio generation failed - continuing with text only";
        } else {
          errorMessage = `Processing error: ${error.message}`;
        }
      }
      
      this.sendError(errorMessage);
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
