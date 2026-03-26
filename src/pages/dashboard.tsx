import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import MetricCard from "../components/ui/MetricCard";
import SectionCard from "../components/ui/SectionCard";
import StockTicker from "../components/ui/StockTicker";
import EventMarketPanel from "../components/dashboard/EventMarketPanel";
import PatternInsightsCard from "../components/dashboard/PatternInsightsCard";
import TopMoversCard from "../components/dashboard/TopMoversCard";
import { getAssetMeta } from "../lib/assets";
import { useEvents, type EventItem } from "../lib/hooks/useEvents";
import { useWatchlists } from "../lib/hooks/useWatchlists";
import { useQuotes, type Quote } from "../lib/hooks/useQuotes";
import { useStatus } from "../lib/hooks/useStatus";
import { usePreferences } from "../lib/hooks/usePreferences";
import { requireAuth } from "../lib/requireAuth";

const DEFAULT_WATCHLIST_SYMBOLS = ["SPY", "QQQ", "GLD", "XLE", "TLT", "ITA", "USO", "NVDA"];

const CATEGORIES = [
  { key: "all", label: "All Events" },
  { key: "conflict", label: "Conflict & War" },
  { key: "energy", label: "Energy & Oil" },
  { key: "economic", label: "Economy" },
  { key: "sanctions", label: "Sanctions & Tariffs" },
  { key: "political", label: "Politics" },
  { key: "technology", label: "Technology" },
  { key: "defense", label: "Defense" },
  { key: "cyber", label: "Cybersecurity" },
  { key: "healthcare", label: "Healthcare" },
  { key: "climate", label: "Climate" },
  { key: "agriculture", label: "Agriculture" },
  { key: "trade", label: "Trade & Shipping" },
  { key: "threat", label: "Nuclear & Threats" },
  { key: "science", label: "Science" },
  { key: "general", label: "General" },
];

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
  { key: "move", label: "Largest move" },
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

function categorizeEvent(title: string, summary: string): string {
  const text = `${title} ${summary}`.toLowerCase();

  const rules: Array<{ cat: string; words: string[] }> = [
    { cat: "conflict", words: ["attack", "missile", "strike", "war", "invasion", "bombing", "airstrike", "troops", "combat", "casualties", "killed", "shelling", "offensive", "ceasefire", "hostilities", "clashes", "battlefield"] },
    { cat: "defense", words: ["defense", "military", "army", "navy", "warship", "fighter jet", "arms deal", "weapon", "pentagon", "nato", "drone strike", "air force", "marines", "special forces"] },
    { cat: "energy", words: ["oil", "opec", "pipeline", "natural gas", "energy", "crude", "refinery", "lng", "petroleum", "fuel", "barrel", "drilling", "offshore"] },
    { cat: "economic", words: ["recession", "inflation", "default", "debt", "bailout", "collapse", "bankruptcy", "crash", "downturn", "unemployment", "interest rate", "central bank", "gdp", "stimulus", "quantitative", "federal reserve", "monetary policy", "bond", "treasury", "stock market"] },
    { cat: "sanctions", words: ["sanction", "embargo", "tariff", "blacklist", "trade war", "export control", "import duty", "trade ban", "asset freeze", "economic penalty"] },
    { cat: "political", words: ["election", "protest", "revolution", "unrest", "overthrow", "impeach", "resign", "riot", "vote", "parliament", "congress", "president", "prime minister", "democracy", "authoritarian", "coup", "referendum"] },
    { cat: "technology", words: ["semiconductor", "chip", "artificial intelligence", "tech", "5g", "quantum", "software", "satellite", "space", "robot", "blockchain", "crypto", "machine learning", "startup", "silicon valley", "data center"] },
    { cat: "cyber", words: ["cybersecurity", "cyber attack", "hack", "ransomware", "data breach", "malware", "phishing", "encryption", "zero-day", "cyber warfare"] },
    { cat: "healthcare", words: ["pandemic", "virus", "vaccine", "outbreak", "epidemic", "disease", "drug", "pharmaceutical", "hospital", "health", "fda", "medical", "who", "public health", "clinical trial"] },
    { cat: "climate", words: ["climate", "carbon", "emissions", "earthquake", "tsunami", "hurricane", "flood", "wildfire", "drought", "renewable", "solar", "environmental", "global warming", "sea level", "deforestation"] },
    { cat: "agriculture", words: ["wheat", "grain", "crop", "famine", "food crisis", "agriculture", "corn", "soybean", "fertilizer", "harvest", "livestock", "farming"] },
    { cat: "trade", words: ["shipping", "freight", "maritime", "supply chain", "logistics", "port", "trade deal", "import", "export", "wto", "container", "cargo", "customs"] },
    { cat: "threat", words: ["nuclear", "atomic", "warhead", "escalation", "terror", "hostage", "assassination", "bioweapon", "chemical weapon", "missile test", "threat level"] },
    { cat: "science", words: ["research", "discovery", "scientific", "physics", "biology", "astronomy", "genome", "crispr", "nasa", "experiment", "breakthrough", "university study", "laboratory"] },
  ];

  let bestCat = "general";
  let bestScore = 0;
  for (const { cat, words } of rules) {
    const score = words.filter((word) => text.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }
  return bestCat;
}

function matchesTimeWindow(publishedAt: string, windowKey: TimeWindowKey) {
  if (windowKey === "all") return true;

  const hoursByWindow: Record<Exclude<TimeWindowKey, "all">, number> = {
    "6h": 6,
    "24h": 24,
    "3d": 72,
    "7d": 168,
  };

  const published = new Date(publishedAt).getTime();
  return Date.now() - published <= hoursByWindow[windowKey] * 60 * 60 * 1000;
}

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
    if (corr.impactDirection === "mixed") {
      hasUp = true;
      hasDown = true;
    }
    if (corr.impactDirection !== "up" && corr.impactDirection !== "down" && corr.impactDirection !== "mixed") {
      if (corr.impactMagnitude > 0) hasUp = true;
      if (corr.impactMagnitude < 0) hasDown = true;
    }
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

function matchesSearch(event: EventItem, searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;

  const correlationText = (event.correlations ?? [])
    .map((corr) => {
      const meta = getAssetMeta(corr.symbol);
      return `${corr.symbol} ${meta.name} ${meta.focus}`;
    })
    .join(" ");

  const haystack = [
    event.title,
    event.summary,
    event.source,
    event.region,
    event.countryCode ?? "",
    correlationText,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default function Dashboard() {
  const { events, isLoading } = useEvents();
  const { watchlists } = useWatchlists();
  const { status } = useStatus();
  const { preferences, isLoading: prefsLoading } = usePreferences();

  const [activeCategory, setActiveCategory] = useState("for-you");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<TimeWindowKey>("all");
  const [selectedMarketDirection, setSelectedMarketDirection] = useState<MarketDirectionKey>("all");
  const [selectedSort, setSelectedSort] = useState<SortKey>("relevance");

  useEffect(() => {
    if (!prefsLoading && !preferences.onboarded && preferences.categories.length === 0) {
      setActiveCategory("all");
    }
  }, [prefsLoading, preferences]);

  const hasPreferences = preferences.categories.length > 0;

  const allSymbols = useMemo(() => {
    const symbols = new Set<string>(DEFAULT_WATCHLIST_SYMBOLS);

    if (watchlists[0]?.items) {
      watchlists[0].items.forEach((item) => symbols.add(item.symbol));
    }

    events.forEach((event) => {
      event.correlations?.forEach((corr) => symbols.add(corr.symbol));
    });

    return Array.from(symbols);
  }, [events, watchlists]);

  const { quotes } = useQuotes(allSymbols);

  const quoteMap = useMemo(() => {
    const map = new Map<string, Quote>();
    quotes.forEach((quote) => map.set(quote.symbol, quote));
    return map;
  }, [quotes]);

  const { categorized, summary } = useMemo(() => {
    const catMap = new Map<string, typeof events>();
    const now = Date.now();

    for (const event of events) {
      const category = categorizeEvent(event.title, event.summary);
      if (!catMap.has(category)) catMap.set(category, []);
      catMap.get(category)!.push(event);
    }

    const last24h = events.filter(
      (event) => now - new Date(event.publishedAt).getTime() < 24 * 60 * 60 * 1000
    );
    const highSeverity = events.filter((event) => (event.severity ?? 0) >= 7);
    const correlationCount = events.reduce(
      (total, event) => total + (event.correlations?.length ?? 0),
      0
    );

    const categoryCounts: Record<string, number> = {};
    for (const [category, categoryEvents] of catMap) {
      categoryCounts[category] = categoryEvents.length;
    }

    return {
      categorized: catMap,
      summary: { last24h, highSeverity, correlationCount, categoryCounts },
    };
  }, [events]);

  const availableRegions = useMemo(() => {
    return Array.from(
      new Set(events.map((event) => event.region).filter(Boolean))
    ).sort();
  }, [events]);

  const categoryScopedEvents = useMemo(() => {
    if (activeCategory === "for-you" && hasPreferences) {
      const preferredCategories = new Set(preferences.categories);
      const preferredRegions = new Set(preferences.regions);

      return events.filter((event) => {
        const category = categorizeEvent(event.title, event.summary);
        if (preferredCategories.has(category)) return true;
        if (preferredRegions.has(event.region)) return true;
        if (
          preferences.symbols.length > 0 &&
          event.correlations?.some((corr) => preferences.symbols.includes(corr.symbol))
        ) {
          return true;
        }
        return false;
      });
    }

    if (activeCategory === "all" || activeCategory === "for-you") {
      return events;
    }

    return categorized.get(activeCategory) ?? [];
  }, [activeCategory, categorized, events, hasPreferences, preferences]);

  const constraintFilteredEvents = useMemo(() => {
    return categoryScopedEvents.filter((event) => {
      if (!matchesTimeWindow(event.publishedAt, selectedTimeWindow)) return false;
      if (selectedSeverity !== "all" && (event.severity ?? 0) < Number(selectedSeverity)) return false;
      if (selectedMarketDirection !== "all") {
        const marketDirection = getEventMarketDirection(event, quoteMap);
        if (marketDirection !== selectedMarketDirection) return false;
      }
      if (!matchesSearch(event, searchQuery)) return false;
      return true;
    });
  }, [categoryScopedEvents, quoteMap, searchQuery, selectedMarketDirection, selectedSeverity, selectedTimeWindow]);

  const regionFilteredEvents = useMemo(() => {
    if (selectedRegion === "all") return constraintFilteredEvents;
    return constraintFilteredEvents.filter((event) => event.region === selectedRegion);
  }, [constraintFilteredEvents, selectedRegion]);

  const sortedFilteredEvents = useMemo(() => {
    return [...regionFilteredEvents].sort((a, b) => {
      if (selectedSort === "newest") {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }

      if (selectedSort === "severity") {
        const severityDiff = (b.severity ?? 0) - (a.severity ?? 0);
        if (severityDiff !== 0) return severityDiff;
        return (b.correlations?.length ?? 0) - (a.correlations?.length ?? 0);
      }

      if (selectedSort === "move") {
        const moveDiff = getEventStrongestMove(b, quoteMap) - getEventStrongestMove(a, quoteMap);
        if (moveDiff !== 0) return moveDiff;
        return (b.severity ?? 0) - (a.severity ?? 0);
      }

      const correlationDiff = (b.correlations?.length ?? 0) - (a.correlations?.length ?? 0);
      if (correlationDiff !== 0) return correlationDiff;

      const severityDiff = (b.severity ?? 0) - (a.severity ?? 0);
      if (severityDiff !== 0) return severityDiff;

      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [quoteMap, regionFilteredEvents, selectedSort]);

  const filteredEvents = useMemo(() => sortedFilteredEvents.slice(0, 20), [sortedFilteredEvents]);
  const matchingEventsCount = regionFilteredEvents.length;

  const topRegions = useMemo(() => {
    const counts = constraintFilteredEvents.reduce<Record<string, number>>((acc, event) => {
      const key = event.region || "Global";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [constraintFilteredEvents]);

  const maxRegionCount = Math.max(...topRegions.map((item) => item.count), 1);
  const tickerItems = quotes.filter((quote) => quote.price > 0);

  const hasFilterConstraints = Boolean(searchQuery.trim())
    || selectedRegion !== "all"
    || selectedSeverity !== "all"
    || selectedTimeWindow !== "all"
    || selectedMarketDirection !== "all";
  const hasAdvancedControlsActive = hasFilterConstraints || selectedSort !== "relevance";

  const filterSummary = useMemo(() => {
    const summaryParts = [];
    const timeLabel = TIME_WINDOWS.find((item) => item.key === selectedTimeWindow)?.label;
    const directionLabel = MARKET_DIRECTION_OPTIONS.find((item) => item.key === selectedMarketDirection)?.label;
    const sortLabel = SORT_OPTIONS.find((item) => item.key === selectedSort)?.label;

    if (selectedTimeWindow !== "all" && timeLabel) summaryParts.push(`Published: ${timeLabel}`);
    if (selectedRegion !== "all") summaryParts.push(`Region: ${selectedRegion}`);
    if (selectedSeverity !== "all") summaryParts.push(`Severity: ${selectedSeverity}+`);
    if (selectedMarketDirection !== "all" && directionLabel) summaryParts.push(`Reaction: ${directionLabel}`);
    if (searchQuery.trim()) summaryParts.push(`Search: "${searchQuery.trim()}"`);
    if (selectedSort !== "relevance" && sortLabel) summaryParts.push(`Sort: ${sortLabel}`);

    return summaryParts;
  }, [searchQuery, selectedMarketDirection, selectedRegion, selectedSeverity, selectedSort, selectedTimeWindow]);

  const emptyState = useMemo(() => {
    if (matchingEventsCount > 0) return undefined;

    if (activeCategory === "for-you" && hasPreferences && !hasFilterConstraints) {
      return {
        title: "No events match your personalized feed right now.",
        hint: "Try All Events or broaden your interests in Settings.",
      };
    }

    if (hasFilterConstraints) {
      return {
        title: "No events match these dashboard filters.",
        hint: "Try widening the time window, removing a region filter, or relaxing the market direction.",
      };
    }

    if (activeCategory !== "all") {
      return {
        title: "No events are available in this category right now.",
        hint: "Switch to another category or return to All Events.",
      };
    }

    return undefined;
  }, [activeCategory, hasFilterConstraints, hasPreferences, matchingEventsCount]);

  const clearDashboardFilters = () => {
    setSearchQuery("");
    setSelectedRegion("all");
    setSelectedSeverity("all");
    setSelectedTimeWindow("all");
    setSelectedMarketDirection("all");
    setSelectedSort("relevance");
  };

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
          label="Patterns"
          value={(status?.stats?.totalPatterns ?? 0).toString()}
          trend="Learned from history"
          tone="ocean"
          sparkline={[2, 4, 5, 8, 10, 12, 15]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <SectionCard
          title="Events & Market Impact"
          subtitle={`News events with correlated stock movements · ${matchingEventsCount} matching`}
          action={
            <>
              {hasAdvancedControlsActive && (
                <button
                  onClick={clearDashboardFilters}
                  className="ghost-chip hover:bg-white/[0.06]"
                >
                  Reset filters
                </button>
              )}
              <Link href="/timeline" className="ghost-chip hover:bg-white/[0.06]">
                View all
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
            {CATEGORIES.map(({ key, label }) => {
              const count = key === "all" ? events.length : (summary.categoryCounts[key] ?? 0);
              if (key !== "all" && count === 0) return null;

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
                  <span className={`text-[10px] ${isActive ? "text-emerald/70" : "text-zinc-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 space-y-3 border-b border-white/[0.06] pb-4">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search headlines, sources, regions, or symbols..."
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
                  <span className="text-[11px] text-zinc-600">
                    No extra filters applied.
                  </span>
                )}
              </div>

              <p className="text-[11px] text-zinc-600">
                {matchingEventsCount > filteredEvents.length
                  ? `${matchingEventsCount} matches · showing top ${filteredEvents.length}`
                  : `${matchingEventsCount} matches`}
              </p>
            </div>
          </div>

          <EventMarketPanel
            events={filteredEvents}
            quoteMap={quoteMap}
            emptyState={emptyState}
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Top Movers" subtitle="Highest absolute % change">
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
        </div>
      </div>

      {isLoading && (
        <p className="text-center text-xs text-zinc-500 animate-pulse">
          Loading intelligence data...
        </p>
      )}
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
