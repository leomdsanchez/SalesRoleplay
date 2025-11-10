import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePushToTalkRecorder } from "./usePushToTalkRecorder";
import { usePushToTalkKeyboard } from "./usePushToTalkKeyboard";
import { useVoiceWebSocket } from "./useVoiceWebSocket";
import { useAudioPlayer } from "./useAudioPlayer";
import type { VoiceAgentSettings } from "@shared/settings-schema";
import type { RagReference } from "@shared/voice-types";

const DEBUG_VOICE_AGENT = false;
const debugLog = (...args: any[]) => {
  if (!DEBUG_VOICE_AGENT) return;
  console.debug("[VoiceAgent]", ...args);
};

export interface Message {
  role: "user" | "assistant";
  content: string;
  ragReferences?: RagReference[];
}

export interface UseVoiceAgentOptions {
  userId: string | undefined;
}

/**
 * Hook de alto nível que orquestra todo o voice agent
 * Combina recorder, keyboard, websocket e gerencia estado
 * 
 * NÃO inicia automaticamente - usuário deve chamar startSession()
 */
export function useVoiceAgent({ userId }: UseVoiceAgentOptions) {
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [settings, setSettings] = useState<VoiceAgentSettings | null>(null);
  const streamingTextRef = useRef(streamingText);

  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);
  
  // Audio player
  const { isPlaying, enqueueAudio, clearQueue } = useAudioPlayer();
  const clearQueueRef = useRef(clearQueue);
  
  // Keep ref updated
  useEffect(() => {
    clearQueueRef.current = clearQueue;
  }, [clearQueue]);

  // WebSocket callbacks (memoized to prevent re-creation)
  const onTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setCurrentTranscript("");
      // Clear streaming text when user finishes speaking - new assistant response should start fresh
      setStreamingText((prev) => {
        debugLog("Clearing streamingText after final transcript", { previous: prev });
        return "";
      });
    } else {
      setCurrentTranscript(text);
    }
  }, []);

  const onAgentText = useCallback((text: string, isComplete: boolean, isSentence?: boolean) => {
    if (isComplete) {
      // Final message - add streaming text to messages and clear
      setStreamingText((current) => {
        const finalContent = text ? (current ? current + " " + text : text) : current;
        debugLog("Received isComplete=true", { text, currentStreaming: current, finalContent });
        if (finalContent) {
          setMessages((prev) => {
            debugLog("Appending final assistant message", finalContent);
            return [...prev, { role: "assistant", content: finalContent }];
          });
        } else {
          debugLog("No finalContent to append when isComplete=true");
        }
        return "";
      });
    } else if (isSentence) {
      // Complete sentence - DON'T add to streaming (already there from words), just save to history
      // The sentence is already displayed via word chunks, so do nothing here
      debugLog("Sentence complete (already displayed via words)");
    } else {
      // Word chunk - add to streaming text for real-time display
      setStreamingText((prev) => {
        const next = prev === "" ? text : prev + " " + text;
        debugLog("Updating streamingText with chunk", { text, previous: prev, next });
        return next;
      });
    }
  }, []);

  const onAgentAudio = useCallback((audioBase64: string) => {
    debugLog("Agent audio chunk received", { length: audioBase64.length });
    enqueueAudio(audioBase64);
  }, [enqueueAudio]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/voice/settings", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  const onRagContext = useCallback((references: RagReference[]) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      if (last.role !== "user") {
        return next;
      }
      next[next.length - 1] = { ...last, ragReferences: references };
      return next;
    });
  }, []);

  const onSessionStarted = useCallback(() => {
    debugLog("Session started");
  }, []);

  const onError = useCallback((error: string) => {
    console.error("[VoiceAgent] Error:", error);
  }, []);

  const onConfidence = useCallback((value: number) => {
    setConfidence(value);
  }, []);

  const wsCallbacks = useMemo(
    () => ({
      onTranscript,
      onAgentText,
      onAgentAudio,
      onSessionStarted,
      onError,
      onRagContext,
      onConfidence,
    }),
    [onTranscript, onAgentText, onAgentAudio, onSessionStarted, onError, onRagContext, onConfidence]
  );

  // WebSocket
  const { isConnected, connect, disconnect, sendAudio, cancelStreaming, error: wsError } = useVoiceWebSocket(
    userId,
    wsCallbacks
  );

  // Audio ready handler
  const handleAudioReady = useCallback(
    async (blob: Blob) => {
      debugLog("Audio ready", { size: blob.size });
      
      if (!isConnected) {
        debugLog("Not connected, attempting to connect...");
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
    enabled: sessionActive && isConnected,
    onRecordingStart: () => {
      debugLog("New recording - cancelling streaming and clearing queue", {
        streamingTextBeforeCancel: streamingTextRef.current,
      });
      cancelStreaming(); // Cancel server streaming
      clearQueueRef.current(); // Clear audio queue
      // Don't clear streamingText here - let it persist until new response starts
    },
  });

  // Keyboard handler
  const { isPressed } = usePushToTalkKeyboard({
    enabled: sessionActive && recorderReady,
    onPressStart: startRecording,
    onPressEnd: stopRecording,
  });

  // Control functions
  const startSession = useCallback(() => {
    debugLog("Starting session");
    setSessionActive(true);
    setConfidence(null);
    connect();
  }, [connect]);

  const stopSession = useCallback(() => {
    debugLog("Stopping session");
    setSessionActive(false);
    disconnect();
  }, [disconnect]);

  const clearMessages = useCallback(() => {
    debugLog("Clearing messages");
    setMessages([]);
    setCurrentTranscript("");
    setStreamingText("");
    setConfidence(null);
  }, []);

  return {
    // State
    messages,
    currentTranscript,
    streamingText,
    isPlaying,
    isConnected,
    recorderReady,
    isRecording,
    isPressed,
    confidence,
    settings,

    // Errors
    error: wsError || recorderError,

    // Controls
    startSession,
    stopSession,
    clearMessages,
  };
}
