import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STTModels, TTSModels, TTSVoices, type VoiceAgentSettings } from "@shared/settings-schema";

interface VoiceTabProps {
  settings: VoiceAgentSettings;
  onUpdate: (updates: Partial<VoiceAgentSettings>) => void;
}

export function VoiceTab({ settings, onUpdate }: VoiceTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Speech Recognition (STT)</CardTitle>
          <CardDescription>
            Configure speech-to-text settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stt-model">STT Model</Label>
            <Select
              value={settings.sttModel}
              onValueChange={(value) => onUpdate({ sttModel: value as any })}
            >
              <SelectTrigger id="stt-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STTModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stt-language">Language</Label>
            <Input
              id="stt-language"
              placeholder="pt, en, es, fr..."
              value={settings.sttLanguage}
              onChange={(e) => onUpdate({ sttLanguage: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              ISO 639-1 language code for speech recognition
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Text-to-Speech (TTS)</CardTitle>
          <CardDescription>
            Configure voice output settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tts-model">TTS Model</Label>
            <Select
              value={settings.ttsModel}
              onValueChange={(value) => onUpdate({ ttsModel: value as any })}
            >
              <SelectTrigger id="tts-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTSModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              tts-1-hd has higher quality but is slower
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tts-voice">Voice</Label>
            <Select
              value={settings.ttsVoice}
              onValueChange={(value) => onUpdate({ ttsVoice: value as any })}
            >
              <SelectTrigger id="tts-voice">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTSVoices.map((voice) => (
                  <SelectItem key={voice} value={voice}>
                    {voice}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tts-language">Language</Label>
            <Input
              id="tts-language"
              placeholder="pt, en, es, fr..."
              value={settings.ttsLanguage}
              onChange={(e) => onUpdate({ ttsLanguage: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              ISO 639-1 language code for voice generation (inferred from text)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
