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

interface ConfidenceTabProps {
  settings: VoiceAgentSettings;
  onUpdate: (updates: Partial<VoiceAgentSettings>) => void;
}

export function ConfidenceTab({ settings, onUpdate }: ConfidenceTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confiança do Cliente</CardTitle>
        <CardDescription>
          Configure o agente avaliador de confiança (coach)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="confidence-model">Modelo</Label>
          <Select
            value={settings.confidenceModel}
            onValueChange={(value) => onUpdate({ confidenceModel: value as any })}
          >
            <SelectTrigger id="confidence-model">
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
          <Label htmlFor="confidence-prompt">Prompt do Coach</Label>
          <Textarea
            id="confidence-prompt"
            rows={8}
            value={settings.confidencePrompt}
            onChange={(e) => onUpdate({ confidencePrompt: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Esse prompt guia o agente que calcula o nível de confiança (-1 até 1) com base na conversa.
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
            checked={settings.confidenceVisible}
            onCheckedChange={(checked) => onUpdate({ confidenceVisible: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
