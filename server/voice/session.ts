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

type QueuedAudioChunk = {
  buffer: Buffer;
  format: AudioChunkMessage["data"]["format"];
};

export class VoiceSession {
  private ws: WebSocket;
  private conversationHistory: ChatCompletionMessageParam[] = [];
  private audioBuffer: QueuedAudioChunk[] = [];
  private isProcessing = false;
  private shouldCancelStreaming = false;
  private partialTurns = new Map<
    string,
    { chunks: Buffer[]; format: AudioChunkMessage["data"]["format"]; chunkCount?: number }
  >();
  private userId?: string;
  private settings?: VoiceAgentSettings;
  private currentConfidence = 0;
  private coachNotes = "sessão iniciada";
  private confidenceLocked = false;
  private coachSpeechMetrics: {
    fillerRate: number | null;
    speechNotes: string | null;
  } = {
    fillerRate: null,
    speechNotes: null,
  };

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
    this.coachNotes = "sessão iniciada";
    this.confidenceLocked = false;
    this.coachSpeechMetrics = {
      fillerRate: null,
      speechNotes: null,
    };
    
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
    const audioBuffer = Buffer.from(message.data.audio, "base64");
    const format = message.data.format ?? "webm";
    const turnId = message.data.turnId;
    const isLast = message.data.isLast ?? true;

    if (turnId) {
      const entry =
        this.partialTurns.get(turnId) ??
        {
          chunks: [],
          format,
          chunkCount: message.data.chunkCount,
        };

      entry.chunks.push(audioBuffer);
      entry.format = format;
      if (typeof message.data.chunkCount === "number") {
        entry.chunkCount = message.data.chunkCount;
      }

      this.partialTurns.set(turnId, entry);

      if (!isLast) {
        return;
      }

      this.partialTurns.delete(turnId);
      const combined = Buffer.concat(entry.chunks);
      this.enqueueAudioTurn({ buffer: combined, format: entry.format });
      return;
    }

    this.enqueueAudioTurn({ buffer: audioBuffer, format });
  }

  private enqueueAudioTurn(chunk: QueuedAudioChunk) {
    if (this.isProcessing) {
      this.audioBuffer.push(chunk);
      return;
    }
    void this.startProcessing(chunk);
  }

  private async startProcessing(chunk: QueuedAudioChunk) {
    this.isProcessing = true;
    this.shouldCancelStreaming = false;

    try {
      await this.processCompleteTurn(chunk.buffer, chunk.format);
    } catch (error) {
      this.handleProcessingError(error);
    } finally {
      this.isProcessing = false;
      if (this.audioBuffer.length > 0) {
        const nextAudio = this.audioBuffer.shift();
        if (nextAudio) {
          void this.startProcessing(nextAudio);
        }
      }
    }
  }

  private handleProcessingError(error: unknown) {
    logger.error(`VoiceSession processing error: ${error}`);

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
  }

  private async processCompleteTurn(
    audioBuffer: Buffer,
    format: AudioChunkMessage["data"]["format"]
  ) {
    // Step 1: Speech-to-Text
    const { text: userText, metadata: transcriptMetadata } = await transcribeAudio(audioBuffer, {
      format,
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

    log.llm(`userText: ${userText}`);

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
      notes: this.coachNotes,
    };
    const confidenceLine = `Confiança atual (JSON): ${JSON.stringify(confidencePayload)}. Ajuste seu comportamento com base nesse nível.`;
    systemContent = `${systemContent}\n\n${confidenceLine}`.trim();

    if (systemContent) {
      history.push({ role: "system", content: systemContent });
    }

    history.push(...this.conversationHistory);
    log.llm(`historyCount=${history.length}`);
    log.llm(`historyPayload=${JSON.stringify(history, null, 2)}`);
    if (ragResults.length) {
      log.llm(`ragReferences=${JSON.stringify(ragResults, null, 2)}`);
    }

    for await (const chunk of streamLLMResponse(userText, history, this.settings)) {
      if (this.shouldCancelStreaming) {
        log.voice("Streaming cancelled by user");
        break;
      }

      if (chunk.toolCall) {
        const { executeTool } = await import("./tools");
        this.send({
          type: VoiceMessageType.TOOL_CALL,
          data: {
            name: chunk.toolCall.name,
            arguments: JSON.parse(chunk.toolCall.arguments || "{}"),
          },
        });
        const result = await executeTool(chunk.toolCall.name, chunk.toolCall.arguments, this.userId);
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

      if (chunk.text || chunk.isComplete) {
        this.send({
          type: VoiceMessageType.AGENT_TEXT,
          data: {
            text: chunk.text ?? "",
            isComplete: chunk.isComplete,
            isSentence: chunk.isSentence ?? false,
          },
        });

        const sentenceText = chunk.text ?? "";
        if (chunk.isSentence && sentenceText) {
          textChunks.push(sentenceText);

          const ttsVoice = this.settings?.ttsVoice || "alloy";
          const ttsModel = this.settings?.ttsModel || "tts-1";
          log.voice(`Generating TTS for sentence: "${sentenceText}" (voice: ${ttsVoice}, model: ${ttsModel})`);
          const agentAudio = await textToSpeech(sentenceText, ttsVoice, ttsModel);
          const audioBase64 = agentAudio.toString("base64");

          log.voice(`TTS generated: ${agentAudio.length} bytes, base64 length: ${audioBase64.length}`);

          if (!audioBase64 || audioBase64.length < 100) {
            logger.error(`Invalid audio data: base64 length ${audioBase64.length}`);
            this.send({
              type: VoiceMessageType.ERROR,
              data: {
                message: "Failed to generate audio for response",
                code: "TTS_FAILED",
              },
            });
            return;
          }

          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(audioBase64)) {
            logger.error(`Invalid base64 format`);
            this.send({
              type: VoiceMessageType.ERROR,
              data: {
                message: "Audio format error",
                code: "INVALID_AUDIO_FORMAT",
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

    this.conversationHistory.push(
      { role: "user", content: userText },
      { role: "assistant", content: textChunks.join(" ") }
    );
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
    if (!this.settings?.coachModel) {
      return;
    }

    try {
      const coachMessages: ChatCompletionMessageParam[] = [
        ...this.conversationHistory,
        { role: "user", content: userText },
      ];

      const result = await evaluateConfidence({
        model: this.settings.coachModel,
        prompt: this.settings.coachPrompt || "",
        messages: coachMessages,
      });

      this.currentConfidence = result.confidence;
      if (typeof result.speechNotes === "string") {
        this.coachNotes = result.speechNotes;
      }
      this.coachSpeechMetrics = {
        fillerRate: result.fillerRate ?? null,
        speechNotes: result.speechNotes ?? null,
      };
      if (this.currentConfidence <= -1) {
        this.confidenceLocked = true;
        this.sendConfidenceUpdate(result.speechNotes ?? undefined);
        this.sendError("Confiança caiu para o mínimo. Reinicie a sessão para tentar novamente.");
      } else {
        this.sendConfidenceUpdate(result.speechNotes ?? undefined);
      }
    } catch (error) {
      logger.error("Coach error", error);
    }
  }

  private sendConfidenceUpdate(reason?: string) {
    this.send({
      type: VoiceMessageType.CONFIDENCE_UPDATE,
      data: {
        confidence: this.currentConfidence,
        speechNotes: reason ?? this.coachNotes,
        fillerRate: this.coachSpeechMetrics.fillerRate,
        source: "coach",
      },
    });
  }
}
