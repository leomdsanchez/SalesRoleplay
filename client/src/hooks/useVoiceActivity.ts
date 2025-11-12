import { useEffect, useRef, useState } from "react";

interface UseVoiceActivityOptions {
  enabled: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  threshold?: number;
  silenceDuration?: number;
  stream?: MediaStream | null;
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
  stream,
}: UseVoiceActivityOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    let mounted = true;

    const setupVAD = async () => {
      try {
        let activeStream = stream ?? null;

        if (!activeStream) {
          activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          ownsStreamRef.current = true;
        } else {
          ownsStreamRef.current = false;
        }

        if (!mounted) {
          if (ownsStreamRef.current && activeStream) {
            activeStream.getTracks().forEach((track) => track.stop());
          }
          return;
        }

        streamRef.current = activeStream;
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();

        const source = audioContextRef.current.createMediaStreamSource(activeStream);
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

          setVolume(normalized);

          if (normalized > threshold) {
            // Speech detected
            if (!isSpeakingRef.current) {
              setIsSpeaking(true);
              isSpeakingRef.current = true;
              onSpeechStart?.();
            }

            // Clear silence timer
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else {
            // Silence detected
            if (isSpeakingRef.current && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                setIsSpeaking(false);
                isSpeakingRef.current = false;
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
  }, [enabled, threshold, silenceDuration, stream, onSpeechStart, onSpeechEnd]);

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
      if (ownsStreamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setVolume(0);
  };

  return { isSpeaking, volume };
}
