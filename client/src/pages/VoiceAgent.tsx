import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Volume2 } from "lucide-react";
import {
  VoiceMessageType,
  type VoiceMessage,
  type TranscriptMessage,
  type AgentTextMessage,
  type AgentAudioMessage,
} from "@shared/voice-types";

export default function VoiceAgent() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [agentText, setAgentText] = useState<string>("");
  const [error, setError] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/voice`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setError("");

      // Start session
      ws.send(
        JSON.stringify({
          type: VoiceMessageType.START_SESSION,
          data: { userId: "demo-user" },
        })
      );
    };

    ws.onmessage = (event) => {
      const message: VoiceMessage = JSON.parse(event.data);
      handleServerMessage(message);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setError("Connection error");
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      setIsConnected(false);
    };

    wsRef.current = ws;
  };

  const handleServerMessage = (message: VoiceMessage) => {
    switch (message.type) {
      case VoiceMessageType.TRANSCRIPT:
        const transcriptMsg = message as TranscriptMessage;
        setTranscript((prev) => [...prev, `You: ${transcriptMsg.data.text}`]);
        break;

      case VoiceMessageType.AGENT_TEXT:
        const textMsg = message as AgentTextMessage;
        setAgentText((prev) => prev + textMsg.data.text);
        if (textMsg.data.isComplete) {
          setTranscript((prev) => [...prev, `Agent: ${agentText + textMsg.data.text}`]);
          setAgentText("");
        }
        break;

      case VoiceMessageType.AGENT_AUDIO:
        const audioMsg = message as AgentAudioMessage;
        playAudioChunk(audioMsg.data.audio);
        break;

      case VoiceMessageType.ERROR:
        setError(message.data.message);
        break;

      case VoiceMessageType.SESSION_STARTED:
        console.log("Session started:", message.data);
        break;
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audioQueueRef.current.push(audio);

    // Play if no audio is currently playing
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

  const startRecording = async () => {
    try {
      if (!isConnected) {
        connectWebSocket();
        // Wait a bit for connection
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Convert blob to base64 and send
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
      };

      // Record in chunks of 1 second
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">Voice Agent Demo</h1>

        <div className="flex gap-4 mb-4">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            size="lg"
            variant={isRecording ? "destructive" : "default"}
          >
            {isRecording ? <MicOff className="mr-2" /> : <Mic className="mr-2" />}
            {isRecording ? "Stop" : "Start"} Recording
          </Button>

          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
        )}

        {agentText && (
          <div className="bg-blue-100 p-3 rounded mb-4 flex items-center gap-2">
            <Volume2 className="animate-pulse" />
            <span>Agent: {agentText}</span>
          </div>
        )}

        <div className="border rounded p-4 h-96 overflow-y-auto bg-gray-50">
          <h2 className="font-semibold mb-2">Conversation:</h2>
          {transcript.length === 0 && (
            <p className="text-gray-500 italic">
              Click "Start Recording" and speak to begin...
            </p>
          )}
          {transcript.map((line, i) => (
            <div key={i} className="mb-2">
              {line}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
