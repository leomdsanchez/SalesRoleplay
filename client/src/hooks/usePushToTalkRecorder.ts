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
  const [stream, setStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldSendRef = useRef(false);
  const isProcessingRef = useRef(false); // Prevent duplicate calls
  const chunksRef = useRef<Blob[]>([]);

  const deliverRecording = useCallback(() => {
    if (!shouldSendRef.current) {
      chunksRef.current = [];
      return;
    }

    if (chunksRef.current.length === 0) {
      console.warn("[PushToTalk] No audio chunks captured");
      shouldSendRef.current = false;
      return;
    }

    const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });

    console.log(
      `[PushToTalk] Delivering recording (${blob.size} bytes, ${chunksRef.current.length} chunks)`
    );

    onAudioReady(blob);
    shouldSendRef.current = false;
    chunksRef.current = [];
  }, [onAudioReady]);

  // Initialize MediaRecorder
  const initialize = useCallback(async () => {
    try {
      console.log("[PushToTalk] Initializing...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStream(stream);

      const mimeType = "audio/webm;codecs=opus";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.onstart = () => {
        console.log("[PushToTalk] Recorder started");
        chunksRef.current = [];
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }

        console.log(
          `[PushToTalk] Data available: ${event.data.size} bytes (total chunks: ${chunksRef.current.length}), shouldSend: ${shouldSendRef.current}`
        );
      };

      mediaRecorder.onstop = () => {
        console.log("[PushToTalk] Recorder stopped");
        deliverRecording();
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
  }, [deliverRecording]);

  // Cleanup
  const cleanup = useCallback(() => {
    console.log("[PushToTalk] Cleaning up...");

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      shouldSendRef.current = false;
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    setStream(null);
    chunksRef.current = [];
    shouldSendRef.current = false;
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
      shouldSendRef.current = false;

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
    stream,
  };
}
