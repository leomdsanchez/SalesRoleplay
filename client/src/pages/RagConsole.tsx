import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface RagChunk {
  id: string;
  source: string;
  speaker: string;
  text: string;
  metadata?: string | null;
  createdAt: number;
}

interface RagSearchResult {
  id: string;
  source: string;
  text: string;
  score: number;
  metadata: Record<string, any> | null;
}

export default function RagConsole() {
  const { toast } = useToast();
  const [chunks, setChunks] = useState<RagChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RagSearchResult[]>([]);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    void fetchChunks();
  }, []);

  const fetchChunks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rag/chunks?limit=50", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Falha ao carregar chunks");
      }
      const data = await res.json();
      setChunks(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados do RAG.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const content = await file.text();
        const body = { source: file.name, content };
        const res = await fetch("/api/rag/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({ message: "Erro" }));
          throw new Error(error.message || "Falha no upload");
        }
      }
      toast({ title: "RAG atualizado", description: "Transcrições processadas." });
      await fetchChunks();
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível processar os arquivos.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: searchQuery, limit: 5 }),
      });
      if (!res.ok) {
        throw new Error("Falha na busca");
      }
      const data = await res.json();
      setSearchResults(data);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro na busca",
        description: error.message || "Não foi possível buscar no RAG.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload de Transcrições</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".txt,.json"
              multiple
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
            <p className="text-sm text-muted-foreground">
              Aceita arquivos .txt ou .json. Cada arquivo é processado em chunks automáticos
              e enviado para o mecanismo de RAG.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={clearing}
                onClick={async () => {
                  if (!confirm("Tem certeza que deseja limpar todo o RAG?")) return;
                  setClearing(true);
                  try {
                    const res = await fetch("/api/rag/clear", {
                      method: "POST",
                      credentials: "include",
                    });
                    if (!res.ok) {
                      throw new Error("Falha ao limpar");
                    }
                    toast({ title: "RAG limpo", description: "Base foi reiniciada." });
                    await fetchChunks();
                  } catch (error: any) {
                    console.error(error);
                    toast({
                      title: "Erro ao limpar",
                      description: error.message || "Não foi possível limpar o RAG.",
                      variant: "destructive",
                    });
                  } finally {
                    setClearing(false);
                  }
                }}
              >
                Limpar RAG
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teste de Busca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={3}
              placeholder="Digite uma frase para buscar trechos similares..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
              Buscar no RAG
            </Button>
            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div key={result.id} className="rounded border p-3 bg-white">
                    <div className="text-xs text-slate-500">
                      Fonte: {result.source} · Similaridade: {result.score.toFixed(3)}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{result.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chunks recentes ({chunks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!loading && chunks.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum chunk disponível ainda.</p>
            )}
            {!loading &&
              chunks.map((chunk) => (
                <div key={chunk.id} className="rounded border p-3 bg-white">
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>{chunk.source}</span>
                    <span>{new Date(chunk.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-medium mt-1">{chunk.speaker}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{chunk.text}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
