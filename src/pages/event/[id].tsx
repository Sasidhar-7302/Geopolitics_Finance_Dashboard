import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import Layout from "../../components/layout/Layout";
import HeatBadge from "../../components/ui/HeatBadge";
import SectionCard from "../../components/ui/SectionCard";
import SignalOverview from "../../components/ui/SignalOverview";
import SymbolHoverCard from "../../components/ui/SymbolHoverCard";
import TrustSummary from "../../components/ui/TrustSummary";
import { formatCurrency, formatPct, relativeTime } from "../../lib/format";
import { useQuotes } from "../../lib/hooks/useQuotes";
import type { EventReliability } from "../../lib/reliability";
import { requireAuth } from "../../lib/serverAuth";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type EventDetailResponse = {
  event: {
    id: string;
    title: string;
    summary: string;
    source: string;
    region: string;
    countryCode?: string | null;
    severity: number;
    publishedAt: string;
    url?: string;
    category?: string;
    relevanceScore?: number;
    intelligenceQuality?: number;
    whyThisMatters?: string | null;
    supportingSourcesCount?: number;
    sourceReliability?: number;
    reliability?: EventReliability;
    correlations: Array<{
      id: string;
      symbol: string;
      impactScore: number;
      impactDirection: string;
      impactMagnitude: number;
    }>;
    cluster?: {
      clusterId: string;
      headline: string;
      region: string;
      category: string;
      storyCount: number;
      supportScore: number;
      marketPressure: number;
      avgSeverity: number;
      trend: "rising" | "stable" | "cooling";
      heatLevel: "critical" | "elevated" | "watch" | "calm";
      latestPublishedAt: string;
      whyNow: string | null;
      watchSymbols: string[];
      storyIds: string[];
    } | null;
  };
  relatedCoverage: Array<{
    id: string;
    title: string;
    source: string;
    url?: string;
    publishedAt: string;
    reliability?: EventReliability;
  }>;
  timeline: Array<{
    id: string;
    title: string;
    source: string;
    publishedAt: string;
    severity: number;
    region: string;
    whyThisMatters?: string | null;
    reliability?: EventReliability;
    correlations: Array<{
      symbol: string;
      impactScore: number;
      impactDirection: string;
      impactMagnitude: number;
    }>;
  }>;
  predictions: Array<{
    symbol: string;
    direction: string;
    avgImpactPct: number;
    confidence: number;
    occurrences: number;
  }>;
  nextWatch: string[];
  trust: {
    supportingSourcesCount: number;
    sourceReliability: number;
  };
};

export default function EventDetail() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const { data, error } = useSWR<EventDetailResponse>(id ? `/api/events/${id}` : null, fetcher);

  const symbols = data?.event?.correlations?.map((correlation) => correlation.symbol) ?? [];
  const { quotes } = useQuotes(symbols);
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

  if (!data && !error) {
    return (
      <Layout>
        <div className="command-surface p-10 text-center text-sm text-zinc-500">
          Loading the event research file...
        </div>
      </Layout>
    );
  }

  if (!data || error) {
    return (
      <Layout>
        <div className="command-surface p-10 text-center">
          <p className="text-lg font-semibold text-white">Event not found</p>
          <p className="mt-2 text-sm text-zinc-500">This event may have been removed or the research file is unavailable.</p>
          <Link href="/dashboard" className="btn-secondary mt-5 inline-flex">
            Back to dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  const { event, relatedCoverage, timeline, predictions, nextWatch, trust } = data;

  return (
    <Layout>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SectionCard
            title="Event Research File"
            subtitle={`${event.source} / ${event.region} / ${relativeTime(event.publishedAt)}`}
            action={<Link href="/dashboard" className="status-pill">Back to dashboard</Link>}
          >
            <div className="rounded-[24px] border border-white/6 bg-black/55 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="kicker">{event.category || "general"}</span>
                    {event.cluster ? <HeatBadge heatLevel={event.cluster.heatLevel} trend={event.cluster.trend} /> : null}
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold leading-tight text-white">{event.title}</h1>
                </div>
              </div>

              <p className="mt-4 text-base leading-7 text-zinc-400">{event.summary}</p>

              {event.whyThisMatters ? (
                <div className="mt-4 rounded-[24px] border border-cyan/15 bg-cyan/10 p-4">
                  <p className="kicker">Why This Matters</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{event.whyThisMatters}</p>
                </div>
              ) : null}

              {event.reliability ? (
                <SignalOverview className="mt-4" reliability={event.reliability} />
              ) : (
                <TrustSummary
                  className="mt-4"
                  supportingSourcesCount={event.supportingSourcesCount ?? trust.supportingSourcesCount}
                  sourceReliability={event.sourceReliability ?? trust.sourceReliability}
                  intelligenceQuality={event.intelligenceQuality}
                  publishedAt={event.publishedAt}
                />
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {event.url ? (
                  <a href={event.url} target="_blank" rel="noreferrer" className="btn-primary">
                    Open source article
                  </a>
                ) : null}
                {event.cluster ? (
                  <span className="chip">{event.cluster.storyCount} stories in cluster</span>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Market Reaction" subtitle="Asset-level context tied directly to this event and its predicted pattern history.">
            <div className="grid gap-3 lg:grid-cols-2">
              {event.correlations.map((correlation) => {
                const quote = quoteMap.get(correlation.symbol);
                const prediction = predictions.find((item) => item.symbol === correlation.symbol);
                return (
                  <div key={correlation.id} className="rounded-[24px] border border-white/6 bg-black/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <SymbolHoverCard symbol={correlation.symbol}>
                            <Link href={`/stock/${correlation.symbol}`} className="text-lg font-semibold !text-white hover:!text-cyan">
                              {correlation.symbol}
                            </Link>
                          </SymbolHoverCard>
                          <span className="chip">{correlation.impactDirection}</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">Impact score {Math.round(correlation.impactScore * 100)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{quote ? formatCurrency(quote.price) : "No quote"}</p>
                        <p className={`text-xs font-semibold ${quote && quote.changePct >= 0 ? "text-emerald" : "text-red-400"}`}>
                          {quote ? formatPct(quote.changePct) : formatPct(correlation.impactMagnitude)}
                        </p>
                      </div>
                    </div>
                    {prediction ? (
                      <div className="mt-4 rounded-2xl border border-white/6 bg-black/40 p-3">
                        <p className="text-xs text-zinc-500">Pattern outlook</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          Historical bias: {prediction.direction} {formatPct(prediction.avgImpactPct)} with {Math.round(prediction.confidence * 100)}% confidence across {prediction.occurrences} occurrences.
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Narrative Timeline" subtitle="The surrounding cluster shows how the story is evolving, not just the current headline.">
            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/6 bg-black/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.source} / {relativeTime(item.publishedAt)}</p>
                      <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
                    </div>
                    <span className="chip">Severity {item.severity}</span>
                  </div>
                  {item.whyThisMatters ? <p className="mt-3 text-sm leading-6 text-zinc-400">{item.whyThisMatters}</p> : null}
                  <TrustSummary className="mt-3" compact reliability={item.reliability} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.correlations.slice(0, 4).map((correlation) => (
                      <span key={`${item.id}-${correlation.symbol}`} className="chip">{correlation.symbol}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Corroboration Stack" subtitle="Related coverage that confirms, extends, or reframes the current event.">
            <div className="space-y-3">
              {relatedCoverage.length > 0 ? relatedCoverage.map((item) => (
                <a
                  key={item.id}
                  href={item.url || `/event/${item.id}`}
                  target={item.url ? "_blank" : undefined}
                  rel={item.url ? "noreferrer" : undefined}
                  className="block rounded-[24px] border border-white/6 bg-black/50 p-4 transition hover:border-cyan/30 hover:bg-cyan/5"
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.source} / {relativeTime(item.publishedAt)}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                  <TrustSummary className="mt-3" compact reliability={item.reliability} />
                </a>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                  No corroborating coverage is currently attached to this cluster.
                </div>
              )}
            </div>
          </SectionCard>

          {event.cluster ? (
            <SectionCard title="Cluster Context" subtitle="The higher-level narrative this event belongs to.">
              <div className="rounded-[24px] border border-white/6 bg-black/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{event.cluster.headline}</p>
                    <p className="mt-1 text-xs text-zinc-500">{event.cluster.region} / {event.cluster.category}</p>
                  </div>
                  <HeatBadge heatLevel={event.cluster.heatLevel} trend={event.cluster.trend} />
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{event.cluster.whyNow}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.cluster.watchSymbols.map((symbol) => (
                    <span key={`${event.cluster?.clusterId}-${symbol}`} className="chip">{symbol}</span>
                  ))}
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Next Watch" subtitle="What the system suggests monitoring after this event.">
            <div className="space-y-2">
              {nextWatch.map((item) => (
                <div key={item} className="rounded-[24px] border border-white/6 bg-black/50 px-4 py-3 text-sm text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
