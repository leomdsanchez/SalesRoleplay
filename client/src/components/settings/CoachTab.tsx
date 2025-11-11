import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LLMModels, type VoiceAgentSettings, getModelLabel } from "@shared/settings-schema";

interface CoachTabProps {
  settings: VoiceAgentSettings;
  onUpdate: (updates: Partial<VoiceAgentSettings>) => void;
}

export function CoachTab({ settings, onUpdate }: CoachTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coach de Desempenho</CardTitle>
        <CardDescription>
          Configure o agente avaliador que mede confiança, ritmo e fillers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="coach-model">Modelo</Label>
          <Select
            value={settings.coachModel}
            onValueChange={(value) => onUpdate({ coachModel: value as any })}
          >
            <SelectTrigger id="coach-model">
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="coach-prompt">Prompt do Coach</Label>
          <Textarea
            id="coach-prompt"
            rows={8}
            value={settings.coachPrompt}
            onChange={(e) => onUpdate({ coachPrompt: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Esse prompt guia o agente que calcula nível de confiança, WPM e percentual de fillers com base na conversa.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Mostrar indicador no chat</Label>
            <p className="text-xs text-muted-foreground">
              Exibe o nível atual de confiança durante a ligação
            </p>
          </div>
          <Switch
            checked={settings.coachVisible}
            onCheckedChange={(checked) => onUpdate({ coachVisible: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
