import { useState, useRef, useCallback, useEffect } from "react";
import {
  VoiceMessageType,
  type VoiceMessage,
  type TranscriptMessage,
  type AgentTextMessage,
  type AgentAudioMessage,
  type RagContextMessage,
  type RagReference,
  type ConfidenceUpdateMessage,
  type ErrorMessage,
} from "@shared/voice-types";

const DEBUG_VOICE_WS = false;
const debugLog = (...args: any[]) => {
  if (!DEBUG_VOICE_WS) return;
  console.debug("[VoiceWS]", ...args);
};

export interface VoiceWebSocketCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAgentText?: (text: string, isComplete: boolean, isSentence?: boolean) => void;
  onAgentAudio?: (audioBase64: string) => void;
  onSessionStarted?: () => void;
  onError?: (error: string) => void;
  onRagContext?: (references: RagReference[]) => void;
  onConfidence?: (value: number, reason?: string) => void;
}

export interface UseVoiceWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendAudio: (audioBlob: Blob) => Promise<void>;
  cancelStreaming: () => void;
}

/**
 * Hook para gerenciar WebSocket de voz
 * Encapsula conexão, envio de áudio e recebimento de mensagens
 */
export function useVoiceWebSocket(
  userId: string | undefined,
  callbacks: VoiceWebSocketCallbacks
): UseVoiceWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const handleMessage = useCallback(
    (message: VoiceMessage) => {
      if (DEBUG_VOICE_WS) {
        if (message.type === VoiceMessageType.AGENT_TEXT) {
          const { text, isComplete, isSentence } = (message as AgentTextMessage).data;
          debugLog("Received AGENT_TEXT", { text, isComplete, isSentence });
        } else if (message.type === VoiceMessageType.AGENT_AUDIO) {
          const audioMsg = message as AgentAudioMessage;
          debugLog("Received AGENT_AUDIO", { length: audioMsg.data.audio.length });
        } else {
          debugLog("Received", message.type, message);
        }
      }

      switch (message.type) {
        case VoiceMessageType.TRANSCRIPT:
          const transcriptMsg = message as TranscriptMessage;
          callbacks.onTranscript?.(transcriptMsg.data.text, transcriptMsg.data.isFinal);
          break;

        case VoiceMessageType.AGENT_TEXT:
          const textMsg = message as AgentTextMessage;
          callbacks.onAgentText?.(textMsg.data.text, textMsg.data.isComplete, textMsg.data.isSentence);
          break;

        case VoiceMessageType.AGENT_AUDIO:
          const audioMsg = message as AgentAudioMessage;
          callbacks.onAgentAudio?.(audioMsg.data.audio);
          break;

        case VoiceMessageType.SESSION_STARTED:
          console.log("[VoiceWS] Session started");
          callbacks.onSessionStarted?.();
          break;

        case VoiceMessageType.RAG_CONTEXT:
          const ragMsg = message as RagContextMessage;
          callbacks.onRagContext?.(ragMsg.data.references || []);
          break;

        case VoiceMessageType.CONFIDENCE_UPDATE:
          const confMsg = message as ConfidenceUpdateMessage;
          if (typeof confMsg.data.value === "number") {
            callbacks.onConfidence?.(confMsg.data.value, confMsg.data.reason);
          }
          break;

        case VoiceMessageType.ERROR:
          const errorMsg = message as ErrorMessage;
          {
            const errText = errorMsg.data?.message || "Unknown error";
            setError(errText);
            callbacks.onError?.(errText);
          }
          break;

        default:
          console.warn("[VoiceWS] Unknown message type:", message.type);
      }
    },
    [callbacks]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[VoiceWS] Already connected");
      return;
    }

    if (!userId) {
      console.warn("[VoiceWS] Cannot connect without userId");
      setError("User not authenticated");
      callbacks.onError?.("User not authenticated");
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || "localhost:5000";
      const url = `${protocol}//${host}/ws/voice`;

      console.log(`[VoiceWS] Connecting to ${url}`);

      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[VoiceWS] Connected");
        setIsConnected(true);
        setError(null);

        // Send session start
        ws.send(
          JSON.stringify({
            type: VoiceMessageType.START_SESSION,
            data: { userId },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message: VoiceMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error("[VoiceWS] Failed to parse message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[VoiceWS] Error:", err);
        setError("WebSocket error");
        callbacks.onError?.("WebSocket error");
      };

      ws.onclose = (event) => {
        console.log(`[VoiceWS] Disconnected: ${event.code} ${event.reason}`);
        setIsConnected(false);

        if (event.code !== 1000) {
          setError(`Connection closed unexpectedly (${event.code})`);
          callbacks.onError?.(`Connection closed: ${event.code}`);
        }
      };

      wsRef.current = ws;
    } catch (err: any) {
      console.error("[VoiceWS] Connection error:", err);
      setError(err.message);
      callbacks.onError?.(err.message);
    }
  }, [userId, handleMessage, callbacks]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log("[VoiceWS] Disconnecting...");
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
  }, []);

  // Auto-disconnect on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const cancelStreaming = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    console.log("[VoiceWS] Sending cancel streaming");
    wsRef.current.send(
      JSON.stringify({
        type: VoiceMessageType.CANCEL_STREAMING,
        data: {},
      })
    );
  }, []);

  const sendAudio = useCallback(async (audioBlob: Blob): Promise<void> => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[VoiceWS] Cannot send audio, not connected");
      return;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          console.log(`[VoiceWS] Sending audio: ${audioBlob.size} bytes`);

          wsRef.current?.send(
            JSON.stringify({
              type: VoiceMessageType.AUDIO_CHUNK,
              data: { audio: base64, format: "webm" },
            })
          );

          resolve();
        } catch (err: any) {
          console.error("[VoiceWS] Send error:", err);
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read audio blob"));
      };

      reader.readAsDataURL(audioBlob);
    });
  }, []);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    sendAudio,
    cancelStreaming,
  };
}
