import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Database } from "lucide-react";
import { useLocation } from "wouter";

interface SettingsHeaderProps {
  isSaving: boolean;
  onSave: () => void;
}

export function SettingsHeader({ isSaving, onSave }: SettingsHeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold">Voice Agent Settings</h1>
            <p className="text-xs text-muted-foreground">Customize your voice assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/rag")}
          >
            <Database className="w-4 h-4 mr-2" />
            RAG Console
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </header>
  );
}
