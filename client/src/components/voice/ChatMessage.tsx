import { useState } from "react";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RagReference } from "@shared/voice-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  ragReferences?: RagReference[];
}

export function ChatMessage({ role, content, streaming, ragReferences }: ChatMessageProps) {
  const isUser = role === "user";
  const hasRag = isUser && (ragReferences?.length ?? 0) > 0;
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-slate-100 text-slate-900"
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="text-sm prose prose-sm prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
        {streaming && (
          <span className="inline-block w-1 h-4 ml-1 bg-slate-400 animate-pulse" />
        )}

        {hasRag && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  "mt-2 text-xs underline flex items-center gap-1 transition-colors",
                  isUser ? "text-white/90 hover:text-white" : "text-primary hover:text-primary/80"
                )}
              >
                Contexto RAG ({ragReferences!.length})
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Referências recuperadas</DialogTitle>
                <DialogDescription>
                  Trechos reais usados pelo agente para responder este vendedor.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {ragReferences!.map((ref, idx) => (
                  <div
                    key={`${ref.id}-${idx}`}
                    className="rounded-md border p-3 bg-slate-50 text-slate-800"
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {ref.source} · Similaridade: {ref.score.toFixed(3)}
                    </div>
                    {ref.metadata?.prompt && (
                      <p className="text-xs text-slate-500 mb-2">
                        Pergunta original: {ref.metadata.prompt}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{ref.text}</p>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-slate-600" />
        </div>
      )}
    </div>
  );
}
