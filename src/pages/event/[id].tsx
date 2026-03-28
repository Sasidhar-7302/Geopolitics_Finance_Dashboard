import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import useSWR from "swr";
import Layout from "../../components/layout/Layout";
import SeverityBadge from "../../components/ui/SeverityBadge";
import { relativeTime, formatPct, formatCurrency } from "../../lib/format";
import { resolveCorrelationDisplay, resolvePatternMove } from "../../lib/marketDisplay";
import { getQuoteBadgeLabel } from "../../lib/marketPresentation";
import { requireAuth } from "../../lib/serverAuth";

const MiniChart = dynamic(
  () => import("../../components/ui/TradingViewChart").then((m) => m.MiniChart),
  { ssr: false, loading: () => <div className="h-[180px] animate-pulse rounded-lg bg-white/[0.03]" /> }
);

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Correlation {
  id: string;
  symbol: string;
  impactScore: number;
  impactDirection: string;
  impactMagnitude: number;
  category?: string;
}

interface EventData {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: string;
  countryCode?: string;
  publishedAt: string;
  severity: number;
  url?: string;
  category?: string;
  whyThisMatters?: string | null;
  supportingSourcesCount?: number;
  sourceReliability?: number;
  correlations: Correlation[];
}

interface Quote {
  symbol: string;
  price: number;
  changePct: number;
  currency?: string;
  freshness?: "live" | "delayed" | "snapshot";
}

interface Prediction {
  symbol: string;
  direction: string;
  avgImpactPct: number;
  confidence: number;
  occurrences: number;
  category: string;
}

/* Why this asset is linked to the event */
const CORRELATION_REASONS: Record<string, string> = {
  USO: "Oil prices are directly impacted by geopolitical tensions, supply disruptions, and energy policy changes",
  XLE: "Energy sector stocks move with crude oil prices and energy infrastructure news",
  XOM: "As a major oil company, Exxon's stock reflects global energy supply/demand shifts",
  CVX: "Chevron's operations span global energy markets affected by geopolitical events",
  GLD: "Gold is a safe-haven asset — prices rise during uncertainty, conflict, and economic instability",
  IAU: "Gold trust tracks gold prices, rising during geopolitical fear and uncertainty",
  SLV: "Silver follows gold as an alternative safe-haven during market stress",
  ITA: "Defense/aerospace stocks rise when military conflict or defense spending increases",
  LMT: "Lockheed Martin benefits from increased defense contracts during geopolitical tensions",
  RTX: "Raytheon's missile and defense systems see increased demand during conflicts",
  NOC: "Northrop Grumman's surveillance and bomber programs grow with defense budgets",
  BA: "Boeing's defense division benefits from military procurement increases",
  SPY: "The S&P 500 index reflects broad market sentiment — drops on uncertainty, rises on stability",
  QQQ: "Tech-heavy Nasdaq reacts to trade policy, chip restrictions, and economic outlook",
  TLT: "Treasury bonds are a flight-to-safety asset — prices rise when stocks sell off",
  VXX: "The volatility index spikes during market fear, uncertainty, and sudden geopolitical events",
  FXI: "China large-cap ETF moves on US-China relations, trade policy, and domestic Chinese policy",
  BABA: "Alibaba is sensitive to China regulatory changes, US-China tensions, and trade restrictions",
  KWEB: "China internet stocks react to Chinese tech regulation and US-China trade dynamics",
  SMH: "Semiconductor ETF is affected by chip export bans, Taiwan tensions, and tech trade wars",
  NVDA: "NVIDIA moves on AI demand, chip export controls, and geopolitical supply chain risks",
  TSM: "Taiwan Semi is directly affected by Taiwan Strait tensions and global chip demand",
  WEAT: "Wheat prices surge during agricultural disruptions, conflicts in grain-producing regions",
  CORN: "Corn prices react to agricultural policy, trade agreements, and food security threats",
  EEM: "Emerging market ETF reflects global risk appetite and developing world stability",
  XLF: "Financial sector moves with interest rate policy, banking crises, and economic outlook",
  HACK: "Cybersecurity stocks benefit from increasing cyber threats and government security spending",
  CRWD: "CrowdStrike gains from heightened cybersecurity awareness after major cyber incidents",
  ICLN: "Clean energy ETF moves on climate policy, green energy investment, and carbon regulations",
  URA: "Uranium ETF reacts to nuclear energy policy and nuclear proliferation concerns",
  BDRY: "Shipping ETF spikes on maritime disruptions, Red Sea attacks, and trade route blockages",
  EWJ: "Japan ETF moves on yen policy, Bank of Japan decisions, and regional stability",
  EWY: "South Korea ETF reacts to North Korea tensions and semiconductor industry news",
  INDA: "India ETF tracks Indian economic policy, elections, and regional geopolitics",
  EWZ: "Brazil ETF moves on Latin American politics, commodity prices, and economic policy",
  EWG: "Germany ETF reflects European economic health, ECB policy, and energy dependency",
  EWU: "UK ETF reacts to Brexit impacts, Bank of England policy, and British politics",
  BITO: "Bitcoin ETF moves on crypto regulation, financial instability, and digital asset policy",
  XLV: "Healthcare sector reacts to pandemic news, drug approvals, and health policy changes",
  XBI: "Biotech ETF moves on FDA decisions, pandemic developments, and health crises",
};

export default function EventDetail() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const { data, error } = useSWR<{
    event: EventData;
    relatedCoverage: Array<{ id: string; title: string; source: string; url?: string; publishedAt: string }>;
    trust: { supportingSourcesCount: number; sourceReliability: number };
  }>(
    id ? `/api/events/${id}` : null,
    fetcher
  );

  const event = data?.event;
  const relatedCoverage = data?.relatedCoverage ?? [];

  const symbols = event?.correlations?.map((c) => c.symbol).join(",") ?? "";

  const { data: quotesData } = useSWR<{ quotes: Quote[] }>(
    symbols ? `/api/markets/quotes?symbols=${symbols}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: predictionData } = useSWR<{ predictions: Prediction[] }>(
    id ? `/api/patterns/predict?eventId=${id}` : null,
    fetcher
  );

  const quoteMap = new Map<string, Quote>();
  (quotesData?.quotes ?? []).forEach((q) => quoteMap.set(q.symbol, q));
  const predictions = predictionData?.predictions ?? [];

  const sortedCorrelations = [...(event?.correlations ?? [])].sort(
    (a, b) => b.impactScore - a.impactScore
  );

  /* Loading */
  if (!event && !error) {
    return (
      <Layout>
        <div className="space-y-4">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-white/[0.03]" />
          <div className="h-10 w-3/4 animate-pulse rounded-lg bg-white/[0.03]" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 w-20 animate-pulse rounded-full bg-white/[0.03]" />
            ))}
          </div>
          <div className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[280px] animate-pulse rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  /* Error */
  if (error || !event) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-8 py-6 text-center">
            <p className="text-lg font-semibold text-red-400">Event not found</p>
            <p className="mt-1 text-sm text-zinc-500">This event may have been removed.</p>
            <Link href="/timeline" className="mt-4 inline-block rounded-lg bg-white/[0.06] px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.1] transition">
              &larr; Back to Timeline
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const publishedDate = new Date(event.publishedAt);
  const formattedDate = publishedDate.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <Layout>
      <div className="space-y-5">
        {/* Back + Title */}
        <div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition mb-3"
          >
            <span>&larr;</span> Back
          </button>
          <h1 className="text-2xl font-bold leading-tight text-white">{event.title}</h1>
        </div>

        {/* Meta + Severity */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {event.source}
          </span>
          <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-[11px] text-zinc-400">
            {event.region}
          </span>
          {event.countryCode && (
            <span className="rounded-full border border-emerald/20 bg-emerald/5 px-3 py-1 text-[11px] font-bold text-emerald">
              {event.countryCode}
            </span>
          )}
          <span className="text-[11px] text-zinc-600">{formattedDate}</span>
          <span className="text-[11px] text-zinc-700">({relativeTime(event.publishedAt)})</span>
          <SeverityBadge severity={event.severity} />
        </div>

        {/* Summary card */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-5">
          <p className="text-sm leading-relaxed text-zinc-300">{event.summary}</p>
          {event.whyThisMatters && (
            <div className="mt-4 rounded-lg border border-emerald/10 bg-emerald/5 p-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-emerald/80">Why this matters</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">{event.whyThisMatters}</p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-zinc-400">
              {(event.supportingSourcesCount ?? data?.trust?.supportingSourcesCount ?? 1)} confirming sources
            </span>
            <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-zinc-400">
              Source quality {Math.round((event.sourceReliability ?? data?.trust?.sourceReliability ?? 0.75) * 100)}%
            </span>
            {event.category && (
              <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-zinc-400">
                {event.category}
              </span>
            )}
          </div>
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald hover:text-emerald/80 transition"
            >
              Read full article
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-60">
                <path d="M5 2h7v7M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>

        {/* Affected Markets */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Affected Markets</h2>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-zinc-400">
              {sortedCorrelations.length} stocks
            </span>
          </div>

          {sortedCorrelations.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-8 text-center">
              <p className="text-sm text-zinc-500">No market correlations detected for this event.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sortedCorrelations.map((corr) => {
                const quote = quoteMap.get(corr.symbol);
                const display = resolveCorrelationDisplay({
                  liveChange: quote?.changePct,
                  impactDirection: corr.impactDirection,
                  impactMagnitude: corr.impactMagnitude,
                });
                const change = display.change;
                const isUp = change >= 0;
                const scoreWidth = Math.round(corr.impactScore * 100);
                const reason = CORRELATION_REASONS[corr.symbol];
                const moveLabel = quote?.freshness ? getQuoteBadgeLabel(quote.freshness) : "modeled";

                return (
                  <div
                    key={corr.id}
                    className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4 hover:border-white/[0.12] transition"
                  >
                    {/* Header: symbol + price */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Link
                          href={`/stock/${corr.symbol}`}
                          className="text-lg font-bold !text-white hover:!text-emerald transition"
                        >
                          {corr.symbol}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                            isUp ? "bg-emerald/10 text-emerald" : "bg-red-400/10 text-red-400"
                          }`}>
                            {isUp ? "UP" : "DOWN"} {formatPct(change)}
                          </span>
                          {quote && quote.price > 0 && (
                            <span className="text-xs text-zinc-500">
                              {formatCurrency(quote.price, quote.currency || "USD")}
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                            {moveLabel}
                          </span>
                        </div>
                      </div>
                      {/* Impact score */}
                      <div className="text-right">
                        <span className="text-[9px] text-zinc-600">Impact</span>
                        <p className="text-sm font-bold text-white">{scoreWidth}%</p>
                      </div>
                    </div>

                    {/* TradingView Mini Chart */}
                    <div className="my-2 -mx-1">
                      <MiniChart symbol={corr.symbol} height={180} />
                    </div>

                    {/* Why this stock is affected */}
                    {reason && (
                      <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5">
                        <p className="text-[10px] font-medium text-zinc-500 mb-0.5">Why {corr.symbol} is affected:</p>
                        <p className="text-[10px] text-zinc-600 leading-relaxed">{reason}</p>
                      </div>
                    )}

                    {/* Impact bar */}
                    <div className="mt-2 h-1 rounded-full bg-white/[0.05]">
                      <div
                        className={`h-1 rounded-full ${isUp ? "bg-emerald" : "bg-red-400"}`}
                        style={{ width: `${scoreWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {relatedCoverage.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Related Coverage</h2>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                {relatedCoverage.length} more sources
              </span>
            </div>
            <div className="space-y-2">
              {relatedCoverage.map((item) => (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={item.id}
                  className="block rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4 hover:bg-white/[0.02] transition"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {item.source} | {relativeTime(item.publishedAt)}
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Predictions */}
        {predictions.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Pattern Predictions</h2>
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                AI Learned
              </span>
            </div>
            <p className="mb-3 text-xs text-zinc-600">
              Based on how similar events moved these assets historically
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {predictions.map((p) => {
                const change = resolvePatternMove(p.direction, p.avgImpactPct);
                const isUp = change >= 0;

                return (
                  <Link
                    href={`/stock/${p.symbol}`}
                    key={`${p.symbol}-${p.category}`}
                    className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4 hover:bg-white/[0.02] transition block"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{p.symbol}</span>
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
                        <div className="h-1.5 rounded-full bg-cyan-500/50" style={{ width: `${Math.round(p.confidence * 100)}%` }} />
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-600">
                      {p.occurrences} similar <span className="text-zinc-400">{p.category}</span> events
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
