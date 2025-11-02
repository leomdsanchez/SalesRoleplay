import { useState, useRef, useCallback, useEffect } from "react";
import { log } from "@shared/logger";

const DEBUG_AUDIO_PLAYER = true;
const audioLog = (...args: any[]) => {
  if (!DEBUG_AUDIO_PLAYER) return;
  console.debug("[AudioPlayer]", ...args);
};

/**
 * Hook KISS para playback de áudio sequencial
 * Usa um único Audio element e troca src
 */
export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata"; // Changed from "auto" to "metadata" for better compatibility
    audio.volume = 1.0;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  const playNext = useCallback(() => {
    const audio = audioRef.current;

    // Don't play if already playing
    if (!audio || !audio.paused) {
      audioLog("playNext skipped", { hasAudio: !!audio, paused: audio?.paused });
      return;
    }

    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      setQueueLength(0);
      return;
    }

    const nextAudio = queueRef.current.shift()!;
    setQueueLength(queueRef.current.length);

    audioLog("playNext starting", { remaining: queueRef.current.length });
    setIsPlaying(true);

    // Set new source with error handling
    try {
      audio.src = `data:audio/mpeg;base64,${nextAudio}`; // Changed from audio/mp3 to audio/mpeg for better browser support
      audio.load(); // Explicitly load the audio
    } catch (error) {
      audioLog("Error setting audio source", error);
      playNext(); // Skip to next
      return;
    }

    // Play with enhanced error handling
    audio.play().catch((err) => {
      audioLog("Play error", err);
      // Try alternative MIME types if the first fails
      if (audio.src.includes('audio/mpeg')) {
        try {
          audio.src = `data:audio/mp3;base64,${nextAudio}`;
          audio.load();
          audio.play().catch((retryErr) => {
            audioLog("Retry play error", retryErr);
            playNext(); // Skip to next
          });
        } catch (retryError) {
          audioLog("Retry error", retryError);
          playNext(); // Skip to next
        }
      } else {
        playNext(); // Skip to next
      }
    });
  }, []);

  // Setup ended handler
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      audioLog("ended event");
      playNext(); // Play next in queue
    };

    const handleError = (e: ErrorEvent) => {
      audioLog("error event", {
        error: e.error,
        currentSrc: audio.currentSrc,
        readyState: audio.readyState,
        code: audio.error?.code,
        message: audio.error?.message,
        queueLength: queueRef.current.length,
      });
      playNext(); // Skip and try next
    };

    const handleCanPlay = () => {
      audioLog("canplay event", {
        currentSrc: audio.currentSrc,
        readyState: audio.readyState,
      });
    };

    const handleLoadStart = () => {
      audioLog("loadstart event", {
        currentSrc: audio.currentSrc,
        queueLength: queueRef.current.length,
      });
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadstart", handleLoadStart);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadstart", handleLoadStart);
    };
  }, [playNext]);

  const enqueueAudio = useCallback(
    (audioBase64: string) => {
      const audio = audioRef.current;

      audioLog("enqueue", { paused: audio?.paused, queueLength: queueRef.current.length });

      queueRef.current.push(audioBase64);
      setQueueLength(queueRef.current.length);

      // Start playing if audio is paused (not playing)
      if (audio && audio.paused) {
        playNext();
      }
    },
    [playNext]
  );

  const clearQueue = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audioLog("clearQueue invoked", {
        hadAudio: true,
        currentSrc: audio.currentSrc,
        queueLength: queueRef.current.length,
      });
      audio.pause();
      audio.src = "";
    }
    audioLog("queue cleared", { queueLength: 0 });
    queueRef.current = [];
    setQueueLength(0);
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    queueLength,
    enqueueAudio,
    clearQueue,
  };
}
