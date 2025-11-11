import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Activity, BarChart3, Brain, ChevronLeft, ChevronRight } from "lucide-react";
import type { SpeechAnalytics } from "@/hooks/useVoiceAgent";
import { useMemo } from "react";

interface VoiceInsightsPanelProps {
  open: boolean;
  onToggle: () => void;
  confidenceVisible: boolean;
  confidenceValue: number | null;
  confidenceReason?: string | null;
  speechAnalytics?: SpeechAnalytics | null;
}

const clampConfidence = (value: number) => Math.max(-1, Math.min(1, value));

const fillerLevel = (rate: number | null) => {
  if (rate == null) {
    return { label: "Sem dados", tone: "text-muted-foreground", helper: "Aguardando transcrição com Whisper" };
  }
  if (rate < 0.05) {
    return { label: "Excelente", tone: "text-emerald-600", helper: "Quase nenhum vício de linguagem detectado" };
  }
  if (rate < 0.12) {
    return { label: "Atenção", tone: "text-amber-600", helper: "Alguns fillers percebidos durante a fala" };
  }
  return { label: "Alerta", tone: "text-rose-600", helper: "Forte presença de fillers; oriente o vendedor" };
};

const formatNumber = (value: number | null, digits = 0) => {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
};

export function VoiceInsightsPanel({
  open,
  onToggle,
  confidenceVisible,
  confidenceValue,
  confidenceReason,
  speechAnalytics,
}: VoiceInsightsPanelProps) {
  const fillerInfo = useMemo(
    () => fillerLevel(speechAnalytics?.fillerRate ?? null),
    [speechAnalytics?.fillerRate]
  );

  const hasSpeechData = Boolean(speechAnalytics?.hasGranularData && speechAnalytics.sampleCount > 0);

  return (
    <aside
      className={cn(
        "relative border-l border-slate-200 bg-white/85 backdrop-blur-xl transition-all duration-300",
        open ? "w-80" : "w-12"
      )}
    >
      <button
        onClick={onToggle}
        className="absolute -left-3 top-6 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow"
        aria-label={open ? "Recolher painel" : "Expandir painel"}
      >
        {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {open && (
        <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Brain className="h-4 w-4 text-primary" />
              Confiança do Lead
            </div>
            {confidenceVisible ? (
              typeof confidenceValue === "number" ? (
                <ConfidenceMeter value={confidenceValue} reason={confidenceReason} />
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Aguardando primeira avaliação de confiança.</p>
              )
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Esta métrica está desativada nas configurações.</p>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Activity className="h-4 w-4 text-primary" />
              Ritmo & fala
            </div>

            {hasSpeechData ? (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">WPM atual</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {formatNumber(speechAnalytics?.lastWpm ? Math.round(speechAnalytics.lastWpm) : null)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Média na sessão: {formatNumber(speechAnalytics?.averageWpm ? Math.round(speechAnalytics.averageWpm) : null)}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Fillers</p>
                      <p className={cn("text-lg font-semibold", fillerInfo.tone)}>
                        {formatNumber((speechAnalytics?.fillerRate ?? 0) * 100, 1)}%
                      </p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", fillerInfo.tone)}>
                      {fillerInfo.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{fillerInfo.helper}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                <p>
                  Ative <span className="font-medium">Whisper + verbose_json</span> para liberar WPM e análise de fillers.
                </p>
                <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                  <a href="/settings#voice">Abrir configurações</a>
                </Button>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BarChart3 className="h-4 w-4 text-primary" />
              Insights futuros
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• Alertas de interrupção</li>
              <li>• Comparação com script ideal</li>
              <li>• Recomendações em tempo real</li>
            </ul>
          </section>
        </div>
      )}
    </aside>
  );
}

interface ConfidenceMeterProps {
  value: number;
  reason?: string | null;
}

function ConfidenceMeter({ value, reason }: ConfidenceMeterProps) {
  const clamped = clampConfidence(value);
  const barColor = clamped < 0 ? "bg-rose-500" : "bg-emerald-500";
  const positiveWidth = `${(clamped > 0 ? clamped : 0) * 50}%`;
  const negativeWidth = `${(clamped < 0 ? Math.abs(clamped) : 0) * 50}%`;

  const sentiment =
    clamped < 0 ? "Crítico" : clamped < 0.4 ? "Neutro" : "Confiante";
  const sentimentTone =
    clamped < 0 ? "text-rose-600" : clamped < 0.4 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="mt-4 space-y-3 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className={cn("font-semibold", sentimentTone)}>{sentiment}</p>
        </div>
        <span className={cn("text-lg font-semibold", sentimentTone)}>{clamped.toFixed(2)}</span>
      </div>

      <div className="relative h-2 rounded-full bg-slate-200">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400" />
        {clamped >= 0 ? (
          <div className={cn("absolute top-0 bottom-0 transition-all duration-300", barColor)} style={{ left: "50%", width: positiveWidth }} />
        ) : (
          <div className={cn("absolute top-0 bottom-0 transition-all duration-300", barColor)} style={{ right: "50%", width: negativeWidth }} />
        )}
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>-1</span>
        <span>0</span>
        <span>1</span>
      </div>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
    </div>
  );
}
