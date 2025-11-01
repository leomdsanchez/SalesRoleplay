import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LLMModels, type VoiceAgentSettings, getModelLabel, isGPT5ThinkingModel } from "@shared/settings-schema";

interface GeneralTabProps {
  settings: VoiceAgentSettings;
  onUpdate: (updates: Partial<VoiceAgentSettings>) => void;
}

export function GeneralTab({ settings, onUpdate }: GeneralTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Language Model</CardTitle>
        <CardDescription>
          Configure the AI model and its behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="llm-model">Model</Label>
          <Select
            value={settings.llmModel}
            onValueChange={(value) => onUpdate({ llmModel: value as any })}
          >
            <SelectTrigger id="llm-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LLMModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {getModelLabel(model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            GPT-5 is the latest. o1/gpt-5-thinking have reasoning. gpt-4o-mini is cost-effective.
          </p>
        </div>

        {isGPT5ThinkingModel(settings.llmModel) && (
          <div className="space-y-2">
            <Label htmlFor="reasoning-effort">Reasoning Effort</Label>
            <Select
              value={settings.reasoningEffort || "medium"}
              onValueChange={(value) => onUpdate({ reasoningEffort: value as any })}
            >
              <SelectTrigger id="reasoning-effort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (faster, cheaper)</SelectItem>
                <SelectItem value="medium">Medium (balanced)</SelectItem>
                <SelectItem value="high">High (maximum reasoning)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls how much compute is used for reasoning. Higher = better for complex problems.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="temperature">Temperature</Label>
            <span className="text-sm text-muted-foreground">
              {settings.temperature}
            </span>
          </div>
          <Slider
            id="temperature"
            min={0}
            max={2}
            step={0.1}
            value={[settings.temperature]}
            onValueChange={([value]) => onUpdate({ temperature: value })}
          />
          <p className="text-xs text-muted-foreground">
            Lower is more focused, higher is more creative
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-tokens">Max Tokens</Label>
          <Input
            id="max-tokens"
            type="number"
            value={settings.maxTokens}
            onChange={(e) =>
              onUpdate({ maxTokens: parseInt(e.target.value) || 2000 })
            }
          />
          <p className="text-xs text-muted-foreground">
            Maximum response length (higher = longer responses, more cost)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
