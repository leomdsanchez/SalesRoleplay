import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  type VoiceAgentSettings,
  defaultSettings,
  LLMModels,
  STTModels,
  TTSModels,
  TTSVoices,
} from "@shared/settings-schema";

export function VoiceSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<VoiceAgentSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/voice/settings", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/voice/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        console.log("Settings saved successfully");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/v2")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Voice Agent Settings</h1>
              <p className="text-xs text-muted-foreground">Customize your voice assistant</p>
            </div>
          </div>

          <Button onClick={saveSettings} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </header>

      {/* Settings Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="voice">Voice</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4">
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
                    onValueChange={(value) =>
                      setSettings({ ...settings, llmModel: value as any })
                    }
                  >
                    <SelectTrigger id="llm-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LLMModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    gpt-4o-mini is fast and cost-effective. o1 models are best for complex reasoning.
                  </p>
                </div>

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
                    onValueChange={([value]) =>
                      setSettings({ ...settings, temperature: value })
                    }
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
                      setSettings({
                        ...settings,
                        maxTokens: parseInt(e.target.value) || 2000,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum response length (higher = longer responses, more cost)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice Tab */}
          <TabsContent value="voice" className="space-y-4">
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
                    onValueChange={(value) =>
                      setSettings({ ...settings, sttModel: value as any })
                    }
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
                    onChange={(e) =>
                      setSettings({ ...settings, sttLanguage: e.target.value })
                    }
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
                    onValueChange={(value) =>
                      setSettings({ ...settings, ttsModel: value as any })
                    }
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
                    onValueChange={(value) =>
                      setSettings({ ...settings, ttsVoice: value as any })
                    }
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prompt Tab */}
          <TabsContent value="prompt">
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
                  onChange={(e) =>
                    setSettings({ ...settings, systemPrompt: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-2">
                  The system prompt guides the assistant's responses and personality
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-4">
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
                    onValueChange={([value]) =>
                      setSettings({ ...settings, topP: value })
                    }
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
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, streamSentences: checked })
                    }
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
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, autoPlayAudio: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
