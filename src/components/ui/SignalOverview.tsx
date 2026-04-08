import clsx from "clsx";
import type { EventReliability } from "../../lib/reliability";

function toneClass(level: EventReliability["level"]) {
  if (level === "high") return "border-emerald/20 bg-emerald/10 text-emerald";
  if (level === "solid") return "border-cyan/20 bg-cyan/10 text-cyan";
  return "border-amber-400/20 bg-amber-400/10 text-amber-300";
}

export default function SignalOverview({
  reliability,
  className,
}: {
  reliability?: EventReliability | null;
  className?: string;
}) {
  if (!reliability) return null;

  const metrics = [
    { label: "Signal", value: reliability.label, detail: `${Math.round(reliability.overallScore * 100)} / 100` },
    { label: "Corroboration", value: reliability.corroborationLabel, detail: `${reliability.supportCount} sources` },
    { label: "Freshness", value: reliability.freshnessLabel, detail: reliability.freshnessDetail },
    { label: "Feed health", value: reliability.feedHealthLabel, detail: reliability.feedHealthNote },
  ];

  return (
    <div className={clsx("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={clsx("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", toneClass(reliability.level))}>
          {reliability.label}
        </span>
        <span className="rounded-full border border-white/[0.07] bg-black/45 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          {Math.round(reliability.overallScore * 100)} / 100 confidence
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-[20px] border border-white/[0.06] bg-black/55 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{metric.label}</p>
            <p className="mt-2 text-sm font-semibold text-white">{metric.value}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{metric.detail}</p>
          </div>
        ))}
      </div>
      <div className="rounded-[20px] border border-white/[0.06] bg-black/45 px-4 py-3 text-sm leading-6 text-zinc-400">
        {reliability.note}
      </div>
    </div>
  );
}
