import { useState, useRef, useCallback, useEffect } from "react";

export interface UsePushToTalkRecorderOptions {
  onAudioReady: (blob: Blob) => void;
  enabled: boolean;
}

/**
 * Hook especializado para push-to-talk recording
 * Gerencia start/stop do MediaRecorder com padrão correto para gerar arquivo válido
 */
export function usePushToTalkRecorder({
  onAudioReady,
  enabled,
}: UsePushToTalkRecorderOptions) {
  const [isActive, setIsActive] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldSendRef = useRef(false);

  // Initialize MediaRecorder
  const initialize = useCallback(async () => {
    try {
      console.log("[PushToTalk] Initializing...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = "audio/webm;codecs=opus";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        console.log(`[PushToTalk] Data available: ${event.data.size} bytes, shouldSend: ${shouldSendRef.current}`);
        
        if (event.data.size > 0 && shouldSendRef.current) {
          console.log("[PushToTalk] Sending audio blob");
          onAudioReady(event.data);
          shouldSendRef.current = false;
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("[PushToTalk] Error:", event.error);
        setError(event.error?.message || "Recording error");
      };

      mediaRecorderRef.current = mediaRecorder;
      setIsReady(true);
      setError(null);
      
      console.log("[PushToTalk] Ready!");
    } catch (err: any) {
      console.error("[PushToTalk] Initialization failed:", err);
      setError(err.message);
      setIsReady(false);
    }
  }, [onAudioReady]);

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

    mediaRecorderRef.current = null;
    setIsReady(false);
    setIsActive(false);
  }, []);

  // Start recording (when user presses)
  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isReady) {
      console.warn("[PushToTalk] Not ready to record");
      return;
    }

    const state = mediaRecorderRef.current.state;
    
    if (state === "inactive") {
      console.log("[PushToTalk] Starting recording...");
      mediaRecorderRef.current.start();
      setIsActive(true);
    } else {
      console.warn(`[PushToTalk] Cannot start, state: ${state}`);
    }
  }, [isReady]);

  // Stop recording (when user releases)
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) {
      console.warn("[PushToTalk] No recorder to stop");
      return;
    }

    const state = mediaRecorderRef.current.state;

    if (state === "recording") {
      console.log("[PushToTalk] Stopping recording...");
      shouldSendRef.current = true; // Mark that we should send this chunk
      mediaRecorderRef.current.stop();
      setIsActive(false);

      // Restart for next recording
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
          console.log("[PushToTalk] Restarting for next recording");
          // Don't start yet, wait for next press
        }
      }, 100);
    } else {
      console.warn(`[PushToTalk] Cannot stop, state: ${state}`);
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
    startRecording,
    stopRecording,
  };
}
