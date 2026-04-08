import Link from "next/link";
import { useMemo } from "react";
import Layout from "../components/layout/Layout";
import HeatBadge from "../components/ui/HeatBadge";
import SectionCard from "../components/ui/SectionCard";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import TrustSummary from "../components/ui/TrustSummary";
import { formatCurrency, formatPct, relativeTime } from "../lib/format";
import { useEntitlements } from "../lib/hooks/useEntitlements";
import { useEvents } from "../lib/hooks/useEvents";
import { usePreferences } from "../lib/hooks/usePreferences";
import { useQuotes } from "../lib/hooks/useQuotes";
import { useRiskOverview } from "../lib/hooks/useRiskOverview";
import { requireAuth } from "../lib/serverAuth";

export default function Digest() {
  const { preferences } = usePreferences();
  const { entitlements } = useEntitlements();
  const { riskOverview } = useRiskOverview("72h");
  const { events } = useEvents({ timeWindow: "72h", sort: "relevance", limit: 40 });

  const personalizedStories = useMemo(() => {
    return [...events]
      .map((event) => {
        let preferenceBoost = 0;
        if (preferences.categories.includes(event.category || "general")) preferenceBoost += 2;
        if (preferences.regions.includes(event.region)) preferenceBoost += 2;
        if ((event.correlations ?? []).some((correlation) => preferences.symbols.includes(correlation.symbol))) preferenceBoost += 2.5;

        return {
          ...event,
          digestScore:
            (event.relevanceScore ?? 0) +
            preferenceBoost +
            (event.supportingSourcesCount ?? 1) +
            ((event.intelligenceQuality ?? 0.5) * 3),
        };
      })
      .sort((left, right) => right.digestScore - left.digestScore);
  }, [events, preferences.categories, preferences.regions, preferences.symbols]);

  const storyLimit = entitlements?.limits?.digestStories ?? 5;
  const stories = personalizedStories.slice(0, storyLimit);
  const leadStory = stories[0] || null;

  const symbols = useMemo(() => {
    return Array.from(
      new Set(stories.flatMap((story) => (story.correlations ?? []).map((correlation) => correlation.symbol)))
    ).slice(0, 14);
  }, [stories]);

  const { quotes } = useQuotes(symbols);
  const quoteMap = useMemo(() => {
    const map = new Map<string, (typeof quotes)[number]>();
    quotes.forEach((quote) => map.set(quote.symbol, quote));
    return map;
  }, [quotes]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Layout>
      <div className="space-y-4">
        <SectionCard
          title="Morning Brief"
          subtitle={`Scheduled for ${preferences.digestHour}:00 ${preferences.timezone}. Built around risk posture, lead narrative, and exposed assets.`}
          action={<Link href="/settings" className="status-pill">Delivery settings</Link>}
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
            <div className="rounded-[26px] border border-white/[0.06] bg-black/60 p-5">
              <p className="kicker">Executive summary</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">{today}</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                {leadStory && riskOverview?.narratives[0]
                  ? `${riskOverview.narratives[0].region} leads the current narrative stack. The first file to open is "${leadStory.title}" because it combines fresh coverage, better corroboration, and direct asset exposure through ${leadStory.correlations?.slice(0, 2).map((item) => item.symbol).join(" and ") || "the current mover board"}.`
                  : "The briefing will populate as fresh narratives and market reactions arrive."}
              </p>
              {leadStory ? (
                <div className="mt-5 rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Lead file / {leadStory.region} / {relativeTime(leadStory.publishedAt)}
                  </p>
                  <p className="mt-2 text-lg font-semibold leading-8 text-white">{leadStory.title}</p>
                  <TrustSummary className="mt-4" reliability={leadStory.reliability} />
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="rounded-[24px] border border-white/[0.06] bg-black/60 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Radar posture</p>
                <p className="mt-3 text-3xl font-semibold text-white">{riskOverview?.radar.pressureScore ?? 0}</p>
                <p className="mt-1 text-sm text-zinc-500 capitalize">{riskOverview?.radar.posture || "mixed"} across the current mover board</p>
                <div className="mt-4 h-2 rounded-full bg-white/[0.05]">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan to-emerald"
                    style={{ width: `${Math.min(100, riskOverview?.radar.pressureScore ?? 0)}%` }}
                  />
                </div>
              </div>
              <div className="rounded-[24px] border border-white/[0.06] bg-black/60 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Story budget</p>
                <p className="mt-3 text-3xl font-semibold text-white">{stories.length}</p>
                <p className="mt-1 text-sm text-zinc-500">Top stories included in this briefing window</p>
              </div>
              <div className="rounded-[24px] border border-white/[0.06] bg-black/60 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Priority region</p>
                <p className="mt-3 text-xl font-semibold text-white">{riskOverview?.regions[0]?.scopeLabel || "No active zone"}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {riskOverview?.regions[0]
                    ? `${riskOverview.regions[0].storyCount} stories / support ${Math.round(riskOverview.regions[0].supportScore * 100)}%`
                    : "Waiting for fresh signal"}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SectionCard title="What Changed" subtitle="Start with these files in order. The list already accounts for your tracked topics, regions, and symbols.">
            <div className="space-y-3">
              {stories.map((story, index) => (
                <div key={story.id} className="rounded-[24px] border border-white/[0.06] bg-black/55 p-4">
                  <div className="flex items-start gap-4">
                    <div className="hidden h-10 w-10 shrink-0 rounded-2xl border border-white/[0.06] bg-black/60 text-center text-sm font-semibold leading-10 text-zinc-400 sm:block">
                      0{index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                            {story.region} / {story.category} / {relativeTime(story.publishedAt)}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold leading-8 text-white">
                            <Link href={`/event/${story.id}`} className="!text-white hover:!text-cyan">
                              {story.title}
                            </Link>
                          </h3>
                        </div>
                        {story.cluster ? <HeatBadge heatLevel={story.cluster.heatLevel} trend={story.cluster.trend} /> : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">{story.whyThisMatters || story.summary}</p>
                      <TrustSummary className="mt-3" reliability={story.reliability} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(story.correlations ?? []).slice(0, 5).map((correlation) => {
                          const quote = quoteMap.get(correlation.symbol);
                          return (
                            <SymbolHoverCard key={`${story.id}-${correlation.symbol}`} symbol={correlation.symbol}>
                              <Link href={`/stock/${correlation.symbol}`} className="chip">
                                <span>{correlation.symbol}</span>
                                {quote ? (
                                  <span className={quote.changePct >= 0 ? "text-emerald" : "text-red-400"}>
                                    {formatPct(quote.changePct)}
                                  </span>
                                ) : null}
                              </Link>
                            </SymbolHoverCard>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="space-y-4">
            <SectionCard title="Risk Shift" subtitle="The regions that are moving the current briefing window.">
              <div className="space-y-3">
                {(riskOverview?.regions ?? []).slice(0, 4).map((region) => (
                  <div key={region.scopeKey} className="rounded-[24px] border border-white/[0.06] bg-black/55 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{region.scopeLabel}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {region.storyCount} stories / pressure {region.marketPressure}
                        </p>
                      </div>
                      <HeatBadge heatLevel={region.heatLevel} trend={region.trend} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {region.topSymbols.map((symbol) => (
                        <SymbolHoverCard key={`${region.scopeKey}-${symbol}`} symbol={symbol}>
                          <span className="chip">{symbol}</span>
                        </SymbolHoverCard>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Narrative Board" subtitle="The clusters most likely to matter before the next refresh.">
              <div className="space-y-3">
                {(riskOverview?.narratives ?? []).slice(0, 3).map((narrative) => (
                  <div key={narrative.clusterId} className="rounded-[24px] border border-white/[0.06] bg-black/55 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          {narrative.region} / {narrative.category}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">{narrative.headline}</p>
                      </div>
                      <HeatBadge heatLevel={narrative.heatLevel} trend={narrative.trend} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{narrative.whyNow}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Mover Board" subtitle="Snapshot-backed price context for the symbols most exposed to today’s stories.">
              <div className="space-y-2">
                {(riskOverview?.radar.topMovers ?? []).slice(0, 6).map((mover) => (
                  <div key={mover.symbol} className="flex items-center justify-between rounded-[24px] border border-white/[0.06] bg-black/55 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{mover.symbol}</p>
                      <p className="text-xs text-zinc-500">{mover.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{formatCurrency(mover.price)}</p>
                      <p className={`text-xs font-semibold ${mover.changePct >= 0 ? "text-emerald" : "text-red-400"}`}>
                        {formatPct(mover.changePct)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
