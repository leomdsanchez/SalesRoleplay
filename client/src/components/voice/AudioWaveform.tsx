import { cn } from "@/lib/utils";

const BAR_MULTIPLIERS = [
  0.4,
  0.7,
  1,
  1.3,
  1.6,
  1.85,
  2,
  2.15,
  2,
  1.85,
  1.6,
  1.3,
  1,
  0.7,
  0.4,
];

interface AudioWaveformProps {
  volume: number;
  isActive: boolean;
  isSpeaking: boolean;
}

/**
 * Visual waveform indicator for push-to-talk recording.
 * Renders animated bars based on the current audio volume.
 */
export function AudioWaveform({ volume, isActive, isSpeaking }: AudioWaveformProps) {
  const normalized = Math.min(1, Math.max(0, volume));
  const baseHeight = 6; // px
  const maxHeight = 36; // px

  return (
    <div
      className={cn(
        "flex items-end gap-[3px] h-10 transition-opacity duration-200",
        isActive ? "opacity-100" : "opacity-30"
      )}
      aria-hidden="true"
    >
      {BAR_MULTIPLIERS.map((multiplier, index) => {
        const height = baseHeight + normalized * multiplier * (maxHeight - baseHeight);
        return (
          <span
            key={index}
            className={cn(
              "w-[3px] rounded-full transition-all duration-100 ease-out",
              isActive ? (isSpeaking ? "bg-red-500" : "bg-primary") : "bg-slate-300"
            )}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}
