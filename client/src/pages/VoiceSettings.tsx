import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type VoiceAgentSettings, defaultSettings } from "@shared/settings-schema";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { VoiceTab } from "@/components/settings/VoiceTab";
import { PromptTab } from "@/components/settings/PromptTab";
import { AdvancedTab } from "@/components/settings/AdvancedTab";
import { ConfidenceTab } from "@/components/settings/ConfidenceTab";
import { useToast } from "@/hooks/use-toast";

export function VoiceSettings() {
  const [settings, setSettings] = useState<VoiceAgentSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

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
      } else {
        toast({
          title: "Error loading settings",
          description: "Failed to load voice settings. Using defaults.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast({
        title: "Error loading settings",
        description: "Failed to load voice settings. Using defaults.",
        variant: "destructive",
      });
    }
  };

  const updateSettings = useCallback((updates: Partial<VoiceAgentSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

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
        toast({
          title: "Settings saved",
          description: "Your voice agent settings have been updated successfully.",
        });
        // Refetch to ensure sync
        await fetchSettings();
      } else {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        toast({
          title: "Error saving settings",
          description: errorData.message || "Failed to save settings. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Error saving settings",
        description: "Failed to save settings. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <SettingsHeader isSaving={isSaving} onSave={saveSettings} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="voice">Voice</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="confidence">Confiança</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-6">
            <GeneralTab settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="voice" className="space-y-4 mt-6">
            <VoiceTab settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4 mt-6">
            <PromptTab settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-6">
            <AdvancedTab settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="confidence" className="space-y-4 mt-6">
            <ConfidenceTab settings={settings} onUpdate={updateSettings} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
