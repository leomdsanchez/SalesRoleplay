import { useState, useRef, useCallback } from "react";

export interface UseMediaRecorderOptions {
  mimeType?: string;
  onDataAvailable?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export interface UseMediaRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

/**
 * Hook para gerenciar MediaRecorder de forma limpa
 * Encapsula toda a complexidade de start/stop/state
 */
export function useMediaRecorder({
  mimeType = "audio/webm;codecs=opus",
  onDataAvailable,
  onError,
}: UseMediaRecorderOptions = {}): UseMediaRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Check if mime type is supported
      const finalMimeType = MediaRecorder.isTypeSupported(mimeType)
        ? mimeType
        : "audio/webm";

      console.log(`[useMediaRecorder] Starting with MIME type: ${finalMimeType}`);

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: finalMimeType,
      });

      // Setup event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[useMediaRecorder] Data available: ${event.data.size} bytes`);
          onDataAvailable?.(event.data);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        const err = new Error(`MediaRecorder error: ${event.error}`);
        console.error("[useMediaRecorder]", err);
        setError(err.message);
        onError?.(err);
      };

      mediaRecorder.onstart = () => {
        console.log("[useMediaRecorder] Recording started");
        setIsRecording(true);
        setIsPaused(false);
      };

      mediaRecorder.onstop = () => {
        console.log("[useMediaRecorder] Recording stopped");
        setIsRecording(false);
        setIsPaused(false);
      };

      mediaRecorder.onpause = () => {
        console.log("[useMediaRecorder] Recording paused");
        setIsPaused(true);
      };

      mediaRecorder.onresume = () => {
        console.log("[useMediaRecorder] Recording resumed");
        setIsPaused(false);
      };

      mediaRecorderRef.current = mediaRecorder;

      // Don't start yet - let caller control when to start
      // They can call start() on the recorder directly or use pauseRecording/resumeRecording
    } catch (err: any) {
      const errorMsg = `Failed to start recording: ${err.message}`;
      console.error("[useMediaRecorder]", errorMsg);
      setError(errorMsg);
      onError?.(err);
    }
  }, [mimeType, onDataAvailable, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      console.log("[useMediaRecorder] Stopping recording");
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      console.log("[useMediaRecorder] Pausing recording");
      mediaRecorderRef.current.pause();
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      console.log("[useMediaRecorder] Resuming recording");
      mediaRecorderRef.current.resume();
    }
  }, []);

  return {
    isRecording,
    isPaused,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
