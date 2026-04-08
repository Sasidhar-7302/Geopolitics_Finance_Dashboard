import Link from "next/link";
import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import PublicLayout from "../components/layout/PublicLayout";
import HeatBadge from "../components/ui/HeatBadge";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import TrustSummary from "../components/ui/TrustSummary";
import { formatCurrency, formatPct, relativeTime } from "../lib/format";
import { getMarketFreshnessLabel } from "../lib/marketPresentation";
import { getPublicPreviewData } from "../lib/publicPreview";
import { getRiskOverview } from "../lib/risk";
import { getOptionalPageUser } from "../lib/serverAuth";

const PRODUCT_STEPS = [
  {
    label: "1. Start with pressure",
    description: "See which region and narrative moved to the top before reading the full stream.",
  },
  {
    label: "2. Validate the signal",
    description: "Use corroboration, source quality, and freshness so you know whether the story is early, solid, or still noisy.",
  },
  {
    label: "3. Move into research",
    description: "Open the dashboard, map, digest, and event file without switching tools or rebuilding context.",
  },
] as const;

const ACCESS_LADDER = [
  {
    name: "Public preview",
    price: "Free",
    description: "Live radar, hotspots, top stories, and market reaction before signup.",
  },
  {
    name: "Free account",
    price: "$0",
    description: "Command center, map, digest, and persistent workspace state.",
  },
  {
    name: "Premium",
    price: "$8/mo or $79/yr",
    description: "More depth, more persistence, and a larger operating budget for daily use.",
  },
] as const;

export default function Home({
  preview,
  risk,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const topNarrative = risk.narratives[0] || null;
  const topZone = risk.regions[0] || null;
  const topMover = preview.topMovers[0] || null;

  return (
    <PublicLayout>
      <div className="flex flex-1 flex-col gap-6 pb-10">
        <section className="command-surface overflow-hidden p-6 sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="kicker">Finance-First Geopolitical Monitoring</span>
                <span className="chip">
                  {preview.metrics.degradedSources > 0
                    ? `${preview.metrics.degradedSources} feeds degraded`
                    : "Feed network healthy"}
                </span>
              </div>

              <div className="max-w-4xl space-y-4">
                <h1 className="text-4xl font-bold leading-[0.95] text-white sm:text-5xl xl:text-[4.4rem]">
                  Understand what changed,
                  <br />
                  why it matters,
                  <br />
                  <span className="text-gradient">and which assets are exposed.</span>
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                  GeoPulse turns fast-moving geopolitical headlines into one clean operating surface:
                  pressure, priority region, validated story, and market reaction.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/auth/signup" className="btn-primary">
                  Create free account
                </Link>
                <Link href="/#live-preview" className="btn-secondary">
                  See the live preview
                </Link>
                <Link href="/auth/signin" className="btn-secondary">
                  Sign in
                </Link>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {PRODUCT_STEPS.map((step) => (
                  <div key={step.label} className="rounded-[24px] border border-white/[0.06] bg-black/55 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-cyan">{step.label}</p>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/[0.06] bg-black/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="kicker">Live Command Snapshot</p>
                  <h2 className="mt-4 text-2xl font-semibold text-white">Start here</h2>
                </div>
                <span className="chip capitalize">{risk.radar.posture}</span>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-[22px] border border-white/[0.06] bg-black/60 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Pressure</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-semibold text-white">{risk.radar.pressureScore}/100</p>
                      <p className="mt-1 text-xs text-zinc-500">Current market posture is {risk.radar.posture}</p>
                    </div>
                    <div className="text-right text-xs text-zinc-500">
                      <p>{risk.radar.breadth.positive} up</p>
                      <p>{risk.radar.breadth.flat} flat</p>
                      <p>{risk.radar.breadth.negative} down</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-cyan via-emerald to-amber-400"
                      style={{ width: `${Math.min(100, risk.radar.pressureScore)}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/[0.06] bg-black/60 p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Priority region</p>
                    <p className="mt-3 text-lg font-semibold text-white">{topZone?.scopeLabel || "No active zone"}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {topZone
                        ? `${topZone.storyCount} stories / ${topZone.narrativeCount} narratives`
                        : "Waiting for fresh signal"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/[0.06] bg-black/60 p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Top mover</p>
                    <p className="mt-3 text-lg font-semibold text-white">{topMover?.symbol || "No quote"}</p>
                    <p className={`mt-1 text-sm font-semibold ${topMover && topMover.changePct >= 0 ? "text-emerald" : "text-red-400"}`}>
                      {topMover ? formatPct(topMover.changePct) : "Snapshot unavailable"}
                    </p>
                  </div>
                </div>

                {topNarrative ? (
                  <div className="rounded-[22px] border border-white/[0.06] bg-black/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          {topNarrative.region} / {topNarrative.category}
                        </p>
                        <p className="mt-2 text-lg font-semibold leading-8 text-white">{topNarrative.headline}</p>
                      </div>
                      <HeatBadge heatLevel={topNarrative.heatLevel} trend={topNarrative.trend} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{topNarrative.whyNow}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {topNarrative.watchSymbols.slice(0, 4).map((symbol) => (
                        <SymbolHoverCard key={symbol} symbol={symbol}>
                          <span className="chip">{symbol}</span>
                        </SymbolHoverCard>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section id="live-preview" className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_360px]">
          <div className="command-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="kicker">Live Stories</p>
                <h2 className="mt-4 text-2xl font-semibold text-white">The highest-signal stories first</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Last ingestion {preview.lastIngestion?.completedAt ? relativeTime(preview.lastIngestion.completedAt) : "not available"}
                </p>
              </div>
              <span className="chip">{Math.min(4, preview.previewStories.length)} priority stories</span>
            </div>

            <div className="mt-5 grid gap-3">
              {preview.previewStories.slice(0, 4).map((story, index) => (
                <article key={story.id} className="rounded-[24px] border border-white/[0.06] bg-black/55 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-4">
                      <div className="hidden h-10 w-10 shrink-0 rounded-2xl border border-white/[0.06] bg-black/60 text-center text-sm font-semibold leading-10 text-zinc-400 sm:block">
                        0{index + 1}
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          {story.region} / {story.category} / {story.source}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold leading-8 text-white">{story.title}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500">{relativeTime(story.publishedAt)}</p>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-zinc-400">{story.whyThisMatters || story.summary}</p>

                  <TrustSummary
                    className="mt-4"
                    supportingSourcesCount={story.supportingSourcesCount}
                    sourceReliability={story.sourceReliability}
                    intelligenceQuality={story.intelligenceQuality}
                    publishedAt={story.publishedAt}
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {story.correlations.slice(0, 4).map((correlation) => (
                      <SymbolHoverCard key={`${story.id}-${correlation.symbol}`} symbol={correlation.symbol}>
                        <span className="chip">{correlation.symbol}</span>
                      </SymbolHoverCard>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="command-surface p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="kicker">Hotspots</p>
                  <h2 className="mt-4 text-xl font-semibold text-white">Where the map is heating up</h2>
                </div>
                <span className="chip">{risk.window}</span>
              </div>

              <div className="mt-5 space-y-3">
                {risk.regions.slice(0, 4).map((region) => (
                  <div key={region.scopeKey} className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{region.scopeLabel}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {region.storyCount} stories / support {Math.round(region.supportScore * 100)}%
                        </p>
                      </div>
                      <HeatBadge heatLevel={region.heatLevel} trend={region.trend} />
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/[0.06]">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan via-emerald to-amber-400"
                        style={{ width: `${Math.min(100, region.riskScore)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {region.topSymbols.slice(0, 4).map((symbol) => (
                        <SymbolHoverCard key={`${region.scopeKey}-${symbol}`} symbol={symbol}>
                          <span className="chip">{symbol}</span>
                        </SymbolHoverCard>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="command-surface p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="kicker">Mover Board</p>
                  <h2 className="mt-4 text-xl font-semibold text-white">Cross-asset reaction</h2>
                </div>
                <span className="chip">
                  {topMover?.freshness
                    ? getMarketFreshnessLabel(topMover.freshness as "live" | "delayed" | "snapshot")
                    : "Snapshot"}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {preview.topMovers.map((mover) => (
                  <div key={mover.symbol} className="flex items-center justify-between rounded-[22px] border border-white/[0.06] bg-black/55 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{mover.symbol}</span>
                        <span className="text-[11px] text-zinc-500">{mover.assetClass}</span>
                      </div>
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
            </div>

            <div className="command-surface p-6">
              <p className="kicker">Coverage Snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Tracked events</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{preview.metrics.totalEvents.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-zinc-500">Structured into market-aware narratives</p>
                </div>
                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Fresh stories</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{preview.metrics.recentEvents24h}</p>
                  <p className="mt-1 text-xs text-zinc-500">Stories published inside the last 24 hours</p>
                </div>
              </div>
              {preview.hotspots.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {preview.hotspots.map((hotspot) => (
                    <span key={hotspot.region} className="chip">
                      {hotspot.region} {hotspot.count}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section id="plans" className="command-surface p-6 sm:p-7">
          <div className="flex flex-col gap-2">
            <p className="kicker">Access Model</p>
            <h2 className="text-2xl font-semibold text-white">Useful before payment, deeper after upgrade</h2>
            <p className="max-w-3xl text-sm leading-6 text-zinc-500">
              The free layer should already be actionable. Premium adds persistence and capacity, not basic usability.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {ACCESS_LADDER.map((plan) => (
              <div key={plan.name} className="rounded-[24px] border border-white/[0.06] bg-black/55 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{plan.name}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{plan.price}</p>
                  </div>
                  {plan.name === "Premium" ? <span className="kicker">Best for daily use</span> : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{plan.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const currentUser = await getOptionalPageUser(context);
  if (currentUser) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const [preview, risk] = await Promise.all([getPublicPreviewData(), getRiskOverview("72h")]);

  return {
    props: {
      preview,
      risk,
    },
  };
}
