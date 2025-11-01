import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Hook para gerenciar fila de áudio e playback
 * Garante que áudios toquem em sequência sem overlap
 */
export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);

  // Add audio to queue
  const enqueueAudio = useCallback((audioBase64: string) => {
    console.log("[AudioPlayer] Enqueuing audio");
    setQueue((prev) => [...prev, audioBase64]);
  }, []);

  // Process queue
  useEffect(() => {
    if (queue.length === 0 || isProcessingRef.current) {
      return;
    }

    const playNext = async () => {
      isProcessingRef.current = true;
      const [nextAudio, ...rest] = queue;

      console.log(`[AudioPlayer] Playing audio (${rest.length} remaining in queue)`);
      setIsPlaying(true);

      try {
        // Create audio element
        const audio = new Audio(`data:audio/mp3;base64,${nextAudio}`);
        audioRef.current = audio;

        // Wait for audio to finish
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            console.log("[AudioPlayer] Audio finished");
            resolve();
          };
          audio.onerror = (err) => {
            console.error("[AudioPlayer] Audio error:", err);
            reject(err);
          };
          audio.play().catch(reject);
        });
      } catch (err) {
        console.error("[AudioPlayer] Playback error:", err);
      } finally {
        audioRef.current = null;
        setQueue(rest);
        setIsPlaying(false);
        isProcessingRef.current = false;
      }
    };

    playNext();
  }, [queue]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const clearQueue = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setQueue([]);
    setIsPlaying(false);
    isProcessingRef.current = false;
  }, []);

  return {
    isPlaying,
    queueLength: queue.length,
    enqueueAudio,
    clearQueue,
  };
}
