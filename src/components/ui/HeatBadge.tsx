import clsx from "clsx";
import type { HeatLevel, RiskTrend } from "../../lib/risk";

const HEAT_STYLES: Record<HeatLevel, string> = {
  critical: "border-red-500/20 bg-red-500/10 text-red-300",
  elevated: "border-orange-500/20 bg-orange-500/10 text-orange-300",
  watch: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  calm: "border-emerald/20 bg-emerald/10 text-emerald",
};

const TREND_STYLES: Record<RiskTrend, string> = {
  rising: "text-red-300",
  stable: "text-zinc-400",
  cooling: "text-emerald",
};

export default function HeatBadge({
  heatLevel,
  trend,
  className,
}: {
  heatLevel: HeatLevel;
  trend?: RiskTrend;
  className?: string;
}) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", HEAT_STYLES[heatLevel], className)}>
      <span>{heatLevel}</span>
      {trend ? <span className={clsx("normal-case tracking-normal", TREND_STYLES[trend])}>{trend}</span> : null}
    </span>
  );
}
