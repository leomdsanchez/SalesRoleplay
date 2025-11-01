import { useEffect, useRef, useState } from "react";

interface UseVoiceActivityOptions {
  enabled: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  threshold?: number;
  silenceDuration?: number;
}

/**
 * Simple VAD (Voice Activity Detection) using Web Audio API
 * Detects when user starts/stops speaking based on audio volume
 */
export function useVoiceActivity({
  enabled,
  onSpeechStart,
  onSpeechEnd,
  threshold = 0.01, // Volume threshold (0-1)
  silenceDuration = 1500, // ms of silence before considering speech ended
}: UseVoiceActivityOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    let mounted = true;

    const setupVAD = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        
        analyserRef.current.fftSize = 512;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkAudioLevel = () => {
          if (!mounted || !analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
          const normalized = average / 255;

          if (normalized > threshold) {
            // Speech detected
            if (!isSpeaking) {
              setIsSpeaking(true);
              onSpeechStart?.();
            }

            // Clear silence timer
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else {
            // Silence detected
            if (isSpeaking && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                setIsSpeaking(false);
                onSpeechEnd?.();
                silenceTimerRef.current = null;
              }, silenceDuration);
            }
          }

          rafRef.current = requestAnimationFrame(checkAudioLevel);
        };

        checkAudioLevel();
      } catch (error) {
        console.error("VAD setup error:", error);
      }
    };

    setupVAD();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [enabled, threshold, silenceDuration]);

  const cleanup = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsSpeaking(false);
  };

  return { isSpeaking };
}
