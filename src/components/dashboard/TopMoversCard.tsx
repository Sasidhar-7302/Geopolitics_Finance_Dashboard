import type { Quote } from "../../lib/hooks/useQuotes";
import { formatCurrency, formatPct } from "../../lib/format";
import SymbolHoverCard from "../ui/SymbolHoverCard";

export default function TopMoversCard({ quotes }: { quotes: Quote[] }) {
  const sorted = [...quotes]
    .filter((q) => q.price > 0)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 6);

  if (sorted.length === 0) {
    return (
      <p className="text-[11px] text-zinc-600 py-4 text-center">
        Market data loads after first ingestion.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((q) => {
        const isUp = q.changePct >= 0;
        return (
          <div
            key={q.symbol}
            className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${isUp ? "bg-emerald" : "bg-red-400"}`} />
              <SymbolHoverCard symbol={q.symbol}>
                <span className="text-[12px] font-bold text-zinc-300">{q.symbol}</span>
              </SymbolHoverCard>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-500">
                {formatCurrency(q.price, q.currency || "USD")}
              </span>
              <span className={`text-[11px] font-bold ${isUp ? "text-emerald" : "text-red-400"}`}>
                {formatPct(q.changePct)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
