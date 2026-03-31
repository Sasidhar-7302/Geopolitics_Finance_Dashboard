import Link from "next/link";
import type { EventItem } from "../../lib/hooks/useEvents";
import type { Quote } from "../../lib/hooks/useQuotes";
import SeverityBadge from "../ui/SeverityBadge";
import SymbolHoverCard from "../ui/SymbolHoverCard";
import TrustSummary from "../ui/TrustSummary";
import { relativeTime, formatPct, formatCurrency } from "../../lib/format";
import { resolveCorrelationDisplay } from "../../lib/marketDisplay";
import { getQuoteBadgeLabel } from "../../lib/marketPresentation";

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
                {event.whyThisMatters && (
                  <p className="mt-2 rounded-md border border-emerald/10 bg-emerald/5 px-2.5 py-2 text-[11px] text-zinc-300">
                    <span className="mr-1 font-semibold text-emerald">Why it matters:</span>
                    {event.whyThisMatters}
                  </p>
                )}
                <TrustSummary
                  className="mt-2"
                  compact
                  supportingSourcesCount={event.supportingSourcesCount}
                  sourceReliability={event.sourceReliability}
                  intelligenceQuality={event.intelligenceQuality}
                  publishedAt={event.publishedAt}
                />
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  {event.category && (
                    <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-zinc-400">
                      {event.category.replace(/-/g, " ")}
                    </span>
                  )}
                  {event.isPremiumInsight && (
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300">
                      Premium-depth story
                    </span>
                  )}
                </div>
              </div>
              <SeverityBadge severity={event.severity ?? 1} />
            </div>

            {/* Market impact row */}
            {hasCorrelations && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {correlations.slice(0, 5).map((corr) => {
                  const quote = quoteMap.get(corr.symbol);
                  const display = resolveCorrelationDisplay({
                    liveChange: quote?.changePct,
                    impactDirection: corr.impactDirection,
                    impactMagnitude: corr.impactMagnitude,
                  });
                  const change = display.change;
                  const isUp = change >= 0;
                  const badgeLabel = quote?.freshness ? getQuoteBadgeLabel(quote.freshness) : display.source;

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
                          {formatPct(change)}
                        </span>
                        <span className="text-[9px] uppercase tracking-wide text-zinc-600">
                          {badgeLabel}
                        </span>
                      </Link>
                    </SymbolHoverCard>
                  );
                })}
              </div>
            )}

            {event.url && (
              <div className="mt-2">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-emerald hover:text-emerald/80 transition"
                >
                  Open source article
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
