import Link from "next/link";
import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import PublicLayout from "../components/layout/PublicLayout";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import TrustSummary from "../components/ui/TrustSummary";
import { formatCurrency, formatPct, relativeTime } from "../lib/format";
import { getMarketFreshnessLabel } from "../lib/marketPresentation";
import { getPublicPreviewData } from "../lib/publicPreview";
import { getOptionalPageUser } from "../lib/serverAuth";

const WORKFLOWS = [
  {
    title: "Morning Brief",
    description:
      "A 7am local-time digest that explains what changed overnight, which assets are exposed, and what deserves attention before the open.",
  },
  {
    title: "Risk Radar",
    description:
      "A filtered event feed for macro, defense, sanctions, energy, and regional stress, built to answer why markets care instead of dumping raw headlines.",
  },
  {
    title: "Regional Tracker",
    description:
      "Persistent views for the regions and symbols you actually follow so the product becomes a repeat workflow, not a one-time dashboard visit.",
  },
] as const;

const ACCESS_LADDER = [
  {
    name: "Public preview",
    price: "Free",
    description: "A live anonymous glance at the latest high-signal stories, regional hotspots, and delayed market snapshots.",
    features: [
      "Top stories with plain-English why-it-matters context",
      "Regional hotspots and recent market movers",
      "No account required",
    ],
  },
  {
    name: "Free account",
    price: "$0",
    description: "The full core workflow for serious evaluation before anyone pays.",
    features: [
      "Dashboard, digest, timeline, map, and event drill-downs",
      "1 watchlist, 3 alerts, 3 saved views",
      "Daily digest with the top 5 stories",
    ],
  },
  {
    name: "Premium",
    price: "$8/mo or $79/yr",
    description: "Higher-capacity workflows for users who want GeoPulse as a daily operating surface.",
    features: [
      "Unlimited alerts, watchlists, and saved views",
      "10-story digest plus intraday briefing scaffolding",
      "Premium insights and faster market refresh when enabled",
    ],
  },
] as const;

export default function Home({
  preview,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <PublicLayout>
      <div className="flex flex-1 flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-5">
            <span className="chip">Built for finance-curious investors, macro operators, and analysts</span>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-white md:text-6xl">
                Understand what happened, <span className="text-gradient">why markets care,</span> and what to watch next.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-400">
                GeoPulse turns geopolitical events into investor-ready context. The public preview shows the live surface. Free accounts unlock the full dashboard.
                Premium is reserved for deeper workflows, higher limits, and faster briefings.
              </p>
              <p className="max-w-2xl text-sm leading-6 text-zinc-500">
                The preview now prioritizes stories with stronger confirmation, cleaner source mixes, and clearer market relevance instead of showing every headline that happened to mention risk.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/#live-preview" className="btn-primary">
                Open live preview
              </Link>
              <Link href="/auth/signup" className="btn-secondary">
                Create free account
              </Link>
              <Link href="/auth/signin" className="ghost-chip hover:bg-white/[0.06]">
                Sign in
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
              <span className="rounded-full border border-emerald/20 bg-emerald/10 px-3 py-1 text-emerald">
                {preview.metrics.foundingSpotsRemaining > 0
                  ? `${preview.metrics.foundingSpotsRemaining} founding beta spots remaining`
                  : "Founding beta closed"}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                {preview.metrics.totalEvents.toLocaleString()} total events tracked
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                {preview.metrics.recentEvents24h} events in the last 24h
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                {preview.metrics.totalCorrelations.toLocaleString()} market links
              </span>
            </div>
          </div>

          <div className="surface-card p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Why it is useful</p>
            <div className="mt-4 space-y-4">
              {WORKFLOWS.map((workflow) => (
                <div key={workflow.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <h2 className="text-sm font-semibold text-white">{workflow.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{workflow.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="text-sm font-semibold text-white">Current product flow</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Anonymous users get a live glance. Free accounts get the core research workflow. Premium adds capacity, richer briefings, and faster signal delivery instead of taking away the basics.
              </p>
            </div>
          </div>
        </section>

        <section id="live-preview" className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Live preview</p>
                <h2 className="mt-2 text-2xl font-bold text-white">High-signal stories from the last 72 hours</h2>
                <p className="mt-1 text-sm text-zinc-500">The public preview favors stories with clearer confirmation and more defensible market relevance.</p>
              </div>
              <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-500">
                Last ingestion {preview.lastIngestion?.completedAt ? relativeTime(preview.lastIngestion.completedAt) : "not available"}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {preview.previewStories.map((story) => (
                <article key={story.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    <span>{story.region}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-700" />
                    <span>{story.category}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-700" />
                    <span>{story.supportingSourcesCount} sources</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">{story.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {story.whyThisMatters || story.summary}
                  </p>
                  <TrustSummary
                    className="mt-3"
                    supportingSourcesCount={story.supportingSourcesCount}
                    sourceReliability={story.sourceReliability}
                    intelligenceQuality={story.intelligenceQuality}
                    publishedAt={story.publishedAt}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {story.correlations.slice(0, 4).map((correlation) => (
                        <SymbolHoverCard key={`${story.id}-${correlation.symbol}`} symbol={correlation.symbol}>
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                            {correlation.symbol}
                          </span>
                        </SymbolHoverCard>
                      ))}
                    </div>
                    <div className="text-right text-[11px] text-zinc-500">
                      <p>{story.source}</p>
                      <p>{relativeTime(story.publishedAt)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Market snapshot</p>
                  <h2 className="mt-2 text-xl font-bold text-white">Top movers tied to the current story set</h2>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-500">
                  {preview.topMovers[0]?.freshness
                    ? `${getMarketFreshnessLabel(preview.topMovers[0].freshness as "live" | "delayed" | "snapshot")} quotes`
                    : "Snapshot quotes"}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {preview.topMovers.map((mover) => (
                  <div
                    key={mover.symbol}
                    className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <SymbolHoverCard symbol={mover.symbol}>
                          <span className="text-sm font-semibold text-white">{mover.symbol}</span>
                        </SymbolHoverCard>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{mover.assetClass}</span>
                      </div>
                      <p className="truncate text-[11px] text-zinc-500">{mover.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{formatCurrency(mover.price)}</p>
                      <p className={`text-[11px] font-semibold ${mover.changePct >= 0 ? "text-emerald" : "text-red-400"}`}>
                        {formatPct(mover.changePct)}
                      </p>
                    </div>
                  </div>
                ))}
                {preview.topMovers.length === 0 && (
                  <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
                    Snapshot data will populate again after the next market-sync cycle.
                  </p>
                )}
              </div>
            </div>

            <div className="surface-card p-6">
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Regional pressure</p>
              <h2 className="mt-2 text-xl font-bold text-white">Where the current risk concentration sits</h2>
              <div className="mt-4 space-y-2">
                {preview.hotspots.map((hotspot) => (
                  <div key={hotspot.region}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-200">{hotspot.region}</span>
                      <span className="font-semibold text-white">{hotspot.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/[0.05]">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald to-cyan"
                        style={{
                          width: `${Math.min(100, (hotspot.count / Math.max(preview.hotspots[0]?.count || 1, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-6">
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Why register</p>
              <h2 className="mt-2 text-xl font-bold text-white">The preview is the sample, not the whole product</h2>
              <div className="mt-4 space-y-2 text-sm text-zinc-400">
                <p>Free accounts unlock the dashboard, timeline, map, alerts, watchlists, and personalized morning brief.</p>
                <p>Premium is where higher-capacity workflows live: more alerts, more saved views, deeper insights, and faster refresh when the paid layer is turned on.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/auth/signup" className="btn-primary">
                  Create free account
                </Link>
                <Link href="/auth/signin" className="ghost-chip hover:bg-white/[0.06]">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="plans" className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Access model</p>
            <h2 className="mt-2 text-2xl font-bold text-white">A conversion ladder that keeps the product useful before anyone pays</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {ACCESS_LADDER.map((plan) => (
              <div key={plan.name} className="surface-card p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{plan.name}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{plan.price}</p>
                  </div>
                  {plan.name === "Premium" && (
                    <span className="rounded-full border border-emerald/20 bg-emerald/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald">
                      Best for daily users
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{plan.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
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

  const preview = await getPublicPreviewData();

  return {
    props: {
      preview,
    },
  };
}
