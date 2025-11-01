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
    audio.preload = "auto";
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

    // Set new source
    audio.src = `data:audio/mp3;base64,${nextAudio}`;

    // Play
    audio.play().catch((err) => {
      console.error("[AudioPlayer] Play error:", err);
      playNext(); // Try next
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
      playNext(); // Skip and try next
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [playNext]);

  const enqueueAudio = useCallback(
    (audioBase64: string) => {
      const audio = audioRef.current;
      
      console.log(`[AudioPlayer] Enqueue (paused: ${audio?.paused})`);
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
