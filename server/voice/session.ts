import WebSocket from "ws";
import { streamLLMResponse } from "./llm-streaming";
import { textToSpeech } from "./tts";
import { transcribeAudio } from "./stt";
import { log, logger } from "@shared/logger";
import { settingsStorage } from "../storage/settings";
import { type VoiceAgentSettings, defaultSettings } from "@shared/settings-schema";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  VoiceMessageType,
  type VoiceMessage,
  type AudioChunkMessage,
  type StartSessionMessage,
} from "@shared/voice-types";
import { ragSearch } from "../rag/service";
import { evaluateConfidence } from "./confidence-coach";

export class VoiceSession {
  private ws: WebSocket;
  private conversationHistory: ChatCompletionMessageParam[] = [];
  private audioBuffer: Buffer[] = [];
  private isProcessing = false;
  private shouldCancelStreaming = false;
  private userId?: string;
  private settings?: VoiceAgentSettings;
  private currentConfidence = 0;
  private confidenceReason = "sessão iniciada";
  private confidenceLocked = false;

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
    this.currentConfidence = 0;
    this.confidenceReason = "sessão iniciada";
    this.confidenceLocked = false;
    
    // Load user settings
    if (this.userId) {
      this.settings = settingsStorage.get(this.userId);
      log.voice(`Loaded settings for user ${this.userId}: llmModel=${this.settings.llmModel}, ttsVoice=${this.settings.ttsVoice}`);
    }
    
    this.send({
      type: VoiceMessageType.SESSION_STARTED,
      data: { sessionId: Date.now().toString() },
    });

    this.sendConfidenceUpdate();
  }

  private async handleAudioChunk(message: AudioChunkMessage) {
    if (this.confidenceLocked) {
      this.sendError("Confiança mínima atingida. Recarregue a página para iniciar outra sessão.");
      return;
    }
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
      const { text: userText, metadata: transcriptMetadata } = await transcribeAudio(audioBuffer, {
        format: message.data.format,
        model: this.settings?.sttModel,
        language: this.settings?.sttLanguage,
        responseFormat: this.settings?.sttResponseFormat,
        timestampGranularity: this.settings?.sttTimestampGranularity,
        temperature: this.settings?.sttTemperature,
        prompt: this.settings?.sttPrompt,
      });

      // Send transcript to client
      this.send({
        type: VoiceMessageType.TRANSCRIPT,
        data: { text: userText, isFinal: true, metadata: transcriptMetadata },
      });

      await this.updateConfidence(userText);

      logger.info("[Prompt] userText", userText);

      const ragLimit = this.settings?.ragReferenceLimit ?? 3;
      const ragResults = ragLimit > 0 ? await ragSearch(userText, ragLimit) : [];

      if (ragResults.length) {
        logger.info(
          `[RAG] ${ragResults.length} matches -> ${ragResults
            .map((ref) => `${ref.source}:${ref.score.toFixed(2)}`)
            .join(", ")}`
        );
        this.send({
          type: VoiceMessageType.RAG_CONTEXT,
          data: { references: ragResults },
        });
      }

      // Step 2: LLM Streaming with sentence chunking and tool calls
      const textChunks: string[] = [];
      const toolCalls: any[] = [];

      const history: ChatCompletionMessageParam[] = [];

      let systemContent = this.settings?.systemPrompt || "";
      if (ragResults.length) {
        const references = ragResults
          .map((result, idx) => {
            const prompt = result.metadata?.prompt || "";
            const combined = [prompt, result.text].filter(Boolean).join("\n");
            return `[${idx + 1}] (${result.source}) ${combined}`;
          })
          .join("\n\n");
        const intro = this.settings?.ragPromptIntro || defaultSettings.ragPromptIntro;
        systemContent = `${systemContent}\n\n${intro}\n${references}`.trim();
      }

      const confidencePayload = {
        trust_level: Number(this.currentConfidence.toFixed(2)),
        reason: this.confidenceReason,
      };
      const confidenceLine = `Confiança atual (JSON): ${JSON.stringify(confidencePayload)}. Ajuste seu comportamento com base nesse nível.`;
      systemContent = `${systemContent}\n\n${confidenceLine}`.trim();

      if (systemContent) {
        history.push({ role: "system", content: systemContent });
      }

      history.push(...this.conversationHistory);
      logger.info(`[Prompt] historyCount=${history.length}`);
      logger.info("[Prompt] historyPayload", JSON.stringify(history, null, 2));
      if (ragResults.length) {
        logger.info("[Prompt] ragReferences", JSON.stringify(ragResults, null, 2));
      }

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

  private async updateConfidence(userText: string) {
    if (!this.settings?.confidenceModel) {
      return;
    }

    try {
      const coachMessages: ChatCompletionMessageParam[] = [
        ...this.conversationHistory,
        { role: "user", content: userText },
      ];

      const result = await evaluateConfidence({
        model: this.settings.confidenceModel,
        prompt: this.settings.confidencePrompt || "",
        messages: coachMessages,
      });

      this.currentConfidence = result.confidence;
      this.confidenceReason = result.reason || this.confidenceReason;
      if (this.currentConfidence <= -1) {
        this.confidenceLocked = true;
        this.sendConfidenceUpdate(result.reason);
        this.sendError("Confiança caiu para o mínimo. Reinicie a sessão para tentar novamente.");
      } else {
        this.sendConfidenceUpdate(result.reason);
      }
    } catch (error) {
      logger.error("Confidence coach error", error);
    }
  }

  private sendConfidenceUpdate(reason?: string) {
    this.send({
      type: VoiceMessageType.CONFIDENCE_UPDATE,
      data: { value: this.currentConfidence, reason: reason ?? this.confidenceReason },
    });
  }
}
