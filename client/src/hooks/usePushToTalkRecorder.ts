import { useState, useRef, useCallback, useEffect } from "react";

export interface UsePushToTalkRecorderOptions {
  onAudioReady: (blob: Blob) => void;
  enabled: boolean;
  onRecordingStart?: () => void;
}

/**
 * Hook especializado para push-to-talk recording
 * Gerencia start/stop do MediaRecorder com padrão correto para gerar arquivo válido
 */
export function usePushToTalkRecorder({
  onAudioReady,
  enabled,
  onRecordingStart,
}: UsePushToTalkRecorderOptions) {
  const [isActive, setIsActive] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldSendRef = useRef(false);
  const isProcessingRef = useRef(false); // Prevent duplicate calls
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const levelRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const recorderMimeTypeRef = useRef("audio/webm");

  const stopLevelMonitor = useCallback(() => {
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    levelRef.current = 0;
    setInputLevel(0);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const startLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("[PushToTalk] AudioContext not supported");
        return;
      }

      const audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioContext as AudioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      const updateLevel = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;

        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

        let sumSquares = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const value = (dataArrayRef.current[i] - 128) / 128;
          sumSquares += value * value;
        }

        const rms = Math.sqrt(sumSquares / dataArrayRef.current.length);
        const scaledLevel = Math.min(1, rms * 4); // Boost sensitivity
        const smoothLevel = levelRef.current * 0.8 + scaledLevel * 0.2;
        levelRef.current = smoothLevel;
        const visualBaseline = 0.02;
        setInputLevel(Math.max(visualBaseline, smoothLevel));

        levelRafRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("[PushToTalk] Failed to start level monitor:", err);
    }
  }, []);

  const pickSupportedMimeType = useCallback(() => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      return null;
    }
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=mp4a",
      "audio/mp4",
    ];
    for (const type of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch {
        // Ignore browsers that throw on unsupported queries
      }
    }
    return null;
  }, []);

  // Initialize MediaRecorder
  const initialize = useCallback(async () => {
    try {
      console.log("[PushToTalk] Initializing...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const supportedMimeType = pickSupportedMimeType();
      const recorderOptions = supportedMimeType ? { mimeType: supportedMimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      const resolvedMimeType = mediaRecorder.mimeType || supportedMimeType || "audio/webm";
      recorderMimeTypeRef.current = resolvedMimeType;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log(
          `[PushToTalk] Data available: ${event.data.size} bytes (shouldSend=${shouldSendRef.current})`
        );
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const shouldSend = shouldSendRef.current;
        const chunks = chunksRef.current;
        chunksRef.current = [];
        shouldSendRef.current = false;

        if (!shouldSend || chunks.length === 0) {
          console.log("[PushToTalk] Recording stopped without payload");
          return;
        }

        console.log("[PushToTalk] Finalizing blob", {
          chunks: chunks.length,
          mimeType: recorderMimeTypeRef.current,
        });

        const blob = new Blob(chunks, { type: recorderMimeTypeRef.current });
        onAudioReady(blob);
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("[PushToTalk] Error:", event.error);
        setError(event.error?.message || "Recording error");
      };

      mediaRecorderRef.current = mediaRecorder;
      setIsReady(true);
      setError(null);
      startLevelMonitor(stream);
      
      console.log("[PushToTalk] Ready!");
    } catch (err: any) {
      console.error("[PushToTalk] Initialization failed:", err);
      setError(err.message);
      setIsReady(false);
    }
  }, [onAudioReady, startLevelMonitor, pickSupportedMimeType]);

  // Cleanup
  const cleanup = useCallback(() => {
    console.log("[PushToTalk] Cleaning up...");
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    stopLevelMonitor();
    chunksRef.current = [];
    shouldSendRef.current = false;

    mediaRecorderRef.current = null;
    setIsReady(false);
    setIsActive(false);
  }, [stopLevelMonitor]);

  // Start recording (when user presses)
  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isReady) {
      console.warn("[PushToTalk] Not ready to record");
      return;
    }

    if (isProcessingRef.current) {
      console.log("[PushToTalk] Already processing, ignoring");
      return;
    }

    const state = mediaRecorderRef.current.state;
    
    if (state === "inactive") {
      console.log("[PushToTalk] Starting recording...");
      isProcessingRef.current = true;
      
      // Call callback to clear audio queue
      onRecordingStart?.();
      
      chunksRef.current = [];
      shouldSendRef.current = false;
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
      mediaRecorderRef.current.start();
      setIsActive(true);
      setTimeout(() => { isProcessingRef.current = false; }, 100);
    } else if (state === "recording") {
      console.log("[PushToTalk] Already recording");
      setIsActive(true);
    } else {
      console.warn(`[PushToTalk] Cannot start, state: ${state}`);
    }
  }, [isReady, onRecordingStart]);

  // Stop recording (when user releases)
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) {
      console.warn("[PushToTalk] No recorder to stop");
      return;
    }

    if (isProcessingRef.current) {
      console.log("[PushToTalk] Processing, will stop when ready");
      // Set a flag to stop after processing completes
      setTimeout(() => stopRecording(), 50);
      return;
    }

    const state = mediaRecorderRef.current.state;

    if (state === "recording") {
      console.log("[PushToTalk] Stopping recording...");
      shouldSendRef.current = true; // Mark that we should send this chunk
      mediaRecorderRef.current.stop();
      setIsActive(false);
    } else if (state === "inactive") {
      // Already inactive, just clear the active state
      console.log("[PushToTalk] Already inactive, clearing state");
      setIsActive(false);
      shouldSendRef.current = false;
    } else {
      console.warn(`[PushToTalk] Unexpected state: ${state}`);
    }
  }, []);

  // Initialize when enabled
  useEffect(() => {
    if (enabled && !isReady) {
      initialize();
    } else if (!enabled && isReady) {
      cleanup();
    }

    return () => {
      if (isReady) {
        cleanup();
      }
    };
  }, [enabled, isReady, initialize, cleanup]);

  return {
    isReady,
    isActive,
    error,
    inputLevel,
    startRecording,
    stopRecording,
  };
}
