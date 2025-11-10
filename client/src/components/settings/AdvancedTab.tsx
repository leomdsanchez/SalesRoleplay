import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type VoiceAgentSettings } from "@shared/settings-schema";

interface AdvancedTabProps {
  settings: VoiceAgentSettings;
  onUpdate: (updates: Partial<VoiceAgentSettings>) => void;
}

export function AdvancedTab({ settings, onUpdate }: AdvancedTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced Settings</CardTitle>
        <CardDescription>
          Fine-tune model parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="top-p">Top P (Nucleus Sampling)</Label>
            <span className="text-sm text-muted-foreground">
              {settings.topP}
            </span>
          </div>
          <Slider
            id="top-p"
            min={0}
            max={1}
            step={0.05}
            value={[settings.topP]}
            onValueChange={([value]) => onUpdate({ topP: value })}
          />
          <p className="text-xs text-muted-foreground">
            Controls diversity via nucleus sampling (0.1 = conservative, 1.0 = diverse)
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Stream Sentences</Label>
            <p className="text-xs text-muted-foreground">
              Stream text word-by-word for smoother UI
            </p>
          </div>
          <Switch
            checked={settings.streamSentences}
            onCheckedChange={(checked) => onUpdate({ streamSentences: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto-play Audio</Label>
            <p className="text-xs text-muted-foreground">
              Automatically play assistant audio responses
            </p>
          </div>
          <Switch
            checked={settings.autoPlayAudio}
            onCheckedChange={(checked) => onUpdate({ autoPlayAudio: checked })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="rag-limit">RAG References</Label>
            <span className="text-sm text-muted-foreground">
              {settings.ragReferenceLimit}
            </span>
          </div>
          <Slider
            id="rag-limit"
            min={0}
            max={10}
            step={1}
            value={[settings.ragReferenceLimit]}
            onValueChange={([value]) => onUpdate({ ragReferenceLimit: value })}
          />
          <p className="text-xs text-muted-foreground">
            Número máximo de referências reais adicionadas ao prompt (0 desativa RAG).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rag-intro">Texto antes das referências RAG</Label>
          <Textarea
            id="rag-intro"
            value={settings.ragPromptIntro}
            onChange={(e) => onUpdate({ ragPromptIntro: e.target.value })}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Esse texto é concatenado ao system prompt original seguido das referências recuperadas.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
