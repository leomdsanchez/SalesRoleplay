import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Settings, LogOut, Radio } from "lucide-react";
import { LoginScreen } from "@/components/voice/LoginScreen";
import { ChatMessage } from "@/components/voice/ChatMessage";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";
import {
  VoiceMessageType,
  type VoiceMessage,
  type TranscriptMessage,
  type AgentTextMessage,
  type AgentAudioMessage,
} from "@shared/voice-types";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function VoiceAgentNew() {
  const { user, loading: authLoading, login, register, logout } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [recordingMode, setRecordingMode] = useState<"vad" | "push">("push");
  const [isRecording, setIsRecording] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // VAD hook
  const { isSpeaking } = useVoiceActivity({
    enabled: recordingMode === "vad" && isRecording,
    onSpeechStart: () => {
      console.log("Speech started");
    },
    onSpeechEnd: () => {
      console.log("Speech ended");
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Keyboard controls (spacebar for push-to-talk)
  useEffect(() => {
    if (recordingMode !== "push" || !isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isPushToTalkActive) {
        e.preventDefault();
        console.log("Space pressed - starting recording");
        setIsPushToTalkActive(true);
        audioChunksRef.current = []; // Clear previous chunks
        setChunkCount(0);
        
        // Update MediaRecorder ref
        if (mediaRecorderRef.current) {
          const pushActiveRef = (mediaRecorderRef.current as any).pushActiveRef;
          if (pushActiveRef) {
            pushActiveRef.current = true;
            console.log("Set pushActiveRef to true");
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && isPushToTalkActive) {
        e.preventDefault();
        console.log("Space released - sending audio");
        
        // Update MediaRecorder ref
        if (mediaRecorderRef.current) {
          const pushActiveRef = (mediaRecorderRef.current as any).pushActiveRef;
          if (pushActiveRef) {
            pushActiveRef.current = false;
            console.log("Set pushActiveRef to false");
          }
        }
        
        setIsPushToTalkActive(false);
        // Send accumulated audio
        sendAccumulatedAudio();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [recordingMode, isRecording, isPushToTalkActive]);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || "localhost:5000";
    console.log(`Connecting to WebSocket: ${protocol}//${host}/ws/voice`);
    const ws = new WebSocket(`${protocol}//${host}/ws/voice`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setConnectionError("");
      ws.send(
        JSON.stringify({
          type: VoiceMessageType.START_SESSION,
          data: { userId: user?.id },
        })
      );
    };

    ws.onmessage = (event) => {
      const message: VoiceMessage = JSON.parse(event.data);
      handleServerMessage(message);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setConnectionError("Failed to connect to server");
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setIsConnected(false);
      if (event.code !== 1000) {
        setConnectionError(`Connection closed unexpectedly (${event.code})`);
      }
    };

    wsRef.current = ws;
  }, [user?.id]);

  const handleServerMessage = (message: VoiceMessage) => {
    switch (message.type) {
      case VoiceMessageType.TRANSCRIPT:
        const transcriptMsg = message as TranscriptMessage;
        setCurrentTranscript(transcriptMsg.data.text);
        if (transcriptMsg.data.isFinal) {
          setMessages((prev) => [
            ...prev,
            { role: "user", content: transcriptMsg.data.text },
          ]);
          setCurrentTranscript("");
        }
        break;

      case VoiceMessageType.AGENT_TEXT:
        const textMsg = message as AgentTextMessage;
        setStreamingText((prev) => prev + textMsg.data.text);
        if (textMsg.data.isComplete) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: streamingText + textMsg.data.text },
          ]);
          setStreamingText("");
        }
        break;

      case VoiceMessageType.AGENT_AUDIO:
        const audioMsg = message as AgentAudioMessage;
        playAudioChunk(audioMsg.data.audio);
        break;

      case VoiceMessageType.SESSION_STARTED:
        console.log("Session started");
        break;
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audioQueueRef.current.push(audio);

    if (audioQueueRef.current.length === 1) {
      playNextAudio();
    }
  };

  const playNextAudio = () => {
    const audio = audioQueueRef.current[0];
    if (!audio) return;

    audio.onended = () => {
      audioQueueRef.current.shift();
      playNextAudio();
    };

    audio.play().catch((err) => {
      console.error("Audio playback error:", err);
      audioQueueRef.current.shift();
      playNextAudio();
    });
  };

  const sendAccumulatedAudio = () => {
    if (audioChunksRef.current.length === 0) {
      console.log("No audio chunks to send");
      return;
    }
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.log("WebSocket not connected");
      return;
    }

    console.log(`Sending ${audioChunksRef.current.length} audio chunks`);
    
    // Combine all chunks into one blob
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    console.log(`Audio blob size: ${audioBlob.size} bytes`);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      console.log("Sending audio to server...");
      wsRef.current?.send(
        JSON.stringify({
          type: VoiceMessageType.AUDIO_CHUNK,
          data: { audio: base64, format: "webm" },
        })
      );
    };
    reader.readAsDataURL(audioBlob);
    
    // Clear chunks after sending
    audioChunksRef.current = [];
  };

  const startRecording = async () => {
    try {
      if (!isConnected) {
        connectWebSocket();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      // Store recording mode in ref to avoid stale closure
      const recordingModeRef = { current: recordingMode };
      const pushActiveRef = { current: false };

      mediaRecorder.ondataavailable = (event) => {
        const isActive = pushActiveRef.current;
        console.log(`ondataavailable fired: size=${event.data.size}, mode=${recordingModeRef.current}, pushActive=${isActive}, vad=${isSpeaking}`);
        
        if (event.data.size > 0) {
          // Accumulate chunks ONLY while push-to-talk is active
          if (recordingModeRef.current === "push" && isActive) {
            audioChunksRef.current.push(event.data);
            setChunkCount(audioChunksRef.current.length);
            console.log(`Accumulated chunk: ${event.data.size} bytes, total: ${audioChunksRef.current.length}`);
          }
          // For VAD mode, send immediately when speaking
          else if (recordingModeRef.current === "vad" && isSpeaking) {
            console.log(`VAD mode: sending chunk immediately`);
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(",")[1];
              wsRef.current?.send(
                JSON.stringify({
                  type: VoiceMessageType.AUDIO_CHUNK,
                  data: { audio: base64, format: "webm" },
                })
              );
            };
            reader.readAsDataURL(event.data);
          }
        }
      };

      // Store ref to update push state
      (mediaRecorder as any).pushActiveRef = pushActiveRef;
      mediaRecorderRef.current = mediaRecorder;

      console.log(`Starting MediaRecorder in ${recordingMode} mode`);
      mediaRecorder.start(200); // Capture chunks every 200ms
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
      setIsPushToTalkActive(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} onRegister={register} />;
  }

  const shouldCaptureAudio =
    recordingMode === "vad" ? isSpeaking : isPushToTalkActive;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Voice Agent</h1>
              <p className="text-xs text-muted-foreground">{user.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-muted-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
          {messages.length === 0 && !streamingText && (
            <div className="text-center py-12 text-muted-foreground">
              <Mic className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">
                {recordingMode === "push"
                  ? "Press space to talk or click the microphone"
                  : "Start speaking to begin"}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}

          {streamingText && (
            <ChatMessage
              role="assistant"
              content={streamingText}
              streaming
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Live Transcript / Controls */}
      <div className="flex-shrink-0 border-t bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 max-w-3xl">
          {/* Live transcript */}
          {currentTranscript && (
            <div className="mb-4 p-3 bg-slate-100 rounded-lg text-sm text-slate-700 animate-in fade-in slide-in-from-bottom-1">
              {currentTranscript}
              <span className="inline-block w-1 h-4 ml-1 bg-slate-400 animate-pulse" />
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              size="lg"
              className={cn(
                "flex-shrink-0 w-14 h-14 rounded-full transition-all duration-200",
                shouldCaptureAudio && isRecording && "ring-4 ring-primary/30 scale-110"
              )}
              variant={isRecording ? "destructive" : "default"}
            >
              {isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>

            <div className="flex-1 flex items-center gap-2 text-sm">
              {isRecording && (
                <>
                  <Radio
                    className={cn(
                      "w-4 h-4",
                      shouldCaptureAudio
                        ? "text-red-500 animate-pulse"
                        : "text-slate-400"
                    )}
                  />
                  <span className="text-slate-600">
                    {recordingMode === "push"
                      ? isPushToTalkActive
                        ? `Recording... (${chunkCount} chunks)`
                        : "Hold space to talk"
                      : isSpeaking
                      ? "Listening..."
                      : "Waiting for speech..."}
                  </span>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRecordingMode((m) => (m === "vad" ? "push" : "vad"))
              }
              disabled={isRecording}
              className="flex-shrink-0"
            >
              {recordingMode === "vad" ? "VAD Mode" : "Push-to-Talk"}
            </Button>
          </div>

          {connectionError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Connection Error:</strong> {connectionError}
              <button
                onClick={connectWebSocket}
                className="ml-2 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
          
          {!isConnected && !connectionError && isRecording && (
            <p className="text-xs text-orange-600 mt-2">
              ⚠️ Not connected to server
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
