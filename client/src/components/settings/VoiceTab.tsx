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
import { Textarea } from "@/components/ui/textarea";
import {
  STTModels,
  STTResponseFormats,
  STTTimestampGranularities,
  TTSModels,
  TTSVoices,
  type VoiceAgentSettings,
  type STTModel,
  type STTResponseFormat,
} from "@shared/settings-schema";

interface VoiceTabProps {
  settings: VoiceAgentSettings;
  onUpdate: (updates: Partial<VoiceAgentSettings>) => void;
}

export function VoiceTab({ settings, onUpdate }: VoiceTabProps) {
  const supportsVerboseJson = settings.sttModel === "whisper-1";
  const supportsDiarizedFormat = settings.sttModel === "gpt-4o-transcribe-diarize";
  const canUseTimestamps = supportsVerboseJson && settings.sttResponseFormat === "verbose_json";

  const handleModelChange = (value: string) => {
    const model = value as STTModel;
    const updates: Partial<VoiceAgentSettings> = { sttModel: model };

    if (model !== "whisper-1" && settings.sttResponseFormat === "verbose_json") {
      updates.sttResponseFormat = "json";
    }

    if (model !== "gpt-4o-transcribe-diarize" && settings.sttResponseFormat === "diarized_json") {
      updates.sttResponseFormat = "json";
    }

    if (model !== "whisper-1" && settings.sttTimestampGranularity !== "none") {
      updates.sttTimestampGranularity = "none";
    }

    onUpdate(updates);
  };

  const handleResponseFormatChange = (value: string) => {
    const format = value as STTResponseFormat;
    const updates: Partial<VoiceAgentSettings> = { sttResponseFormat: format };

    if (format !== "verbose_json" && settings.sttTimestampGranularity !== "none") {
      updates.sttTimestampGranularity = "none";
    }

    onUpdate(updates);
  };

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
              onValueChange={handleModelChange}
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

          <div className="space-y-2">
            <Label htmlFor="stt-response-format">Response Format</Label>
            <Select
              value={settings.sttResponseFormat}
              onValueChange={handleResponseFormatChange}
            >
              <SelectTrigger id="stt-response-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STTResponseFormats.map((format) => (
                  <SelectItem
                    key={format}
                    value={format}
                    disabled={
                      (!supportsVerboseJson && format === "verbose_json") ||
                      (!supportsDiarizedFormat && format === "diarized_json")
                    }
                  >
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose <span className="font-medium">json</span> for structured transcripts.
              {" "}
              <span className="font-medium">verbose_json</span> unlocks word-level data and requires Whisper.
              {" "}
              <span className="font-medium">diarized_json</span> inclui falas com speaker e depende do modelo gpt-4o-transcribe-diarize.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stt-timestamps">Timestamp Granularity</Label>
              <Select
                value={settings.sttTimestampGranularity}
                onValueChange={(value) => onUpdate({ sttTimestampGranularity: value as any })}
                disabled={!canUseTimestamps}
              >
                <SelectTrigger id="stt-timestamps">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STTTimestampGranularities.map((granularity) => (
                    <SelectItem key={granularity} value={granularity}>
                      {granularity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {canUseTimestamps
                  ? "Precise timestamps drive WPM/filler analytics."
                  : "Ative Whisper + verbose_json para liberar timestamps."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stt-temperature">STT Temperature</Label>
              <Input
                id="stt-temperature"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.sttTemperature.toString()}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (Number.isNaN(value)) {
                    onUpdate({ sttTemperature: 0 });
                    return;
                  }
                  const clamped = Math.max(0, Math.min(1, value));
                  onUpdate({ sttTemperature: clamped });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Lower values keep hesitations and fillers; higher values allow more rewriting.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stt-prompt">STT Prompt</Label>
            <Textarea
              id="stt-prompt"
              placeholder="Context, vocabulary or instructions for the recognizer..."
              value={settings.sttPrompt}
              onChange={(e) => onUpdate({ sttPrompt: e.target.value })}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Provide optional context (e.g., product names, desired punctuation, filler words).
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
