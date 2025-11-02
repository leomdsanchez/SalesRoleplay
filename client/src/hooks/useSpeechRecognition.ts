// Web Speech API type declarations (not included in standard DOM lib)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

import { useState, useRef, useCallback, useEffect } from "react";

const DEBUG_SPEECH_REC = true;
const srLog = (...args: any[]) => {
  if (!DEBUG_SPEECH_REC) return;
  console.log("[SpeechRec]", ...args);
};

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
    if (typeof window === "undefined" || (!window.SpeechRecognition && !window.webkitSpeechRecognition)) {
      srLog("Speech Recognition not supported in this browser");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      srLog("Started listening", { language: recognition.lang });
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
      srLog("Error event", { error: event.error, message: (event as any).message });
      setIsListening(false);
      onError?.(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      srLog("Stopped listening");
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [language, onResult, onError]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      srLog("Calling start()", { isListening });
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      srLog("Calling stop()", { isListening });
      recognitionRef.current.stop();
    }
  }, [isListening]);

  useEffect(() => {
    if (enabled && !isListening) {
      srLog("Enabling recognition", { enabled, isListening });
      startListening();
    } else if (!enabled && isListening) {
      srLog("Disabling recognition", { enabled, isListening });
      stopListening();
    }
  }, [enabled, isListening, startListening, stopListening]);

  return {
    isListening,
    startListening,
    stopListening,
  };
}
