import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePushToTalkRecorder } from "./usePushToTalkRecorder";
import { usePushToTalkKeyboard } from "./usePushToTalkKeyboard";
import { useVoiceWebSocket } from "./useVoiceWebSocket";
import { useAudioPlayer } from "./useAudioPlayer";

export interface Message {
  role: "user" | "assistant";
  content: string;
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
  
  // Audio player
  const { isPlaying, enqueueAudio, clearQueue } = useAudioPlayer();
  const clearQueueRef = useRef(clearQueue);
  
  // Keep ref updated
  useEffect(() => {
    clearQueueRef.current = clearQueue;
  }, [clearQueue]);

  // WebSocket callbacks (memoized to prevent re-creation)
  const onTranscript = useCallback((text: string, isFinal: boolean) => {
    console.log(`[VoiceAgent] Transcript: ${text} (final: ${isFinal})`);
    
    if (isFinal) {
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setCurrentTranscript("");
    } else {
      setCurrentTranscript(text);
    }
  }, []);

  const onAgentText = useCallback((text: string, isComplete: boolean, isSentence?: boolean) => {
    console.log(`[VoiceAgent] Agent text: "${text}" (complete: ${isComplete}, sentence: ${isSentence})`);
    
    if (isComplete) {
      // Final message - add streaming text to messages and clear
      setStreamingText((current) => {
        setMessages((prev) => [...prev, { role: "assistant", content: current }]);
        return "";
      });
    } else if (isSentence) {
      // Complete sentence - DON'T add to streaming (already there from words), just save to history
      // The sentence is already displayed via word chunks, so do nothing here
      console.log("[VoiceAgent] Sentence complete (already displayed via words)");
    } else {
      // Word chunk - add to streaming text for real-time display
      setStreamingText((prev) => prev === "" ? text : prev + " " + text);
    }
  }, []);

  const onAgentAudio = useCallback((audioBase64: string) => {
    console.log(`[VoiceAgent] Agent audio chunk received`);
    enqueueAudio(audioBase64);
  }, [enqueueAudio]);

  const onSessionStarted = useCallback(() => {
    console.log("[VoiceAgent] Session started");
  }, []);

  const onError = useCallback((error: string) => {
    console.error("[VoiceAgent] Error:", error);
  }, []);

  const wsCallbacks = useMemo(
    () => ({
      onTranscript,
      onAgentText,
      onAgentAudio,
      onSessionStarted,
      onError,
    }),
    [onTranscript, onAgentText, onAgentAudio, onSessionStarted, onError]
  );

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
    enabled: sessionActive,
    onRecordingStart: () => {
      console.log("[VoiceAgent] Clearing audio queue (new recording)");
      clearQueueRef.current();
      setStreamingText(""); // Also clear streaming text
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
    console.log("[VoiceAgent] Starting session...");
    setSessionActive(true);
    connect();
  }, [connect]);

  const stopSession = useCallback(() => {
    console.log("[VoiceAgent] Stopping session...");
    setSessionActive(false);
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
    isPlaying,
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
