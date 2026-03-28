import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import useSWR from "swr";
import Layout from "../../components/layout/Layout";
import SeverityBadge from "../../components/ui/SeverityBadge";
import { getAssetMeta } from "../../lib/assets";
import { relativeTime, formatPct, formatCurrency } from "../../lib/format";
import { resolvePatternMove } from "../../lib/marketDisplay";
import { requireAuth } from "../../lib/serverAuth";

// Dynamic import to avoid SSR issues with TradingView
const TradingViewChart = dynamic(
  () => import("../../components/ui/TradingViewChart").then((m) => m.TradingViewChart),
  { ssr: false, loading: () => <div className="h-[450px] animate-pulse rounded-xl bg-white/[0.03]" /> }
);

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Correlation {
  id: string;
  symbol: string;
  impactScore: number;
  impactDirection: string;
  impactMagnitude: number;
  window: string;
  event: {
    id: string;
    title: string;
    summary: string;
    source: string;
    region: string;
    countryCode: string | null;
    publishedAt: string;
    severity: number;
    url: string | null;
  };
}

interface Pattern {
  id: string;
  eventCategory: string;
  symbol: string;
  avgImpactPct: number;
  direction: string;
  confidence: number;
  occurrences: number;
}

interface QuoteData {
  symbol: string;
  price: number;
  changePct: number;
  currency?: string;
}

export default function StockDetail() {
  const router = useRouter();
  const { symbol } = router.query as { symbol?: string };
  const upperSymbol = symbol?.toUpperCase() || "";
  const assetMeta = getAssetMeta(upperSymbol || "UNKNOWN");

  const { data, isLoading } = useSWR(
    symbol ? `/api/stocks/${symbol}` : null,
    fetcher
  );

  const { data: quoteData } = useSWR(
    symbol ? `/api/markets/quotes?symbols=${symbol}` : null,
    fetcher,
    { refreshInterval: 120_000 }
  );

  const correlations: Correlation[] = data?.correlations ?? [];
  const patterns: Pattern[] = data?.patterns ?? [];
  const quote: QuoteData | undefined = quoteData?.quotes?.[0];

  // Computed stats
  const totalEvents = correlations.length;
  const avgSeverity = totalEvents > 0
    ? correlations.reduce((sum, c) => sum + c.event.severity, 0) / totalEvents
    : 0;
  const upCount = correlations.filter((c) => c.impactDirection === "up").length;
  const downCount = correlations.filter((c) => c.impactDirection === "down").length;
  const dominantDirection = upCount >= downCount ? "Bullish" : "Bearish";
  const topConfidence = patterns.length > 0 ? Math.round(patterns[0].confidence * 100) : 0;

  // Loading state
  if (!symbol || isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <div className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="h-[450px] animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0A0A0A] px-5 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] transition"
            >
              &larr;
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-wide">{upperSymbol}</h1>
                <span className="text-sm text-zinc-500">{assetMeta.name}</span>
              </div>
              <p className="text-[10px] text-zinc-600">
                {totalEvents} news events | {patterns.length} learned patterns
              </p>
            </div>
          </div>
          {quote && quote.price > 0 ? (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">
                {formatCurrency(quote.price, quote.currency || "USD")}
              </p>
              <p className={`text-sm font-bold ${quote.changePct >= 0 ? "text-emerald" : "text-red-400"}`}>
                {quote.changePct >= 0 ? "UP" : "DOWN"} {formatPct(quote.changePct)} today
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-600">Price unavailable</p>
          )}
        </div>

        {/* TradingView Chart */}
        <TradingViewChart symbol={upperSymbol} height={450} />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "News Events", value: totalEvents.toString(), color: "text-white" },
            { label: "Avg Severity", value: avgSeverity > 0 ? avgSeverity.toFixed(1) + "/10" : "N/A", color: avgSeverity >= 7 ? "text-red-400" : avgSeverity >= 4 ? "text-amber-400" : "text-emerald" },
            { label: "Dominant Bias", value: totalEvents > 0 ? dominantDirection : "N/A", color: dominantDirection === "Bullish" ? "text-emerald" : "text-red-400" },
            { label: "Pattern Confidence", value: topConfidence > 0 ? `${topConfidence}%` : "N/A", color: "text-cyan-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{stat.label}</p>
              <p className={`mt-1 text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Two column layout */}
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* Left: Events list */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                News Affecting {upperSymbol}
              </h2>
              <span className="text-[10px] text-zinc-600">
                {upCount} bullish | {downCount} bearish
              </span>
            </div>

            {correlations.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-8 text-center">
                <p className="text-sm text-zinc-500">No correlated events found yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {correlations.map((corr) => {
                  const isUp = corr.impactDirection === "up";
                  const scoreWidth = Math.round(corr.impactScore * 100);
                  return (
                    <div
                      key={corr.id}
                      className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4 hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-start gap-3">
                        {/* Direction badge */}
                        <div className={`mt-0.5 flex h-9 w-12 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                          isUp ? "bg-emerald/10 text-emerald" : "bg-red-400/10 text-red-400"
                        }`}>
                          {isUp ? "UP" : "DOWN"}
                        </div>

                        {/* Event content */}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/event/${corr.event.id}`}
                            className="text-sm font-semibold !text-white hover:!text-emerald transition line-clamp-1"
                          >
                            {corr.event.title}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-600">
                            <span>{corr.event.source}</span>
                            <span>|</span>
                            <span>{corr.event.region}</span>
                            {corr.event.countryCode && (
                              <>
                                <span>|</span>
                                <span className="font-medium text-zinc-500">{corr.event.countryCode}</span>
                              </>
                            )}
                            <span>|</span>
                            <span>{relativeTime(corr.event.publishedAt)}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2">{corr.event.summary}</p>

                          {/* Impact bar */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1 flex-1 rounded-full bg-white/[0.05]">
                              <div
                                className={`h-1 rounded-full ${isUp ? "bg-emerald" : "bg-red-400"}`}
                                style={{ width: `${scoreWidth}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-zinc-600">{scoreWidth}% impact</span>
                          </div>
                        </div>

                        <SeverityBadge severity={corr.event.severity} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Patterns */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">Learned Patterns</h2>
            {patterns.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-6 text-center">
                <p className="text-[11px] text-zinc-500">
                  Patterns emerge as more events are correlated over time.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {patterns.map((p) => {
                  const change = resolvePatternMove(p.direction, p.avgImpactPct);
                  const isUp = change >= 0;

                  return (
                    <div key={p.id} className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          {p.eventCategory}
                        </span>
                        <span className={`text-sm font-bold ${isUp ? "text-emerald" : "text-red-400"}`}>
                          {isUp ? "UP" : "DOWN"} {formatPct(change)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-[9px] text-zinc-600">
                          <span>Confidence</span>
                          <span>{Math.round(p.confidence * 100)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/[0.05]">
                          <div
                            className="h-1.5 rounded-full bg-cyan-500/60"
                            style={{ width: `${Math.round(p.confidence * 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] text-zinc-600">
                        Based on <span className="font-medium text-zinc-400">{p.occurrences}</span> similar {p.eventCategory} events
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* How correlation works explanation */}
            <div className="mt-4 rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
              <h3 className="text-[11px] font-semibold text-zinc-400">How This Works</h3>
              <div className="mt-2 space-y-2 text-[10px] text-zinc-600 leading-relaxed">
                <p>
                  <span className="text-zinc-400">1. Event ingestion:</span> GeoPulse collects geopolitical coverage from configured RSS feeds and GDELT, then stores normalized events in Supabase.
                </p>
                <p>
                  <span className="text-zinc-400">2. Correlation scoring:</span> Each event is linked to {upperSymbol} using asset mappings, category rules, and the system's event-to-market correlation engine.
                </p>
                <p>
                  <span className="text-zinc-400">3. Market pricing:</span> Quote data comes from the configured delayed provider when available, then the scraper fallback, then the latest stored snapshot.
                </p>
                <p>
                  <span className="text-zinc-400">4. Pattern learning:</span> As more linked events accumulate, GeoPulse estimates how {upperSymbol} tends to react to similar categories and shows that confidence level here.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
