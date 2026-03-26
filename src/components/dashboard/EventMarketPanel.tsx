import Link from "next/link";
import type { EventItem } from "../../lib/hooks/useEvents";
import type { Quote } from "../../lib/hooks/useQuotes";
import SeverityBadge from "../ui/SeverityBadge";
import SymbolHoverCard from "../ui/SymbolHoverCard";
import { relativeTime, formatPct, formatCurrency } from "../../lib/format";

type Props = {
  events: EventItem[];
  quoteMap: Map<string, Quote>;
  emptyState?: {
    title: string;
    hint?: string;
  };
};

export default function EventMarketPanel({ events, quoteMap, emptyState }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.04] p-8 text-center">
        <p className="text-sm text-zinc-500">
          {emptyState?.title ?? "No events with market correlations yet."}
        </p>
        <p className="mt-1 text-[11px] text-zinc-600">
          {emptyState?.hint ?? "Run data ingestion to populate events."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const correlations = event.correlations ?? [];
        const hasCorrelations = correlations.length > 0;

        return (
          <div
            key={event.id}
            className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3.5 transition hover:bg-white/[0.03]"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                  <span>{event.source}</span>
                  <span>&#183;</span>
                  <span>{event.region}</span>
                  <span>&#183;</span>
                  <span>{relativeTime(event.publishedAt)}</span>
                  {event.sentimentLabel && (
                    <>
                      <span>&#183;</span>
                      <span
                        className={`font-semibold ${
                          event.sentimentLabel === "positive"
                            ? "text-emerald"
                            : event.sentimentLabel === "negative"
                            ? "text-red-400"
                            : "text-zinc-500"
                        }`}
                      >
                        {event.sentimentLabel === "positive"
                          ? "↑ Positive"
                          : event.sentimentLabel === "negative"
                          ? "↓ Negative"
                          : "— Neutral"}
                      </span>
                    </>
                  )}
                </div>
                <h3 className="mt-1 text-[13px] font-semibold text-white leading-snug">
                  <Link href={`/event/${event.id}`} className="!text-white hover:!text-emerald transition-colors">
                    {event.title}
                  </Link>
                </h3>
                <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">{event.summary}</p>
              </div>
              <SeverityBadge severity={event.severity ?? 1} />
            </div>

            {/* Market impact row */}
            {hasCorrelations && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {correlations.slice(0, 5).map((corr) => {
                  const quote = quoteMap.get(corr.symbol);
                  const change = quote?.changePct ?? corr.impactMagnitude;
                  const isUp = corr.impactDirection === "up" || change > 0;

                  return (
                    <SymbolHoverCard key={corr.id} symbol={corr.symbol}>
                      <Link
                        href={`/stock/${corr.symbol}`}
                        className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 hover:bg-white/[0.05] hover:border-white/[0.1] transition"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isUp ? "bg-emerald" : "bg-red-400"}`} />
                        <span className="text-[11px] font-bold text-zinc-300">{corr.symbol}</span>
                        {quote && quote.price > 0 && (
                          <span className="text-[10px] text-zinc-600">
                            {formatCurrency(quote.price, quote.currency || "USD")}
                          </span>
                        )}
                        <span className={`text-[11px] font-bold ${isUp ? "text-emerald" : "text-red-400"}`}>
                          {formatPct(isUp ? Math.abs(change) : -Math.abs(change))}
                        </span>
                      </Link>
                    </SymbolHoverCard>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
