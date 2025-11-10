import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import type { Message } from "@/hooks/useVoiceAgent";
import { Mic } from "lucide-react";

interface VoiceChatProps {
  messages: Message[];
  currentTranscript: string;
  streamingText: string;
  confidence?: number | null;
  showConfidence?: boolean;
}

/**
 * Componente que exibe o histórico de chat e mensagens em streaming
 */
export function VoiceChat({
  messages,
  currentTranscript,
  streamingText,
  confidence,
  showConfidence,
}: VoiceChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const hasContent = messages.length > 0 || streamingText;

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      {showConfidence && typeof confidence === "number" && (
        <div className="flex justify-end">
          <div className="bg-white/80 border rounded-lg px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
            <span>Confiança atual:</span>
            <span className="font-semibold text-slate-900">
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {!hasContent && (
        <div className="text-center py-12 text-muted-foreground">
          <Mic className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm">Press space to talk or click the microphone</p>
        </div>
      )}

      {messages.map((msg, i) => (
        <ChatMessage
          key={i}
          role={msg.role}
          content={msg.content}
          ragReferences={msg.ragReferences}
        />
      ))}

      {streamingText && (
        <ChatMessage role="assistant" content={streamingText} streaming />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
