import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
      </CardContent>
    </Card>
  );
}
