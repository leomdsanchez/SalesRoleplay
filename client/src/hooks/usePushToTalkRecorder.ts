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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldSendRef = useRef(false);
  const isProcessingRef = useRef(false); // Prevent duplicate calls

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
    startRecording,
    stopRecording,
  };
}
