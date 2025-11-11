import { Button } from "@/components/ui/button";
import { Settings, LogOut, Mic } from "lucide-react";
import { LoginScreen } from "@/components/voice/LoginScreen";
import { VoiceChat } from "@/components/voice/VoiceChat";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";

/**
 * Voice Agent V2 - Arquitetura limpa com separação de responsabilidades
 * 
 * Estrutura:
 * - useAuth: gerencia autenticação
 * - useVoiceAgent: orquestra recorder + keyboard + websocket
 * - VoiceChat: UI do chat
 * - VoiceControls: UI dos controles
 */
export default function VoiceAgentV2() {
  const { user, loading: authLoading, login, register, logout } = useAuth();

  const {
    messages,
    currentTranscript,
    streamingText,
    isConnected,
    recorderReady,
    isRecording,
    isPressed,
    error,
    confidence,
    confidenceReason,
    settings: agentSettings,
    startSession,
    stopSession,
  } = useVoiceAgent({
    userId: user?.id,
  });

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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-white/80 backdrop-blur-sm z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Voice Agent V2</h1>
              <p className="text-xs text-muted-foreground">{user.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => window.location.href = "/settings"}
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

      {/* Chat Area - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <VoiceChat
          messages={messages}
          currentTranscript={currentTranscript}
          streamingText={streamingText}
        />
      </div>

      {agentSettings?.confidenceVisible && typeof confidence === "number" && (
        <div className="fixed bottom-28 right-6 z-30">
          {(() => {
            const clamped = Math.max(-1, Math.min(1, confidence));
            const barColor = clamped < 0 ? "bg-red-500" : "bg-emerald-500";
            const positiveWidth = `${(clamped > 0 ? clamped : 0) * 50}%`;
            const negativeWidth = `${(clamped < 0 ? Math.abs(clamped) : 0) * 50}%`;
            return (
              <div className="bg-white shadow-lg border rounded-lg px-4 py-3 text-sm text-slate-600 flex flex-col gap-2 w-64">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Confiança</span>
                  <span
                    className={clamped < 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}
                  >
                    {clamped.toFixed(2)}
                  </span>
                </div>
                <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400"></div>
                  {clamped >= 0 ? (
                    <div
                      className={`absolute top-0 bottom-0 ${barColor} transition-all duration-300`}
                      style={{ left: "50%", width: positiveWidth }}
                    ></div>
                  ) : (
                    <div
                      className={`absolute top-0 bottom-0 ${barColor} transition-all duration-300`}
                      style={{ right: "50%", width: negativeWidth }}
                    ></div>
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>-1</span>
                  <span>0</span>
                  <span>1</span>
                </div>
                {confidenceReason && (
                  <p className="text-xs text-slate-500">{confidenceReason}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Controls - fixed at bottom */}
      <div className="flex-shrink-0">
        <VoiceControls
          isRecording={isRecording}
          isPressed={isPressed}
          recorderReady={recorderReady}
          currentTranscript={currentTranscript}
          isConnected={isConnected}
          error={error}
          onStartSession={startSession}
          onStopSession={stopSession}
        />
      </div>
    </div>
  );
}
