import { usePatterns } from "../../lib/hooks/usePatterns";
import { formatPct } from "../../lib/format";
import { resolvePatternMove } from "../../lib/marketDisplay";
import SymbolHoverCard from "../ui/SymbolHoverCard";

export default function PatternInsightsCard() {
  const { patterns, isLoading } = usePatterns();

  const topPatterns = patterns
    .filter((p) => p.confidence >= 0.2 && p.occurrences >= 2)
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (topPatterns.length === 0) {
    return (
      <p className="text-[11px] text-zinc-600 py-4 text-center">
        Patterns appear after multiple ingestion cycles.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {topPatterns.map((p) => {
        const change = resolvePatternMove(p.direction, p.avgImpactPct);
        const isUp = change >= 0;

        return (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
          >
            <div>
              <SymbolHoverCard symbol={p.symbol}>
                <span className="text-[12px] font-bold text-zinc-300">{p.symbol} </span>
              </SymbolHoverCard>
              <span className={`text-[12px] font-bold ${isUp ? "text-emerald" : "text-red-400"}`}>
                {formatPct(change)}
              </span>
              <p className="text-[10px] text-zinc-600">
                {p.occurrences} {p.eventCategory} events
              </p>
            </div>
            <span className="text-[10px] font-bold text-zinc-500">
              {Math.round(p.confidence * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
