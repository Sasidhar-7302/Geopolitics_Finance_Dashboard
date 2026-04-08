import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import HeatBadge from "../components/ui/HeatBadge";
import SignalOverview from "../components/ui/SignalOverview";
import SectionCard from "../components/ui/SectionCard";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import TrustSummary from "../components/ui/TrustSummary";
import { formatCurrency, formatPct, relativeTime } from "../lib/format";
import { useEntitlements } from "../lib/hooks/useEntitlements";
import { useEvents } from "../lib/hooks/useEvents";
import { usePreferences } from "../lib/hooks/usePreferences";
import { useQuotes } from "../lib/hooks/useQuotes";
import { useRiskOverview } from "../lib/hooks/useRiskOverview";
import { useSavedFilters } from "../lib/hooks/useSavedFilters";
import { useStatus } from "../lib/hooks/useStatus";
import { useWatchlists } from "../lib/hooks/useWatchlists";
import { useWorkspace } from "../lib/hooks/useWorkspace";
import { requireAuth } from "../lib/serverAuth";
import type { WorkspacePanelKey } from "../lib/workspace";

const TIME_WINDOWS = ["6h", "24h", "72h", "7d"] as const;
const SORT_OPTIONS = ["relevance", "newest", "severity", "support"] as const;
const blockClass = "rounded-[24px] border border-white/[0.05] bg-black/55 p-4";

function DashboardPanel({
  panelKey,
  title,
  subtitle,
  collapsed,
  onToggle,
  children,
}: {
  panelKey: WorkspacePanelKey;
  title: string;
  subtitle: string;
  collapsed: boolean;
  onToggle: (panelKey: WorkspacePanelKey) => void;
  children: React.ReactNode;
}) {
  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      action={
        <button type="button" onClick={() => onToggle(panelKey)} className="status-pill">
          {collapsed ? "Expand" : "Collapse"}
        </button>
      }
    >
      {collapsed ? (
        <div className="rounded-[22px] border border-dashed border-white/[0.08] bg-black/30 px-4 py-8 text-center text-sm text-zinc-500">
          {title} is collapsed for this workspace.
        </div>
      ) : children}
    </SectionCard>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { entitlements } = useEntitlements();
  const { status } = useStatus();
  const { preferences } = usePreferences();
  const { watchlists } = useWatchlists();
  const { workspace, saveWorkspace } = useWorkspace();
  const { savedFilters, saveFilter } = useSavedFilters();

  const queryText = typeof router.query.q === "string" ? router.query.q : "";
  const selectedRegion = typeof router.query.region === "string" ? router.query.region : workspace.pinnedRegions[0] || "";
  const selectedSymbol = typeof router.query.symbol === "string" ? router.query.symbol.toUpperCase() : workspace.pinnedSymbols[0] || "";
  const timeWindow = typeof router.query.window === "string" ? router.query.window : workspace.defaultTimeWindow;
  const sort = typeof router.query.sort === "string" ? router.query.sort : workspace.defaultSort;

  const { riskOverview } = useRiskOverview(timeWindow);
  const { events } = useEvents({
    q: queryText || undefined,
    regions: selectedRegion ? [selectedRegion] : undefined,
    symbols: selectedSymbol ? [selectedSymbol] : undefined,
    timeWindow,
    sort: SORT_OPTIONS.includes(sort as (typeof SORT_OPTIONS)[number]) ? (sort as (typeof SORT_OPTIONS)[number]) : "relevance",
    limit: 24,
  });

  const watchlistSymbols = useMemo(() => {
    const symbols = new Set<string>();
    watchlists.forEach((watchlist) => watchlist.items.forEach((item) => symbols.add(item.symbol)));
    workspace.pinnedSymbols.forEach((symbol) => symbols.add(symbol));
    riskOverview?.radar.topSymbols.forEach((symbol) => symbols.add(symbol));
    return Array.from(symbols).slice(0, 12);
  }, [riskOverview?.radar.topSymbols, watchlists, workspace.pinnedSymbols]);

  const { quotes } = useQuotes(watchlistSymbols);
  const quoteMap = useMemo(() => {
    const map = new Map<string, (typeof quotes)[number]>();
    quotes.forEach((quote) => map.set(quote.symbol, quote));
    return map;
  }, [quotes]);

  const filteredStories = useMemo(() => {
    return events.filter((event) => !selectedSymbol || (event.correlations ?? []).some((corr) => corr.symbol === selectedSymbol));
  }, [events, selectedSymbol]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!filteredStories.length) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId((current) => (current && filteredStories.some((event) => event.id === current) ? current : filteredStories[0].id));
  }, [filteredStories]);

  const selectedEvent = filteredStories.find((event) => event.id === selectedEventId) || filteredStories[0] || null;
  const topRegion = riskOverview?.regions[0] || null;

  const updateRoute = (patch: Record<string, string | undefined>) => {
    const nextQuery = { ...router.query, ...patch };
    Object.keys(nextQuery).forEach((key) => {
      if (!nextQuery[key]) delete nextQuery[key];
    });
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  };

  const togglePinnedRegion = async (region: string) => {
    const nextRegions = workspace.pinnedRegions.includes(region)
      ? workspace.pinnedRegions.filter((item) => item !== region)
      : [...workspace.pinnedRegions, region];
    await saveWorkspace({ pinnedRegions: nextRegions });
  };

  const togglePinnedSymbol = async (symbol: string) => {
    const nextSymbols = workspace.pinnedSymbols.includes(symbol)
      ? workspace.pinnedSymbols.filter((item) => item !== symbol)
      : [...workspace.pinnedSymbols, symbol];
    await saveWorkspace({ pinnedSymbols: nextSymbols });
  };

  const togglePanel = async (panelKey: WorkspacePanelKey) => {
    const collapsedPanels = workspace.collapsedPanels.includes(panelKey)
      ? workspace.collapsedPanels.filter((item) => item !== panelKey)
      : [...workspace.collapsedPanels, panelKey];
    await saveWorkspace({ collapsedPanels });
  };

  const saveCurrentView = async () => {
    await saveFilter({
      name: `${selectedRegion || "Global"} ${timeWindow} view`,
      query: queryText || null,
      regions: selectedRegion ? [selectedRegion] : [],
      categories: [],
      symbols: selectedSymbol ? [selectedSymbol] : [],
      direction: "all",
      severityMin: 0,
      timeWindow,
      sortKey: sort,
      isPinned: false,
    });
  };

  const quickScopeItems = [
    ...workspace.pinnedRegions.map((region) => ({ key: `region-${region}`, label: region, patch: { region } })),
    ...workspace.pinnedSymbols.map((symbol) => ({ key: `symbol-${symbol}`, label: symbol, patch: { symbol } })),
    ...savedFilters.slice(0, 3).map((filter) => ({
      key: filter.id,
      label: filter.name,
      patch: {
        q: filter.query || undefined,
        region: filter.regions[0] || undefined,
        symbol: filter.symbols[0] || undefined,
        window: filter.timeWindow || undefined,
        sort: filter.sortKey || undefined,
      },
    })),
  ];

  return (
    <Layout>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SectionCard
            title="Workspace"
            subtitle="Filter the operating view, save it, and reopen the same context later."
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveCurrentView} className="status-pill">Save view</button>
                <Link href="/digest" className="status-pill">Open brief</Link>
              </div>
            }
          >
            <div className="space-y-4">
              <label className={`block ${blockClass}`}>
                <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Search</span>
                <input
                  value={queryText}
                  onChange={(event) => updateRoute({ q: event.target.value || undefined })}
                  placeholder="Search narratives, regions, commodities, or symbols"
                  className="mt-2 w-full bg-transparent text-base text-white outline-none placeholder:text-zinc-600"
                />
              </label>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_140px_140px]">
                <div className={blockClass}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Focus</p>
                  <p className="mt-2 text-sm font-semibold text-white">{selectedRegion || topRegion?.scopeLabel || "Global view"}</p>
                  <p className="mt-1 text-xs text-zinc-500">{selectedSymbol ? `Symbol filter ${selectedSymbol}` : `${filteredStories.length} matching stories`}</p>
                </div>
                <label className={blockClass}>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Region</span>
                  <select value={selectedRegion} onChange={(event) => updateRoute({ region: event.target.value || undefined })} className="mt-2 w-full rounded-xl border border-white/[0.06] bg-black/50 px-3 py-2 text-sm">
                    <option value="">All regions</option>
                    {(riskOverview?.regions ?? []).map((region) => (
                      <option key={region.scopeKey} value={region.scopeLabel}>{region.scopeLabel}</option>
                    ))}
                  </select>
                </label>
                <label className={blockClass}>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Window</span>
                  <select
                    value={timeWindow}
                    onChange={async (event) => {
                      updateRoute({ window: event.target.value });
                      await saveWorkspace({ defaultTimeWindow: event.target.value });
                    }}
                    className="mt-2 w-full rounded-xl border border-white/[0.06] bg-black/50 px-3 py-2 text-sm"
                  >
                    {TIME_WINDOWS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className={blockClass}>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Sort</span>
                  <select
                    value={sort}
                    onChange={async (event) => {
                      updateRoute({ sort: event.target.value });
                      await saveWorkspace({ defaultSort: event.target.value as "relevance" | "newest" | "severity" | "support" });
                    }}
                    className="mt-2 w-full rounded-xl border border-white/[0.06] bg-black/50 px-3 py-2 text-sm"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className={blockClass}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Pressure</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{riskOverview?.radar.pressureScore ?? 0}/100</p>
                  <p className="mt-1 text-xs text-zinc-500">Current posture {riskOverview?.radar.posture || "mixed"}</p>
                </div>
                <div className={blockClass}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Top region</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{topRegion?.scopeLabel || "No active zone"}</p>
                  <p className="mt-1 text-xs text-zinc-500">{topRegion ? `${topRegion.storyCount} stories in focus` : "Waiting for signal"}</p>
                </div>
                <div className={blockClass}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Feed health</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{Math.round((status?.sourceHealth?.healthScore ?? 0) * 100)}/100</p>
                  <p className="mt-1 text-xs text-zinc-500">{status?.sourceHealth?.description || `${filteredStories.length} stories match the current workspace filters`}</p>
                </div>
              </div>

              {quickScopeItems.length ? (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Quick scope</p>
                  <div className="flex flex-wrap gap-2">
                    {quickScopeItems.map((item) => (
                      <button key={item.key} type="button" onClick={() => updateRoute(item.patch)} className="chip">
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <DashboardPanel
            panelKey="risk"
            title="Priority Regions"
            subtitle="Start here. The highest-risk regions are ranked using severity, trust, recency, and market pressure."
            collapsed={workspace.collapsedPanels.includes("risk")}
            onToggle={togglePanel}
          >
            <div className="space-y-3">
              {(riskOverview?.regions ?? []).slice(0, 6).map((region) => (
                <button
                  key={region.scopeKey}
                  type="button"
                  onClick={() => updateRoute({ region: region.scopeLabel })}
                  className="w-full rounded-[24px] border border-white/[0.05] bg-black/50 p-4 text-left transition hover:border-cyan/20 hover:bg-cyan/[0.04]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="text-base font-semibold text-white">{region.scopeLabel}</p>
                        <p className="text-xs text-zinc-500">{region.storyCount} stories / {region.narrativeCount} narratives</p>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        Risk score {Math.round(region.riskScore)} / 100 / support {Math.round(region.supportScore * 100)}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <HeatBadge heatLevel={region.heatLevel} trend={region.trend} />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePinnedRegion(region.scopeLabel);
                        }}
                        className={`chip ${workspace.pinnedRegions.includes(region.scopeLabel) ? "!border-cyan/30 !bg-cyan/10 !text-white" : ""}`}
                      >
                        {workspace.pinnedRegions.includes(region.scopeLabel) ? "Pinned" : "Pin"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="h-2 flex-1 rounded-full bg-white/[0.06]">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan via-emerald to-amber-400"
                        style={{ width: `${Math.min(100, region.riskScore)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 lg:max-w-[45%] lg:justify-end">
                      {region.topSymbols.slice(0, 4).map((symbol) => (
                        <SymbolHoverCard key={`${region.scopeKey}-${symbol}`} symbol={symbol}>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              updateRoute({ symbol });
                            }}
                            className="chip"
                          >
                            {symbol}
                          </button>
                        </SymbolHoverCard>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel
            panelKey="briefing"
            title="Story Feed"
            subtitle="The filtered event stream for the current workspace state."
            collapsed={workspace.collapsedPanels.includes("briefing")}
            onToggle={togglePanel}
          >
            <div className="space-y-3">
              {filteredStories.slice(0, 8).map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => setSelectedEventId(story.id)}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${selectedEventId === story.id ? "border-cyan/25 bg-cyan/[0.05]" : "border-white/[0.05] bg-black/50 hover:border-white/[0.1]"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        {story.region} / {story.category} / {relativeTime(story.publishedAt)}
                      </p>
                      <h3 className="mt-2 text-base font-semibold text-white">{story.title}</h3>
                    </div>
                    {story.cluster ? <HeatBadge heatLevel={story.cluster.heatLevel} trend={story.cluster.trend} /> : null}
                  </div>

                  <p className="mt-3 text-sm leading-6 text-zinc-400">{story.whyThisMatters || story.summary}</p>

                  <TrustSummary
                    className="mt-3"
                    compact
                    supportingSourcesCount={story.supportingSourcesCount}
                    sourceReliability={story.sourceReliability}
                    intelligenceQuality={story.intelligenceQuality}
                    publishedAt={story.publishedAt}
                    reliability={story.reliability}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(story.correlations ?? []).slice(0, 4).map((correlation) => (
                      <button
                        key={`${story.id}-${correlation.symbol}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          updateRoute({ symbol: correlation.symbol });
                        }}
                        className="chip"
                      >
                        {correlation.symbol}
                      </button>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </DashboardPanel>
        </div>

        <div className="space-y-4">
          <SectionCard title="Selected Story" subtitle="One focused research panel that follows the active story selection.">
            {selectedEvent ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/[0.05] bg-black/55 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        {selectedEvent.region} / {selectedEvent.category} / {selectedEvent.source}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">{selectedEvent.title}</h2>
                    </div>
                    {selectedEvent.cluster ? <HeatBadge heatLevel={selectedEvent.cluster.heatLevel} trend={selectedEvent.cluster.trend} /> : null}
                  </div>

                  <p className="mt-4 text-sm leading-7 text-zinc-400">{selectedEvent.whyThisMatters || selectedEvent.summary}</p>

                  <SignalOverview className="mt-4" reliability={selectedEvent.reliability} />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/event/${selectedEvent.id}`} className="btn-primary">Open event file</Link>
                    <button type="button" onClick={() => togglePinnedRegion(selectedEvent.region)} className="btn-secondary">
                      {workspace.pinnedRegions.includes(selectedEvent.region) ? "Unpin region" : "Pin region"}
                    </button>
                  </div>
                </div>

                {selectedEvent.cluster ? (
                  <div className={blockClass}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Cluster context</p>
                    <p className="mt-3 text-sm font-semibold text-white">{selectedEvent.cluster.headline}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{selectedEvent.cluster.whyNow}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedEvent.cluster.watchSymbols.map((symbol) => (
                        <button key={`${selectedEvent.cluster?.clusterId}-${symbol}`} type="button" onClick={() => updateRoute({ symbol })} className="chip">
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/[0.08] bg-black/30 px-4 py-8 text-center text-sm text-zinc-500">
                No stories match the current workspace filters.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Market Context" subtitle="The directly exposed symbols linked to the selected story.">
            {selectedEvent ? (
              <div className="space-y-2">
                {(selectedEvent.correlations ?? []).slice(0, 6).map((correlation) => {
                  const quote = quoteMap.get(correlation.symbol);
                  return (
                    <div key={`${selectedEvent.id}-${correlation.symbol}`} className="flex items-center justify-between rounded-[22px] border border-white/[0.05] bg-black/50 px-4 py-3">
                      <div>
                        <button type="button" onClick={() => updateRoute({ symbol: correlation.symbol })} className="text-sm font-semibold text-white transition hover:text-cyan">
                          {correlation.symbol}
                        </button>
                        <p className="text-xs text-zinc-500">
                          {correlation.impactDirection} bias / score {Math.round(correlation.impactScore * 100)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{quote ? formatCurrency(quote.price) : "No quote"}</p>
                        <p className={`text-xs font-semibold ${quote && quote.changePct >= 0 ? "text-emerald" : "text-red-400"}`}>
                          {quote ? formatPct(quote.changePct) : formatPct(correlation.impactMagnitude)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/[0.08] bg-black/30 px-4 py-8 text-center text-sm text-zinc-500">
                Select a story to open its market context.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Watchlist Context" subtitle="Pinned symbols and followed assets with the latest available price context.">
            <div className="space-y-2">
              {watchlistSymbols.slice(0, 6).map((symbol) => {
                const quote = quoteMap.get(symbol);
                return (
                  <div key={symbol} className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/[0.05] bg-black/50 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{symbol}</p>
                        <p className="text-[11px] text-zinc-500">{preferences.symbols.includes(symbol) ? "Preference" : "Watchlist / radar"}</p>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{quote ? formatCurrency(quote.price) : "No quote"} {quote ? `/ ${formatPct(quote.changePct)}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePinnedSymbol(symbol)}
                        className={`chip ${workspace.pinnedSymbols.includes(symbol) ? "!border-cyan/30 !bg-cyan/10 !text-white" : ""}`}
                      >
                        {workspace.pinnedSymbols.includes(symbol) ? "Pinned" : "Pin"}
                      </button>
                      <Link href={`/stock/${symbol}`} className="btn-secondary">Open</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Signal Integrity" subtitle="Use this before acting. It shows whether the upstream feed layer is healthy enough to trust emerging stories quickly.">
            <div className="space-y-3">
              <div className={blockClass}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Network health</p>
                <p className="mt-2 text-sm font-semibold text-white">{status?.sourceHealth?.label || "Feed health unavailable"}</p>
                <p className="mt-1 text-xs text-zinc-500">{status?.sourceHealth?.description || "No source-health telemetry has been recorded yet."}</p>
              </div>
              <div className={blockClass}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Coverage snapshot</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {status?.sourceHealth?.healthyFeeds ?? 0} healthy / {status?.sourceHealth?.degradedFeeds ?? 0} degraded / {status?.sourceHealth?.failedFeeds ?? 0} failed
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {workspace.pinnedRegions.length + workspace.pinnedSymbols.length} pins saved in this workspace / {entitlements?.premiumActive ? 20 : 8} available.
                </p>
              </div>
              {status?.sourceHealth?.activeIssues?.length ? (
                <div className="space-y-2">
                  {status.sourceHealth.activeIssues.slice(0, 3).map((issue) => (
                    <div key={issue.source} className="rounded-[20px] border border-white/[0.06] bg-black/50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{issue.source}</p>
                        <span className="chip">{issue.label}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">{issue.note}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
