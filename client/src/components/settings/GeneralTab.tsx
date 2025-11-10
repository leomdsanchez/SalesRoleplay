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
import { LLMModels, type VoiceAgentSettings, getModelLabel, isGPT5Model } from "@shared/settings-schema";
import { cn } from "@/lib/utils";

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
            gpt-5-chat-latest is fastest for conversation. gpt-5-mini is cost-effective. gpt-5-nano is cheapest. gpt-4o-mini is fast multimodal.
          </p>
        </div>

        {isGPT5Model(settings.llmModel) && (
          <>
            <div className="space-y-2">
              <Label htmlFor="reasoning-effort">Reasoning Effort</Label>
              <Select
                value={
                  settings.llmModel === "gpt-5-chat-latest"
                    ? "low"
                    : settings.reasoningEffort
                }
                onValueChange={(value: "low" | "medium" | "high") =>
                  onUpdate({ reasoningEffort: value })
                }
                disabled={settings.llmModel === "gpt-5-chat-latest"}
              >
                <SelectTrigger
                  id="reasoning-effort"
                  className={cn(
                    settings.llmModel === "gpt-5-chat-latest" &&
                      "bg-slate-100 text-slate-500 cursor-not-allowed"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Fast responses</SelectItem>
                  <SelectItem value="medium">Medium - Balanced</SelectItem>
                  <SelectItem value="high">High - Deep reasoning</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How much reasoning effort to apply (affects speed and accuracy)
                {settings.llmModel === "gpt-5-chat-latest" &&
                  " (fixado em Low para gpt-5-chat-latest)."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verbosity">Verbosity</Label>
              <Select
                value={
                  settings.llmModel === "gpt-5-chat-latest"
                    ? "medium"
                    : settings.verbosity
                }
                onValueChange={(value: "low" | "medium" | "high") =>
                  onUpdate({ verbosity: value })
                }
                disabled={settings.llmModel === "gpt-5-chat-latest"}
              >
                <SelectTrigger
                  id="verbosity"
                  className={cn(
                    settings.llmModel === "gpt-5-chat-latest" &&
                      "bg-slate-100 text-slate-500 cursor-not-allowed"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Concise</SelectItem>
                  <SelectItem value="medium">Medium - Balanced</SelectItem>
                  <SelectItem value="high">High - Detailed</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Control response length and detail level
                {settings.llmModel === "gpt-5-chat-latest" &&
                  " (fixado em Medium para gpt-5-chat-latest)."}
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>GPT-5 Note:</strong> Temperature control is not available for GPT-5 models. They use the default temperature (1.0) for optimal reasoning performance.
              </p>
            </div>
          </>
        )}

        {!isGPT5Model(settings.llmModel) && (
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
        )}

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
