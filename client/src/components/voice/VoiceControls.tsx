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
  inputLevel: number;
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
  inputLevel,
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
                "relative z-10 w-12 h-12 rounded-full border shadow-sm transition-transform duration-500",
                "data-[state=on]:bg-blue-500 data-[state=on]:border-blue-400 data-[state=on]:text-white",
                "data-[state=off]:bg-white data-[state=off]:border-slate-200 data-[state=off]:text-slate-500",
                sessionActive ? "-translate-x-[6rem] md:-translate-x-[9rem]" : "translate-x-0"
              )}
              aria-label="Ativar microfone"
            >
              {sessionActive ? (
                <Mic className="w-5 h-5 text-white" />
              ) : (
                <MicOff className="w-5 h-5 text-slate-500" />
              )}
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
                isActive={sessionActive && recorderReady && isPressed && isRecording}
                inputLevel={inputLevel}
              />
            </div>
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

function WaveAnimation({ isActive, inputLevel }: { isActive: boolean; inputLevel: number }) {
  const bars = [0.8, 1.2, 1];
  return (
    <div className={cn("flex items-end", isActive ? "gap-3" : "gap-2")}>
      {bars.map((multiplier, index) => {
        const level = Math.min(1, inputLevel * multiplier);
        const height = isActive ? 8 + level * 28 : 8;
        const width = isActive ? 6 : 9;
        return (
          <span
            key={index}
            className={cn(
              "block rounded-full transition-[height,width,opacity,background-color] duration-150 ease-out",
              isActive ? "bg-blue-500" : "bg-slate-400"
            )}
            style={{
              height,
              width,
              opacity: isActive ? 0.95 : 0.6,
            }}
          />
        );
      })}
    </div>
  );
}
