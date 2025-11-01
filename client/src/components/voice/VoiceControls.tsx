import { Button } from "@/components/ui/button";
import { Mic, MicOff, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  isRecording: boolean;
  isPressed: boolean;
  recorderReady: boolean;
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
  currentTranscript,
  isConnected,
  error,
  onStartSession,
  onStopSession,
}: VoiceControlsProps) {
  const handleToggle = () => {
    if (recorderReady) {
      onStopSession();
    } else {
      onStartSession();
    }
  };

  return (
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
            onClick={handleToggle}
            size="lg"
            className={cn(
              "flex-shrink-0 w-14 h-14 rounded-full transition-all duration-200",
              isPressed && recorderReady && "ring-4 ring-primary/30 scale-110"
            )}
            variant={recorderReady ? "destructive" : "default"}
          >
            {recorderReady ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </Button>

          <div className="flex-1 flex items-center gap-2 text-sm">
            {recorderReady && (
              <>
                <Radio
                  className={cn(
                    "w-4 h-4",
                    isPressed ? "text-red-500 animate-pulse" : "text-slate-400"
                  )}
                />
                <span className="text-slate-600">
                  {isPressed ? "Recording..." : "Hold space to talk"}
                </span>
              </>
            )}
            
            {!recorderReady && !isConnected && (
              <span className="text-slate-600">Click to activate</span>
            )}
          </div>

          <div className="flex-shrink-0 text-xs text-slate-500">
            {isConnected ? (
              <span className="text-green-600">● Connected</span>
            ) : recorderReady ? (
              <span className="text-orange-600">● Connecting...</span>
            ) : (
              <span className="text-slate-400">○ Inactive</span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}
