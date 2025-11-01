import { useState, useRef, useCallback, useEffect } from "react";

interface UseSpeechRecognitionOptions {
  enabled: boolean;
  language: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

/**
 * Hook para reconhecimento de fala em tempo real usando Web Speech API
 */
export function useSpeechRecognition({
  enabled,
  language,
  onResult,
  onError,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.SpeechRecognition && !window.webkitSpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      console.log("[SpeechRec] Started listening");
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Send final results
      if (finalTranscript) {
        onResult(finalTranscript, true);
      }

      // Send interim results
      if (interimTranscript) {
        onResult(interimTranscript, false);
      }
    };

    recognition.onerror = (event) => {
      console.error("[SpeechRec] Error:", event.error);
      setIsListening(false);
      onError?.(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      console.log("[SpeechRec] Stopped listening");
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [language, onResult, onError]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  useEffect(() => {
    if (enabled && !isListening) {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }
  }, [enabled, isListening, startListening, stopListening]);

  return {
    isListening,
    startListening,
    stopListening,
  };
}
