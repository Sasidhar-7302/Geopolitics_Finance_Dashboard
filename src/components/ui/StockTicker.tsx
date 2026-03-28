import { formatCurrency, formatPct } from "../../lib/format";
import SymbolHoverCard from "./SymbolHoverCard";

type TickerItem = {
  symbol: string;
  price: number;
  changePct: number;
  currency?: string;
};

export default function StockTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#0A0A0A]">
      <div className="flex animate-ticker whitespace-nowrap py-2 hover:[animation-play-state:paused]">
        {doubled.map((item, i) => (
          <div
            key={`${item.symbol}-${i}`}
            className="inline-flex items-center gap-2 px-4 border-r border-white/[0.04] last:border-0"
          >
            <SymbolHoverCard symbol={item.symbol}>
              <span className="text-[11px] font-bold text-zinc-300">{item.symbol}</span>
            </SymbolHoverCard>
            <span className="text-[11px] text-zinc-600">
              {formatCurrency(item.price, item.currency || "USD")}
            </span>
            <span className={`text-[11px] font-bold ${item.changePct >= 0 ? "text-emerald" : "text-red-400"}`}>
              {formatPct(item.changePct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
