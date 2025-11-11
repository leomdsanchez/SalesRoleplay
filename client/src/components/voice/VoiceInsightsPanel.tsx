import { cn } from "@/lib/utils";
import { Activity, Brain, ChevronLeft, ChevronRight, Droplet } from "lucide-react";
import type { SpeechAnalytics, CoachMetrics } from "@/hooks/useVoiceAgent";
import { useMemo } from "react";

interface VoiceInsightsPanelProps {
  open: boolean;
  onToggle: () => void;
  coachVisible: boolean;
  confidenceValue: number | null;
  coachNotes?: string | null;
  speechAnalytics?: SpeechAnalytics | null;
  coachMetrics?: CoachMetrics | null;
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
  coachVisible,
  confidenceValue,
  coachNotes,
  speechAnalytics,
  coachMetrics,
}: VoiceInsightsPanelProps) {
  const fillerRate =
    coachMetrics?.fillerRate ?? speechAnalytics?.fillerRate ?? null;
  const fillerInfo = useMemo(() => fillerLevel(fillerRate), [fillerRate]);

  const lastWpm = speechAnalytics?.lastWpm ?? null;
  const averageWpm = speechAnalytics?.averageWpm ?? null;
  const hasSpeechData = Boolean(
    (lastWpm && lastWpm > 0) ||
      (averageWpm && averageWpm > 0) ||
      (speechAnalytics?.hasGranularData && speechAnalytics.sampleCount > 0)
  );

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
            Confiança
          </div>
            {coachVisible ? (
              typeof confidenceValue === "number" ? (
                <ConfidenceMeter value={confidenceValue} notes={coachNotes} />
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
              Ritmo (WPM)
            </div>

            {hasSpeechData ? (
              <div className="mt-4 text-sm">
                <RhythmBar currentWpm={lastWpm} averageWpm={averageWpm} />
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                <p>
                  Ative o <span className="font-medium">Coach</span> ou use STT com timestamps para liberar métricas de ritmo e fillers.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Droplet className="h-4 w-4 text-primary" />
              Fill Rate
            </div>
            {hasSpeechData ? (
              <div className="mt-4">
                <FillerBar
                  percentage={fillerRate != null ? fillerRate * 100 : null}
                  helper={fillerInfo.helper}
                  tone={fillerInfo.tone}
                  label={fillerInfo.label}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                <p>
                  Ative o <span className="font-medium">Coach</span> ou use STT com timestamps para liberar métricas de ritmo e fillers.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

interface ConfidenceMeterProps {
  value: number;
  notes?: string | null;
}

function ConfidenceMeter({ value, notes }: ConfidenceMeterProps) {
  const clamped = clampConfidence(value);
  const sentiment = clamped < 0 ? "Crítico" : clamped < 0.4 ? "Neutro" : "Confiante";
  const theme = getConfidenceTheme(clamped);

  return (
    <div className="mt-4 space-y-3 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className={cn("font-semibold", theme.textClass)}>{sentiment}</p>
        </div>
        <span className={cn("text-lg font-semibold", theme.textClass)}>{clamped.toFixed(2)}</span>
      </div>

      <MetricBar
        percentage={((clamped + 1) / 2) * 100}
        theme={theme.name}
        targetRange={{ start: 45, end: 55, color: "rgba(209,213,219,0.6)" }}
      />

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>-1</span>
        <span>0</span>
        <span>1</span>
      </div>
      {notes && <p className="text-xs text-muted-foreground">{notes}</p>}
    </div>
  );
}

interface RhythmGaugeProps {
  currentWpm: number | null;
  averageWpm: number | null;
  targetRange?: [number, number];
  min?: number;
  max?: number;
}

function RhythmBar({ currentWpm, averageWpm, targetRange = [110, 150], min = 70, max = 200 }: RhythmGaugeProps) {
  const displayValue = currentWpm ?? averageWpm ?? (targetRange[0] + targetRange[1]) / 2;
  const safeValue = clampNumber(displayValue, min, max);
  const minPct = ((safeValue - min) / (max - min)) * 100;
  const targetStartPercent = ((targetRange[0] - min) / (max - min)) * 100;
  const targetEndPercent = ((targetRange[1] - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <MetricBar
        percentage={minPct}
        theme="info"
        targetRange={{ start: targetStartPercent, end: targetEndPercent, color: "rgba(167,243,208,0.6)" }}
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{min} WPM</span>
        <span>{max} WPM</span>
      </div>
      <div className="text-center">
        <p className="text-2xl font-semibold text-slate-900">{formatNumber(displayValue ? Math.round(displayValue) : null)}</p>
        <p className="text-xs text-muted-foreground">
          Ideal: {targetRange[0]}–{targetRange[1]} WPM · Média: {formatNumber(averageWpm ? Math.round(averageWpm) : null)}
        </p>
      </div>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface FillerBarProps {
  percentage: number | null;
  helper: string;
  tone: string;
  label: string;
}

function FillerBar({ percentage, helper, tone, label }: FillerBarProps) {
  const theme = tone.includes("emerald") ? "success" : tone.includes("amber") ? "warning" : "danger";
  return (
    <div className="rounded-lg bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Fillers</p>
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", tone)}>{label}</span>
      </div>
      <MetricBar percentage={percentage} theme={theme as MetricTheme} targetRange={{ start: 0, end: 5, color: "rgba(167,243,208,0.5)" }} />
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className={tone}>{formatNumber(percentage, 1)}%</span>
      </div>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

type MetricTheme = "success" | "warning" | "danger" | "info" | "neutral";

const themeConfig: Record<MetricTheme, { fill: string; knob: string; textClass: string }> = {
  success: {
    fill: "linear-gradient(90deg,#34d399,#059669)",
    knob: "linear-gradient(135deg,#34d399,#10b981)",
    textClass: "text-emerald-600",
  },
  warning: {
    fill: "linear-gradient(90deg,#fbbf24,#f97316)",
    knob: "linear-gradient(135deg,#fb923c,#f97316)",
    textClass: "text-amber-600",
  },
  danger: {
    fill: "linear-gradient(90deg,#f87171,#dc2626)",
    knob: "linear-gradient(135deg,#ef4444,#dc2626)",
    textClass: "text-rose-600",
  },
  info: {
    fill: "linear-gradient(90deg,#60a5fa,#2563eb)",
    knob: "linear-gradient(135deg,#3b82f6,#2563eb)",
    textClass: "text-sky-600",
  },
  neutral: {
    fill: "linear-gradient(90deg,#94a3b8,#64748b)",
    knob: "linear-gradient(135deg,#94a3b8,#64748b)",
    textClass: "text-slate-600",
  },
};

interface MetricBarProps {
  percentage: number | null;
  theme: MetricTheme;
  targetRange?: { start: number; end: number; color?: string };
}

function MetricBar({ percentage, theme, targetRange }: MetricBarProps) {
  const colors = themeConfig[theme];
  const clamped = percentage == null ? null : Math.max(0, Math.min(100, percentage));
  const targetWidth = targetRange ? Math.max(0, targetRange.end - targetRange.start) : 0;

  return (
    <div className="relative h-3 rounded-full bg-slate-200 overflow-hidden">
      {targetRange && targetWidth > 0 && (
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{ left: `${targetRange.start}%`, width: `${targetWidth}%`, background: targetRange.color ?? "rgba(209,213,219,0.5)" }}
        />
      )}
      {clamped != null && (
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{ width: `${clamped}%`, background: colors.fill }}
        />
      )}
      {clamped != null && (
        <div
          className="absolute top-1/2 h-4 w-4 -mt-2 rounded-full border-2 border-white shadow-sm"
          style={{ left: `${clamped}%`, transform: "translateX(-50%)", background: colors.knob }}
        />
      )}
    </div>
  );
}

function getConfidenceTheme(value: number): { name: MetricTheme; textClass: string } {
  if (value >= 0.4) return { name: "success", textClass: "text-emerald-600" };
  if (value <= -0.2) return { name: "danger", textClass: "text-rose-600" };
  return { name: "warning", textClass: "text-amber-600" };
}
