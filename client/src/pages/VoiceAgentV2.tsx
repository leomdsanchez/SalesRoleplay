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
          confidence={confidence ?? undefined}
          showConfidence={agentSettings?.confidenceVisible}
        />
      </div>

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
