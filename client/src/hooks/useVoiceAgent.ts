import { useState, useCallback } from "react";
import { usePushToTalkRecorder } from "./usePushToTalkRecorder";
import { usePushToTalkKeyboard } from "./usePushToTalkKeyboard";
import { useVoiceWebSocket } from "./useVoiceWebSocket";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface UseVoiceAgentOptions {
  userId: string | undefined;
  enabled: boolean;
}

/**
 * Hook de alto nível que orquestra todo o voice agent
 * Combina recorder, keyboard, websocket e gerencia estado
 */
export function useVoiceAgent({ userId, enabled }: UseVoiceAgentOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [audioQueue, setAudioQueue] = useState<string[]>([]);

  // WebSocket callbacks
  const wsCallbacks = {
    onTranscript: useCallback((text: string, isFinal: boolean) => {
      console.log(`[VoiceAgent] Transcript: ${text} (final: ${isFinal})`);
      
      if (isFinal) {
        setMessages((prev) => [...prev, { role: "user", content: text }]);
        setCurrentTranscript("");
      } else {
        setCurrentTranscript(text);
      }
    }, []),

    onAgentText: useCallback((text: string, isComplete: boolean) => {
      console.log(`[VoiceAgent] Agent text: ${text} (complete: ${isComplete})`);
      
      if (isComplete) {
        setMessages((prev) => [...prev, { role: "assistant", content: streamingText + text }]);
        setStreamingText("");
      } else {
        setStreamingText((prev) => prev + text);
      }
    }, [streamingText]),

    onAgentAudio: useCallback((audioBase64: string) => {
      console.log(`[VoiceAgent] Agent audio chunk received`);
      setAudioQueue((prev) => [...prev, audioBase64]);
    }, []),

    onSessionStarted: useCallback(() => {
      console.log("[VoiceAgent] Session started");
    }, []),

    onError: useCallback((error: string) => {
      console.error("[VoiceAgent] Error:", error);
    }, []),
  };

  // WebSocket
  const { isConnected, connect, disconnect, sendAudio, error: wsError } = useVoiceWebSocket(
    userId,
    wsCallbacks
  );

  // Audio ready handler
  const handleAudioReady = useCallback(
    async (blob: Blob) => {
      console.log(`[VoiceAgent] Audio ready: ${blob.size} bytes`);
      
      if (!isConnected) {
        console.warn("[VoiceAgent] Not connected, attempting to connect...");
        connect();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      await sendAudio(blob);
    },
    [isConnected, connect, sendAudio]
  );

  // Push-to-talk recorder
  const {
    isReady: recorderReady,
    isActive: isRecording,
    error: recorderError,
    startRecording,
    stopRecording,
  } = usePushToTalkRecorder({
    onAudioReady: handleAudioReady,
    enabled,
  });

  // Keyboard handler
  const { isPressed } = usePushToTalkKeyboard({
    enabled: enabled && recorderReady,
    onPressStart: startRecording,
    onPressEnd: stopRecording,
  });

  // Control functions
  const startSession = useCallback(() => {
    console.log("[VoiceAgent] Starting session...");
    connect();
  }, [connect]);

  const stopSession = useCallback(() => {
    console.log("[VoiceAgent] Stopping session...");
    disconnect();
  }, [disconnect]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentTranscript("");
    setStreamingText("");
  }, []);

  return {
    // State
    messages,
    currentTranscript,
    streamingText,
    audioQueue,
    isConnected,
    recorderReady,
    isRecording,
    isPressed,

    // Errors
    error: wsError || recorderError,

    // Controls
    startSession,
    stopSession,
    clearMessages,
  };
}
