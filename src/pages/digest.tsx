import Link from "next/link";
import { useMemo } from "react";
import Layout from "../components/layout/Layout";
import SectionCard from "../components/ui/SectionCard";
import SeverityBadge from "../components/ui/SeverityBadge";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import TrustSummary from "../components/ui/TrustSummary";
import { useEvents } from "../lib/hooks/useEvents";
import { useQuotes } from "../lib/hooks/useQuotes";
import { usePatterns } from "../lib/hooks/usePatterns";
import { usePreferences } from "../lib/hooks/usePreferences";
import { useEntitlements } from "../lib/hooks/useEntitlements";
import { relativeTime, formatPct, formatCurrency } from "../lib/format";
import { resolvePatternMove } from "../lib/marketDisplay";
import { getMarketFreshnessLabel } from "../lib/marketPresentation";
import { requireAuth } from "../lib/serverAuth";

export default function Digest() {
  const { events } = useEvents({ from: "36h", sort: "relevance", limit: 40 });
  const { patterns } = usePatterns();
  const { preferences } = usePreferences();
  const { entitlements } = useEntitlements();

  const personalizedStories = useMemo(() => {
    return [...events]
      .map((event) => {
        let preferenceBoost = 0;
        if (preferences.categories.includes(event.category || "general")) preferenceBoost += 2;
        if (preferences.regions.includes(event.region)) preferenceBoost += 1.5;
        if (event.correlations?.some((corr) => preferences.symbols.includes(corr.symbol))) preferenceBoost += 2;

        return {
          ...event,
          digestScore:
            (event.relevanceScore ?? 0)
            + preferenceBoost
            + (event.supportingSourcesCount ?? 1)
            + ((event.intelligenceQuality ?? 0.5) * 2),
        };
      })
      .sort((a, b) => b.digestScore - a.digestScore);
  }, [events, preferences]);

  const storyLimit = entitlements?.limits?.digestStories ?? 5;
  const stories = personalizedStories.slice(0, storyLimit);

  const allSymbols = useMemo(() => {
    const set = new Set<string>();
    stories.forEach((story) => story.correlations?.forEach((corr) => set.add(corr.symbol)));
    return Array.from(set);
  }, [stories]);

  const { quotes, meta: quoteMeta } = useQuotes(allSymbols);
  const quoteMap = useMemo(() => {
    const map = new Map<string, (typeof quotes)[number]>();
    quotes.forEach((quote) => map.set(quote.symbol, quote));
    return map;
  }, [quotes]);

  const watchlistSignals = useMemo(() => {
    return stories.filter((story) =>
      story.correlations?.some((corr) => preferences.symbols.includes(corr.symbol))
    ).slice(0, 5);
  }, [preferences.symbols, stories]);

  const regionalRoundup = useMemo(() => {
    const counts = stories.reduce<Record<string, number>>((acc, story) => {
      acc[story.region] = (acc[story.region] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [stories]);

  const movers = useMemo(() => {
    return [...quotes]
      .filter((quote) => quote.price > 0)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 8);
  }, [quotes]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Layout>
      <div className="space-y-4">
        <SectionCard
          title="Morning Brief"
          subtitle={`Your ${preferences.digestHour}:00 ${preferences.timezone} briefing for finance-relevant global risk.`}
          action={<Link href="/settings" className="ghost-chip hover:bg-white/[0.06]">Edit delivery settings</Link>}
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-zinc-300">
              {today}
            </span>
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-zinc-300">
              {stories.length} curated stories
            </span>
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-zinc-300">
              Market data: {getMarketFreshnessLabel(quoteMeta?.freshness)}
            </span>
          </div>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <SectionCard title="Top Stories" subtitle="The highest-signal stories based on relevance, trust, and your interests.">
              <div className="space-y-3">
                {stories.map((story, index) => (
                  <div key={story.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[11px] font-bold text-zinc-400">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-600">
                          <span>{story.source}</span>
                          <span>&#183;</span>
                          <span>{story.region}</span>
                          <span>&#183;</span>
                          <span>{relativeTime(story.publishedAt)}</span>
                          <span>&#183;</span>
                          <span>{story.supportingSourcesCount ?? 1} sources</span>
                        </div>
                        <h3 className="mt-1 text-[15px] font-semibold leading-snug text-white">
                          <Link href={`/event/${story.id}`} className="!text-white hover:!text-emerald transition-colors">
                            {story.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-[12px] text-zinc-500">{story.summary}</p>
                        {story.whyThisMatters && (
                          <p className="mt-2 rounded-lg border border-emerald/10 bg-emerald/5 px-3 py-2 text-[11px] leading-relaxed text-zinc-300">
                            <span className="font-semibold text-emerald">Why it matters:</span> {story.whyThisMatters}
                          </p>
                        )}
                        <TrustSummary
                          className="mt-2"
                          compact
                          supportingSourcesCount={story.supportingSourcesCount}
                          sourceReliability={story.sourceReliability}
                          intelligenceQuality={story.intelligenceQuality}
                          publishedAt={story.publishedAt}
                        />

                        {(story.correlations?.length ?? 0) > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {story.correlations!.slice(0, 5).map((corr) => {
                              const quote = quoteMap.get(corr.symbol);
                              return (
                                <SymbolHoverCard key={`${story.id}-${corr.symbol}`} symbol={corr.symbol}>
                                  <Link
                                    href={`/stock/${corr.symbol}`}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.03] px-2.5 py-1.5 text-[11px] hover:bg-white/[0.05] transition"
                                  >
                                    <span className="font-bold text-zinc-300">{corr.symbol}</span>
                                    {quote && quote.price > 0 && (
                                      <>
                                        <span className="text-zinc-600">{formatCurrency(quote.price, quote.currency || "USD")}</span>
                                        <span className={quote.changePct >= 0 ? "text-emerald" : "text-red-400"}>
                                          {formatPct(quote.changePct)}
                                        </span>
                                      </>
                                    )}
                                  </Link>
                                </SymbolHoverCard>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <SeverityBadge severity={story.severity ?? 1} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-4">
            <SectionCard title="Watchlist Signals" subtitle="Stories touching your chosen symbols first.">
              {watchlistSignals.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-zinc-600">
                  Add symbols in Settings to unlock a more tailored morning brief.
                </p>
              ) : (
                <div className="space-y-2">
                  {watchlistSignals.map((story) => (
                    <Link
                      href={`/event/${story.id}`}
                      key={story.id}
                      className="block rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition"
                    >
                      <p className="text-xs font-semibold text-white">{story.title}</p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {(story.correlations ?? []).map((corr) => corr.symbol).slice(0, 4).join(" | ")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Regional Roundup" subtitle="Where today's risk is clustering.">
              <div className="space-y-2">
                {regionalRoundup.map(([region, count]) => (
                  <div key={region} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <span className="text-xs font-semibold text-zinc-300">{region}</span>
                    <span className="text-xs font-bold text-amber-400">{count}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Market Movers" subtitle="Largest percent moves among assets linked to today's stories.">
              <div className="space-y-1.5">
                {movers.map((quote) => (
                  <Link
                    href={`/stock/${quote.symbol}`}
                    key={quote.symbol}
                    className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition"
                  >
                    <span className="text-sm font-bold text-zinc-300">{quote.symbol}</span>
                    <div className="text-right">
                      <span className="text-xs text-zinc-500">{formatCurrency(quote.price, quote.currency || "USD")}</span>
                      <span className={`ml-2 text-xs font-bold ${quote.changePct >= 0 ? "text-emerald" : "text-red-400"}`}>
                        {formatPct(quote.changePct)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionCard>

            {patterns.length > 0 && (
              <SectionCard title="Pattern Watch" subtitle="Recurring setups learned from past event-to-market links.">
                <div className="space-y-2">
                  {patterns.slice(0, 5).map((pattern: any) => {
                    const change = resolvePatternMove(pattern.direction, pattern.avgImpactPct);

                    return (
                      <div key={pattern.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-300">{pattern.symbol}</span>
                          <span className={`text-xs font-bold ${change >= 0 ? "text-emerald" : "text-red-400"}`}>
                            {formatPct(change)}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {pattern.eventCategory} | {pattern.occurrences} historical matches | {Math.round(pattern.confidence * 100)}% confidence
                        </p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
