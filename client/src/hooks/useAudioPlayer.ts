import { useEffect, useRef, useState, useCallback } from "react";

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
      console.log("[AudioPlayer] Already playing, skipping playNext");
      return;
    }

    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      setQueueLength(0);
      return;
    }

    const nextAudio = queueRef.current.shift()!;
    setQueueLength(queueRef.current.length);

    console.log(`[AudioPlayer] Playing (${queueRef.current.length} remaining)`);
    setIsPlaying(true);

    // Set new source with error handling
    try {
      audio.src = `data:audio/mpeg;base64,${nextAudio}`; // Changed from audio/mp3 to audio/mpeg for better browser support
      audio.load(); // Explicitly load the audio
    } catch (error) {
      console.error("[AudioPlayer] Error setting audio source:", error);
      playNext(); // Skip to next
      return;
    }

    // Play with enhanced error handling
    audio.play().catch((err) => {
      console.error("[AudioPlayer] Play error:", err);
      // Try alternative MIME types if the first fails
      if (audio.src.includes('audio/mpeg')) {
        try {
          audio.src = `data:audio/mp3;base64,${nextAudio}`;
          audio.load();
          audio.play().catch((retryErr) => {
            console.error("[AudioPlayer] Retry play error:", retryErr);
            playNext(); // Skip to next
          });
        } catch (retryError) {
          console.error("[AudioPlayer] Retry error:", retryError);
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
      console.log("[AudioPlayer] Audio ended");
      playNext(); // Play next in queue
    };

    const handleError = (e: ErrorEvent) => {
      console.error("[AudioPlayer] Audio error:", e);
      console.error("[AudioPlayer] Audio src:", audio.src.substring(0, 50) + "...");
      console.error("[AudioPlayer] Audio readyState:", audio.readyState);
      console.error("[AudioPlayer] Audio error code:", audio.error?.code);
      console.error("[AudioPlayer] Audio error message:", audio.error?.message);
      playNext(); // Skip and try next
    };

    const handleCanPlay = () => {
      console.log("[AudioPlayer] Audio can play");
    };

    const handleLoadStart = () => {
      console.log("[AudioPlayer] Audio load start");
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

      console.log(`[AudioPlayer] Enqueue (paused: ${audio?.paused}, queue: ${queueRef.current.length})`);
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
      audio.pause();
      audio.src = "";
    }
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
