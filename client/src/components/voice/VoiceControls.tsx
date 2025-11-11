import { Toggle } from "@/components/ui/toggle";
import { Mic, MicOff, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  isRecording: boolean;
  isPressed: boolean;
  recorderReady: boolean;
  sessionActive: boolean;
  currentTranscript: string;
  isConnected: boolean;
  error: string | null;
  onStartSession: () => void;
  onStopSession: () => void;
}

/**
 * Componente de controles de gravação e status
 */
export function VoiceControls({
  isRecording,
  isPressed,
  recorderReady,
  sessionActive,
  currentTranscript,
  isConnected,
  error,
  onStartSession,
  onStopSession,
}: VoiceControlsProps) {
  return (
    <div className="flex-shrink-0 border-t bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 max-w-3xl">
        {currentTranscript && (
          <div className="mb-4 p-3 bg-slate-100 rounded-lg text-sm text-slate-700 animate-in fade-in slide-in-from-bottom-1">
            {currentTranscript}
            <span className="inline-block w-1 h-4 ml-1 bg-slate-400 animate-pulse" />
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="relative flex items-center justify-center py-2 h-16">
            <Toggle
              pressed={sessionActive}
              onPressedChange={(pressed) => {
                if (pressed && !sessionActive) onStartSession();
                if (!pressed && sessionActive) onStopSession();
              }}
              className={cn(
                "w-12 h-12 rounded-full border border-slate-200 shadow-sm transition-transform duration-500",
                sessionActive ? "bg-emerald-50" : "bg-white",
                sessionActive ? "-translate-x-[6rem] md:-translate-x-[9rem]" : "translate-x-0",
                sessionActive && "animate-[pulse_1.8s_ease-in-out_infinite]"
              )}
              aria-label="Ativar microfone"
            >
              {sessionActive ? <Mic className="w-5 h-5 text-emerald-600" /> : <MicOff className="w-5 h-5 text-slate-500" />}
            </Toggle>

            <div
              className={cn(
                "absolute w-full max-w-sm h-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden transition-all duration-300",
                sessionActive ? "opacity-100 scale-100" : "opacity-50 scale-95"
              )}
              onMouseDown={(e) => {
                if (!sessionActive || !recorderReady) return;
                e.preventDefault();
                if (!isPressed) onStartSession();
              }}
              onMouseUp={(e) => {
                if (!sessionActive || !recorderReady) return;
                e.preventDefault();
                if (isPressed) onStopSession();
              }}
            >
              <WaveAnimation
                active={sessionActive && recorderReady && isPressed}
                subtle={sessionActive && (!isPressed || !recorderReady)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <div>{sessionActive ? (recorderReady ? "Mic pronto" : "Ativando microfone...") : "Ative o mic"}</div>
            {sessionActive && <span className="uppercase tracking-wide">Hold to talk</span>}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <ShieldAlert className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WaveAnimation({ active, subtle }: { active: boolean; subtle: boolean }) {
  const bars = [0, 80, 160];
  return (
    <div className="flex gap-2">
      {bars.map((delay) => (
        <span
          key={delay}
          className={cn("inline-block w-1.5 rounded-full", active ? "bg-rose-500" : "bg-slate-400")}
          style={{
            height: "18px",
            animation: active ? `wave 1s ${delay}ms infinite` : subtle ? `waveIdle 1.8s ${delay}ms infinite` : "none",
            opacity: active ? 1 : subtle ? 0.6 : 0.4,
          }}
        />
      ))}
      <style>
        {`
          @keyframes wave {
            0%, 100% { transform: scaleY(0.4); }
            50% { transform: scaleY(1.4); }
          }
          @keyframes waveIdle {
            0%, 100% { transform: scaleY(0.4); }
            50% { transform: scaleY(0.8); }
          }
        `}
      </style>
    </div>
  );
}
