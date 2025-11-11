import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePushToTalkRecorder } from "./usePushToTalkRecorder";
import { usePushToTalkKeyboard } from "./usePushToTalkKeyboard";
import { useVoiceWebSocket } from "./useVoiceWebSocket";
import { useAudioPlayer } from "./useAudioPlayer";
import type { VoiceAgentSettings } from "@shared/settings-schema";
import type { RagReference, TranscriptMessage, CoachUpdateData } from "@shared/voice-types";

const FILLER_WORDS = [
  "uh",
  "um",
  "ah",
  "er",
  "erm",
  "huh",
  "hmm",
  "né",
  "é",
  "hã",
  "tipo",
  "assim",
  "bom",
  "sabe",
  "então",
  "ahm",
  "éé",
  "ééé",
  "like",
] as const;

const FILLER_SET = new Set(FILLER_WORDS);

export interface SpeechMeta {
  durationSec?: number;
  wordCount?: number;
  wpm?: number;
  fillerRate?: number;
  fillerCount?: number;
  source?: "stt" | "coach";
  coachFillerRate?: number | null;
  coachNotes?: string | null;
}

export interface SpeechAnalytics {
  hasGranularData: boolean;
  totalWords: number;
  totalDurationSec: number;
  averageWpm: number | null;
  lastWpm: number | null;
  fillerWords: number;
  fillerRate: number | null;
  lastFillerCount: number | null;
  sampleCount: number;
}

export interface CoachMetrics {
  fillerRate: number | null;
  speechNotes?: string | null;
  source?: "coach" | "stt";
}

const createEmptyAnalytics = (): SpeechAnalytics => ({
  hasGranularData: false,
  totalWords: 0,
  totalDurationSec: 0,
  averageWpm: null,
  lastWpm: null,
  fillerWords: 0,
  fillerRate: null,
  lastFillerCount: null,
  sampleCount: 0,
});

const countFillerWords = (text: string): number => {
  if (!text) return 0;
  const tokens = text
    .toLowerCase()
    .split(/[\s,.;:!?()\[\]"'“”‘’\-]+/)
    .filter(Boolean);
  return tokens.reduce((acc, token) => acc + (FILLER_SET.has(token as any) ? 1 : 0), 0);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const DEBUG_VOICE_AGENT = false;
const debugLog = (...args: any[]) => {
  if (!DEBUG_VOICE_AGENT) return;
  console.debug("[VoiceAgent]", ...args);
};

export interface Message {
  role: "user" | "assistant";
  content: string;
  ragReferences?: RagReference[];
  speechMeta?: SpeechMeta | null;
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
  const [coachNotes, setCoachNotes] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoiceAgentSettings | null>(null);
  const [speechAnalytics, setSpeechAnalytics] = useState<SpeechAnalytics | null>(null);
  const [coachMetrics, setCoachMetrics] = useState<CoachMetrics | null>(null);
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

  const updateSpeechAnalytics = useCallback(
    (text: string, metadata?: TranscriptMessage["data"]["metadata"]): SpeechMeta | null => {
      if (!metadata) {
        return null;
      }

      const wordEntries = (metadata.words ?? []) as Array<{ word?: string }>;
      const segmentWordCount = (metadata.segments ?? metadata.diarizedSegments ?? []).reduce(
        (total, segment) => {
          if (segment?.text) {
            return total + segment.text.split(/\s+/).filter(Boolean).length;
          }
          return total;
        },
        0
      );
      const fallbackWordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const wordCount = wordEntries.length || segmentWordCount || fallbackWordCount;

      const deriveDuration = () => {
        if (typeof metadata.durationSeconds === "number" && metadata.durationSeconds > 0) {
          return metadata.durationSeconds;
        }
        const rawDuration = (metadata.raw as any)?.duration ?? (metadata.raw as any)?.durationSeconds;
        if (typeof rawDuration === "number" && rawDuration > 0) {
          return rawDuration;
        }
        const usageDuration = (metadata.raw as any)?.usage?.seconds;
        if (typeof usageDuration === "number" && usageDuration > 0) {
          return usageDuration;
        }
        const segments = metadata.segments ?? metadata.diarizedSegments;
        if (Array.isArray(segments) && segments.length > 0) {
          const lastEnd = segments.reduce((max, seg) => Math.max(max, seg?.end ?? 0), 0);
          if (lastEnd > 0) {
            return lastEnd;
          }
        }
        return null;
      };

      const duration = deriveDuration();

      if (!duration || duration <= 0 || wordCount === 0) {
        return null;
      }

      const fillerSource =
        wordEntries.length > 0
          ? wordEntries.map((entry) => entry?.word ?? "").join(" ")
          : (metadata.segments ?? metadata.diarizedSegments ?? [])
              .map((segment) => segment?.text ?? "")
              .join(" ")
              .trim() || text;

      const fillerCount = countFillerWords(fillerSource);
      const instantWpm = wordCount / (duration / 60);
      const instantFillerRate = wordCount > 0 ? fillerCount / wordCount : null;

      setSpeechAnalytics((prev) => {
        const base = prev ?? createEmptyAnalytics();
        const totalWords = base.totalWords + wordCount;
        const totalDurationSec = base.totalDurationSec + duration;
        const averageWpm = totalDurationSec > 0 ? totalWords / (totalDurationSec / 60) : null;
        const fillerWords = base.fillerWords + fillerCount;
        const fillerRate = totalWords > 0 ? fillerWords / totalWords : null;

        return {
          hasGranularData: true,
          totalWords,
          totalDurationSec,
          averageWpm,
          lastWpm: instantWpm,
          fillerWords,
          fillerRate,
          lastFillerCount: fillerCount,
          sampleCount: base.sampleCount + 1,
        };
      });

      return {
        durationSec: duration,
        wordCount,
        wpm: instantWpm,
        fillerRate: instantFillerRate ?? undefined,
        fillerCount,
        source: "stt",
      };
    },
    []
  );

  // WebSocket callbacks (memoized to prevent re-creation)
  const onTranscript = useCallback((text: string, isFinal: boolean, metadata?: TranscriptMessage["data"]["metadata"]) => {
    if (isFinal) {
      const speechMeta = updateSpeechAnalytics(text, metadata);
      setMessages((prev) => [...prev, { role: "user", content: text, speechMeta }]);
      setCurrentTranscript("");
      // Clear streaming text when user finishes speaking - new assistant response should start fresh
      setStreamingText((prev) => {
        debugLog("Clearing streamingText after final transcript", { previous: prev });
        return "";
      });
    } else {
      setCurrentTranscript(text);
    }
  }, [updateSpeechAnalytics]);

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

  const handleCoachUpdate = useCallback((data: CoachUpdateData) => {
    if (!data || typeof data !== "object") {
      return;
    }
    if (typeof data.confidence === "number") {
      setConfidence(data.confidence);
    }
    setCoachNotes(typeof data.speechNotes === "string" ? data.speechNotes : null);

    const normalizedFiller =
      typeof data.fillerRate === "number"
        ? clamp(data.fillerRate > 1 ? data.fillerRate / 100 : data.fillerRate, 0, 1)
        : null;

    setCoachMetrics({
      fillerRate: normalizedFiller,
      speechNotes: typeof data.speechNotes === "string" ? data.speechNotes : null,
      source: data.source ?? "coach",
    });

    if (normalizedFiller != null || data.speechNotes) {
      setMessages((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "user") {
            next[i] = {
              ...next[i],
              speechMeta: {
                ...next[i].speechMeta,
                coachFillerRate: normalizedFiller ?? next[i].speechMeta?.coachFillerRate,
                coachNotes: typeof data.speechNotes === "string" ? data.speechNotes : next[i].speechMeta?.coachNotes,
              },
            };
            break;
          }
        }
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

  const wsCallbacks = useMemo(
    () => ({
      onTranscript,
      onAgentText,
      onAgentAudio,
      onSessionStarted,
      onError,
      onRagContext,
      onCoachUpdate: handleCoachUpdate,
    }),
    [onTranscript, onAgentText, onAgentAudio, onSessionStarted, onError, onRagContext, handleCoachUpdate]
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
    inputLevel,
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
    setCoachNotes(null);
    setSpeechAnalytics(null);
    setCoachMetrics(null);
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
    coachNotes,
    speechAnalytics,
    coachMetrics,
    settings,
    sessionActive,
    inputLevel,

    // Errors
    error: wsError || recorderError,

    // Controls
    startSession,
    stopSession,
    clearMessages,
  };
}
