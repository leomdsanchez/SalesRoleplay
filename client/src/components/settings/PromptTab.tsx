import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type VoiceAgentSettings } from "@shared/settings-schema";

interface PromptTabProps {
  settings: VoiceAgentSettings;
  onUpdate: (updates: Partial<VoiceAgentSettings>) => void;
}

export function PromptTab({ settings, onUpdate }: PromptTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Prompt</CardTitle>
        <CardDescription>
          Define the personality and behavior of your assistant
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="You are a helpful assistant..."
          className="min-h-[300px] font-mono text-sm"
          value={settings.systemPrompt}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-2">
          The system prompt guides the assistant's responses and personality
        </p>
      </CardContent>
    </Card>
  );
}
