import Link from "next/link";
import { useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import MetricCard from "../components/ui/MetricCard";
import SectionCard from "../components/ui/SectionCard";
import StockTicker from "../components/ui/StockTicker";
import EventMarketPanel from "../components/dashboard/EventMarketPanel";
import PatternInsightsCard from "../components/dashboard/PatternInsightsCard";
import TopMoversCard from "../components/dashboard/TopMoversCard";
import { categorizeEvent, CATEGORY_RULES } from "../lib/intelligence";
import { useEvents, type EventItem } from "../lib/hooks/useEvents";
import { useWatchlists } from "../lib/hooks/useWatchlists";
import { useQuotes, type Quote } from "../lib/hooks/useQuotes";
import { useStatus } from "../lib/hooks/useStatus";
import { usePreferences } from "../lib/hooks/usePreferences";
import { useSavedFilters } from "../lib/hooks/useSavedFilters";
import { useEntitlements } from "../lib/hooks/useEntitlements";
import { getMarketFreshnessLabel, getMarketProviderLabel } from "../lib/marketPresentation";
import { requireAuth } from "../lib/serverAuth";

const DEFAULT_WATCHLIST_SYMBOLS = ["SPY", "QQQ", "GLD", "XLE", "TLT", "ITA", "USO", "NVDA"];

const TIME_WINDOWS = [
  { key: "all", label: "All time" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" },
  { key: "3d", label: "3d" },
  { key: "7d", label: "7d" },
] as const;

const MARKET_DIRECTION_OPTIONS = [
  { key: "all", label: "All reactions" },
  { key: "up", label: "Mostly up" },
  { key: "down", label: "Mostly down" },
  { key: "mixed", label: "Mixed" },
  { key: "none", label: "No live move" },
] as const;

const SORT_OPTIONS = [
  { key: "relevance", label: "Most relevant" },
  { key: "newest", label: "Newest first" },
  { key: "severity", label: "Highest severity" },
  { key: "support", label: "Most confirmed" },
] as const;

const SEVERITY_OPTIONS = [
  { key: "all", label: "All severity" },
  { key: "5", label: "Severity 5+" },
  { key: "7", label: "Severity 7+" },
  { key: "9", label: "Severity 9+" },
] as const;

type TimeWindowKey = (typeof TIME_WINDOWS)[number]["key"];
type MarketDirectionKey = (typeof MARKET_DIRECTION_OPTIONS)[number]["key"];
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

function getEventMarketDirection(event: EventItem, quoteMap: Map<string, Quote>): Exclude<MarketDirectionKey, "all"> {
  const correlations = event.correlations ?? [];
  if (correlations.length === 0) return "none";

  let hasUp = false;
  let hasDown = false;

  for (const corr of correlations) {
    const liveChange = quoteMap.get(corr.symbol)?.changePct;

    if (typeof liveChange === "number" && liveChange !== 0) {
      if (liveChange > 0) hasUp = true;
      if (liveChange < 0) hasDown = true;
      continue;
    }

    if (corr.impactDirection === "up") hasUp = true;
    if (corr.impactDirection === "down") hasDown = true;
  }

  if (hasUp && hasDown) return "mixed";
  if (hasUp) return "up";
  if (hasDown) return "down";
  return "none";
}

function getEventStrongestMove(event: EventItem, quoteMap: Map<string, Quote>) {
  return (event.correlations ?? []).reduce((maxMove, corr) => {
    const liveChange = quoteMap.get(corr.symbol)?.changePct;
    const move = typeof liveChange === "number" && liveChange !== 0
      ? Math.abs(liveChange)
      : Math.abs(corr.impactMagnitude);

    return Math.max(maxMove, move);
  }, 0);
}

export default function Dashboard() {
  const { watchlists } = useWatchlists();
  const { status } = useStatus();
  const { preferences, isLoading: prefsLoading } = usePreferences();
  const { savedFilters, saveFilter, removeFilter } = useSavedFilters();
  const { entitlements } = useEntitlements();

  const [activeCategory, setActiveCategory] = useState("for-you");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<TimeWindowKey>("24h");
  const [selectedMarketDirection, setSelectedMarketDirection] = useState<MarketDirectionKey>("all");
  const [selectedSort, setSelectedSort] = useState<SortKey>("relevance");
  const [saveViewName, setSaveViewName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const hasPreferences = preferences.categories.length > 0 || preferences.regions.length > 0 || preferences.symbols.length > 0;

  const eventQuery = useMemo(() => ({
    q: searchQuery.trim() || undefined,
    regions: selectedRegion !== "all" ? [selectedRegion] : undefined,
    categories: activeCategory !== "all" && activeCategory !== "for-you" ? [activeCategory] : undefined,
    direction: selectedMarketDirection,
    severityMin: selectedSeverity === "all" ? 0 : Number(selectedSeverity),
    timeWindow: selectedTimeWindow,
    sort: selectedSort,
    limit: activeCategory === "for-you" ? 40 : 20,
  }), [activeCategory, searchQuery, selectedMarketDirection, selectedRegion, selectedSeverity, selectedSort, selectedTimeWindow]);

  const { events: fetchedEvents, isLoading, pagination } = useEvents(eventQuery);

  const allSymbols = useMemo(() => {
    const symbols = new Set<string>(DEFAULT_WATCHLIST_SYMBOLS);

    if (watchlists[0]?.items) {
      watchlists[0].items.forEach((item) => symbols.add(item.symbol));
    }

    preferences.symbols.forEach((symbol) => symbols.add(symbol));
    fetchedEvents.forEach((event) => event.correlations?.forEach((corr) => symbols.add(corr.symbol)));

    return Array.from(symbols);
  }, [fetchedEvents, preferences.symbols, watchlists]);

  const { quotes, meta: quoteMeta } = useQuotes(allSymbols);

  const quoteMap = useMemo(() => {
    const map = new Map<string, Quote>();
    quotes.forEach((quote) => map.set(quote.symbol, quote));
    return map;
  }, [quotes]);

  const events = useMemo(() => {
    if (activeCategory !== "for-you" || !hasPreferences) return fetchedEvents;

    return fetchedEvents
      .filter((event) => {
        if (preferences.categories.includes(event.category || categorizeEvent(event.title, event.summary))) return true;
        if (preferences.regions.includes(event.region)) return true;
        if (event.correlations?.some((corr) => preferences.symbols.includes(corr.symbol))) return true;
        return false;
      })
      .sort((a, b) => {
        const aScore = (a.relevanceScore ?? 0) + (a.supportingSourcesCount ?? 0) + ((a.intelligenceQuality ?? 0.5) * 2);
        const bScore = (b.relevanceScore ?? 0) + (b.supportingSourcesCount ?? 0) + ((b.intelligenceQuality ?? 0.5) * 2);
        return bScore - aScore;
      });
  }, [activeCategory, fetchedEvents, hasPreferences, preferences]);

  const matchingEventsCount = activeCategory === "for-you" ? events.length : (pagination?.total ?? events.length);

  const availableRegions = useMemo(() => {
    return Array.from(new Set(fetchedEvents.map((event) => event.region).filter(Boolean))).sort();
  }, [fetchedEvents]);

  const summary = useMemo(() => {
    const now = Date.now();
    const last24h = events.filter((event) => now - new Date(event.publishedAt).getTime() < 24 * 60 * 60 * 1000);
    const highSeverity = events.filter((event) => (event.severity ?? 0) >= 7);
    const correlationCount = events.reduce((total, event) => total + (event.correlations?.length ?? 0), 0);

    const categoryCounts: Record<string, number> = {};
    for (const event of events) {
      const category = event.category || categorizeEvent(event.title, event.summary);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    return {
      last24h,
      highSeverity,
      correlationCount,
      categoryCounts,
    };
  }, [events]);

  const topRegions = useMemo(() => {
    const counts = events.reduce<Record<string, number>>((acc, event) => {
      const key = event.region || "Global";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [events]);

  const maxRegionCount = Math.max(...topRegions.map((item) => item.count), 1);
  const tickerItems = quotes.filter((quote) => quote.price > 0);

  const filterSummary = useMemo(() => {
    const summaryParts: string[] = [];
    const timeLabel = TIME_WINDOWS.find((item) => item.key === selectedTimeWindow)?.label;
    const directionLabel = MARKET_DIRECTION_OPTIONS.find((item) => item.key === selectedMarketDirection)?.label;
    const sortLabel = SORT_OPTIONS.find((item) => item.key === selectedSort)?.label;

    if (activeCategory === "for-you") summaryParts.push("Feed: For You");
    if (activeCategory !== "all" && activeCategory !== "for-you") {
      summaryParts.push(`Category: ${CATEGORY_RULES.find((item) => item.key === activeCategory)?.label || activeCategory}`);
    }
    if (selectedTimeWindow !== "all" && timeLabel) summaryParts.push(`Published: ${timeLabel}`);
    if (selectedRegion !== "all") summaryParts.push(`Region: ${selectedRegion}`);
    if (selectedSeverity !== "all") summaryParts.push(`Severity: ${selectedSeverity}+`);
    if (selectedMarketDirection !== "all" && directionLabel) summaryParts.push(`Reaction: ${directionLabel}`);
    if (searchQuery.trim()) summaryParts.push(`Search: "${searchQuery.trim()}"`);
    if (selectedSort !== "relevance" && sortLabel) summaryParts.push(`Sort: ${sortLabel}`);

    return summaryParts;
  }, [activeCategory, searchQuery, selectedMarketDirection, selectedRegion, selectedSeverity, selectedSort, selectedTimeWindow]);

  const emptyState = useMemo(() => {
    if (matchingEventsCount > 0) return undefined;

    if (activeCategory === "for-you" && hasPreferences) {
      return {
        title: "No stories match your current interests right now.",
        hint: "Broaden your topics or regions in Settings, or switch to All Events.",
      };
    }

    return {
      title: "No stories match the current dashboard view.",
      hint: "Reset filters or widen the time window.",
    };
  }, [activeCategory, hasPreferences, matchingEventsCount]);

  const clearDashboardFilters = () => {
    setSearchQuery("");
    setSelectedRegion("all");
    setSelectedSeverity("all");
    setSelectedTimeWindow("24h");
    setSelectedMarketDirection("all");
    setSelectedSort("relevance");
    setActiveCategory(hasPreferences ? "for-you" : "all");
  };

  const applySavedView = (view: {
    query?: string | null;
    regions: string[];
    categories: string[];
    direction: string;
    severityMin: number;
    timeWindow: string;
    sortKey: string;
  }) => {
    setSearchQuery(view.query || "");
    setSelectedRegion(view.regions[0] || "all");
    setActiveCategory(view.categories[0] || "all");
    setSelectedMarketDirection((view.direction as MarketDirectionKey) || "all");
    setSelectedSeverity(view.severityMin > 0 ? String(view.severityMin) : "all");
    setSelectedTimeWindow((view.timeWindow as TimeWindowKey) || "24h");
    setSelectedSort((view.sortKey as SortKey) || "relevance");
  };

  const handleSaveCurrentView = async () => {
    if (!saveViewName.trim()) return;

    setSaveState("saving");
    try {
      const response = await saveFilter({
        name: saveViewName.trim(),
        query: searchQuery.trim() || null,
        regions: selectedRegion !== "all" ? [selectedRegion] : [],
        categories: activeCategory !== "all" ? [activeCategory] : [],
        symbols: [],
        direction: selectedMarketDirection,
        severityMin: selectedSeverity === "all" ? 0 : Number(selectedSeverity),
        timeWindow: selectedTimeWindow,
        sortKey: selectedSort,
        isPinned: false,
      });

      if (response?.error) {
        throw new Error(response.error);
      }

      setSaveViewName("");
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 1600);
    } catch {
      setSaveState("error");
    }
  };

  const hasFilterConstraints = Boolean(searchQuery.trim())
    || selectedRegion !== "all"
    || selectedSeverity !== "all"
    || selectedTimeWindow !== "24h"
    || selectedMarketDirection !== "all"
    || activeCategory !== (hasPreferences ? "for-you" : "all");

  const quoteStatusLabel = getMarketFreshnessLabel(quoteMeta?.freshness);
  const quoteProviderLabel = getMarketProviderLabel(quoteMeta?.provider);

  return (
    <Layout>
      <StockTicker items={tickerItems} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Events (24h)"
          value={(status?.stats?.recentEvents24h ?? summary.last24h.length).toString()}
          trend={`${status?.stats?.totalEvents ?? events.length} total monitored`}
          sparkline={[18, 22, 20, 26, 28, 31, 29]}
        />
        <MetricCard
          label="High Severity"
          value={summary.highSeverity.length.toString()}
          trend="Severity 7+ signals"
          tone="coral"
          sparkline={[3, 4, 6, 5, 7, 8, 7]}
        />
        <MetricCard
          label="Market Links"
          value={summary.correlationCount.toString()}
          trend="Event-asset correlations"
          tone="amber"
          sparkline={[12, 15, 18, 16, 22, 25, 24]}
        />
        <MetricCard
          label="Source Health"
          value={(status?.stats?.degradedSources ?? 0).toString()}
          trend="Feeds needing attention"
          tone="ocean"
          sparkline={[1, 0, 1, 2, 1, 0, 1]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <SectionCard
          title="Risk Radar"
          subtitle={`Understand what happened, why markets care, and what to watch next. ${matchingEventsCount} matching stories.`}
          action={
            <>
              <span className="ghost-chip border border-white/[0.08] bg-white/[0.03]">
                Market data: {quoteStatusLabel}
              </span>
              {hasFilterConstraints && (
                <button onClick={clearDashboardFilters} className="ghost-chip hover:bg-white/[0.06]">
                  Reset filters
                </button>
              )}
              <Link href="/timeline" className="ghost-chip hover:bg-white/[0.06]">
                Timeline
              </Link>
            </>
          }
        >
          <div className="mb-3 flex flex-wrap gap-1.5 border-b border-white/[0.06] pb-3">
            {hasPreferences && (
              <button
                onClick={() => setActiveCategory("for-you")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                  activeCategory === "for-you"
                    ? "border border-emerald/30 bg-emerald/15 text-emerald"
                    : "border border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                }`}
              >
                For You
              </button>
            )}
            <button
              onClick={() => setActiveCategory("all")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                activeCategory === "all"
                  ? "border border-emerald/30 bg-emerald/15 text-emerald"
                  : "border border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              All Events
            </button>
            {CATEGORY_RULES.map(({ key, label }) => {
              const count = summary.categoryCounts[key] ?? 0;
              if (count === 0) return null;

              const isActive = activeCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                    isActive
                      ? "border border-emerald/30 bg-emerald/15 text-emerald"
                      : "border border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  }`}
                >
                  {label}
                  <span className={`text-[10px] ${isActive ? "text-emerald/70" : "text-zinc-600"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 space-y-3 border-b border-white/[0.06] pb-4">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search stories, sources, regions, or symbols..."
                className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald/30 focus:outline-none xl:max-w-sm"
              />

              <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
                <select
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
                  className="rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200"
                >
                  <option value="all">All regions</option>
                  {availableRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMarketDirection}
                  onChange={(event) => setSelectedMarketDirection(event.target.value as MarketDirectionKey)}
                  className="rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200"
                >
                  {MARKET_DIRECTION_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSeverity}
                  onChange={(event) => setSelectedSeverity(event.target.value)}
                  className="rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200"
                >
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSort}
                  onChange={(event) => setSelectedSort(event.target.value as SortKey)}
                  className="rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                Published
              </span>
              {TIME_WINDOWS.map((window) => {
                const isActive = selectedTimeWindow === window.key;
                return (
                  <button
                    key={window.key}
                    onClick={() => setSelectedTimeWindow(window.key)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition border ${
                      isActive
                        ? "border-emerald/30 bg-emerald/15 text-emerald"
                        : "border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                    }`}
                  >
                    {window.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {filterSummary.length > 0 ? (
                  filterSummary.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-zinc-400"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-zinc-600">Default dashboard view.</span>
                )}
              </div>

              <p className="text-[11px] text-zinc-600">
                {matchingEventsCount} matching stories
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 lg:flex-row lg:items-center">
              <input
                value={saveViewName}
                onChange={(event) => setSaveViewName(event.target.value)}
                placeholder="Save this dashboard view as..."
                className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald/30 focus:outline-none"
              />
              <button
                onClick={handleSaveCurrentView}
                disabled={!saveViewName.trim() || saveState === "saving"}
                className="btn-primary whitespace-nowrap disabled:opacity-50"
              >
                {saveState === "saving" ? "Saving..." : "Save view"}
              </button>
              {saveState === "done" && <span className="text-[11px] text-emerald">Saved.</span>}
              {saveState === "error" && <span className="text-[11px] text-red-400">Could not save.</span>}
            </div>
          </div>

          <EventMarketPanel
            events={events.slice(0, 20)}
            quoteMap={quoteMap}
            emptyState={emptyState}
          />
        </SectionCard>

        <div className="space-y-4">
          {hasPreferences && savedFilters.length === 0 && (
            <SectionCard
              title="Start Here"
              subtitle="The quickest path to daily usefulness is brief -> focused view -> repeat."
            >
              <div className="space-y-2 text-[11px] text-zinc-500">
                <Link
                  href="/digest"
                  className="block rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition"
                >
                  <p className="font-semibold text-white">1. Check Morning Brief</p>
                  <p className="mt-1 text-zinc-500">Use the ranked digest first. It is the fastest daily read.</p>
                </Link>
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                  <p className="font-semibold text-white">2. Save one dashboard view</p>
                  <p className="mt-1 text-zinc-500">Create a reusable region, sector, or ticker view so your second visit is faster than the first.</p>
                </div>
                <Link
                  href="/settings"
                  className="block rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition"
                >
                  <p className="font-semibold text-white">3. Keep the 7am briefing on</p>
                  <p className="mt-1 text-zinc-500">That is the habit loop. Reliable delivery matters more than dashboard complexity.</p>
                </Link>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Morning Brief"
            subtitle={`Daily briefing at ${preferences.digestHour}:00 ${preferences.timezone}${preferences.emailDigestEnabled ? " via email" : ""}`}
            action={<Link href="/digest" className="ghost-chip hover:bg-white/[0.06]">Open digest</Link>}
          >
            <div className="space-y-2">
              {events.slice(0, 3).map((event) => (
                <Link
                  href={`/event/${event.id}`}
                  key={event.id}
                  className="block rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition"
                >
                  <p className="text-xs font-semibold text-white">{event.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2">
                    {event.whyThisMatters || event.summary}
                  </p>
                </Link>
              ))}
              {events.length === 0 && (
                <p className="py-4 text-center text-[11px] text-zinc-600">
                  Your morning brief will populate after the next ingestion cycle.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Saved Views"
            subtitle={`Reusable filters for the dashboard, digest, and alerts${entitlements?.limits?.savedViews ? ` | ${savedFilters.length}/${entitlements.limits.savedViews} used` : ""}`}
          >
            {savedFilters.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-zinc-600">
                Save a dashboard view to quickly revisit a region, sector, or risk setup.
              </p>
            ) : (
              <div className="space-y-2">
                {savedFilters.map((view) => (
                  <div
                    key={view.id}
                    className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => applySavedView(view)}
                        className="min-w-0 text-left"
                      >
                        <p className="truncate text-xs font-semibold text-white">{view.name}</p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {[view.categories[0], view.regions[0], view.direction !== "all" ? view.direction : "", view.timeWindow !== "all" ? view.timeWindow : ""]
                            .filter(Boolean)
                            .join(" | ") || "Broad dashboard view"}
                        </p>
                      </button>
                      <button
                        onClick={() => removeFilter(view.id)}
                        className="text-[10px] text-zinc-600 hover:text-zinc-300 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Top Movers"
            subtitle={`Highest absolute % change | ${quoteProviderLabel}`}
          >
            <TopMoversCard quotes={quotes} />
          </SectionCard>

          <SectionCard
            title="Pattern Insights"
            subtitle="Predictions from historical correlations"
          >
            <PatternInsightsCard />
          </SectionCard>

          <SectionCard
            title="Regional Hotspots"
            subtitle="Click a region to narrow the dashboard feed"
            action={
              selectedRegion !== "all" ? (
                <button
                  onClick={() => setSelectedRegion("all")}
                  className="ghost-chip hover:bg-white/[0.06]"
                >
                  All regions
                </button>
              ) : undefined
            }
          >
            {topRegions.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-zinc-600">
                No regions match the current dashboard filters.
              </p>
            ) : (
              <div className="space-y-1.5">
                {topRegions.map((item) => {
                  const isActive = selectedRegion === item.region;
                  return (
                    <button
                      key={item.region}
                      onClick={() => setSelectedRegion((prev) => (prev === item.region ? "all" : item.region))}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-emerald/30 bg-emerald/10"
                          : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isActive ? "text-emerald" : "text-zinc-200"}`}>
                          {item.region}
                        </span>
                        <span className={`text-xs font-bold ${isActive ? "text-emerald" : "text-amber-400"}`}>
                          {item.count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-white/[0.05]">
                        <div
                          className={`h-1 rounded-full ${isActive ? "bg-emerald" : "bg-gradient-to-r from-emerald to-cyan"}`}
                          style={{ width: `${Math.min(100, (item.count / maxRegionCount) * 100)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Account Access"
            subtitle={entitlements?.premiumActive ? "Premium is active." : "Free accounts get the full core workflow. Premium increases limits and briefing depth."}
          >
            <div className="space-y-2 text-[11px] text-zinc-500">
              <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                <span>Plan</span>
                <span className="font-semibold text-white">
                  {entitlements?.premiumActive ? "Premium" : entitlements?.betaUnlocked ? "Free Beta" : "Free"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                <span>Saved views</span>
                <span className="font-semibold text-white">
                  {entitlements?.limits?.savedViews === null ? "Unlimited" : `${savedFilters.length}/${entitlements?.limits?.savedViews ?? 3}`}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                <span>Alert capacity</span>
                <span className="font-semibold text-white">
                  {entitlements?.limits?.alerts === null ? "Unlimited" : `${entitlements?.limits?.alerts ?? 3} active`}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                <span>Founding beta</span>
                <span className="font-semibold text-white">
                  {entitlements?.betaSpotsRemaining && entitlements.betaSpotsRemaining > 0
                    ? `${entitlements.betaSpotsRemaining} spots left`
                    : "Closed"}
                </span>
              </div>
              <p className="pt-1 text-[11px] text-zinc-600">
                The anonymous homepage shows a live preview. Free accounts unlock the full dashboard. Premium is priced at $8/month or $79/year when billing is enabled.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>

      {(isLoading || prefsLoading) && (
        <p className="text-center text-xs text-zinc-500 animate-pulse">
          Loading intelligence data...
        </p>
      )}
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
