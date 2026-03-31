import Link from "next/link";
import { useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import SectionCard from "../components/ui/SectionCard";
import SeverityBadge from "../components/ui/SeverityBadge";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import { useEvents } from "../lib/hooks/useEvents";
import { useQuotes, type Quote } from "../lib/hooks/useQuotes";
import { relativeTime, formatPct, formatCurrency } from "../lib/format";
import { resolveCorrelationMove } from "../lib/marketDisplay";
import { requireAuth } from "../lib/serverAuth";

const EVENT_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "conflict", label: "Conflict" },
  { key: "energy", label: "Energy" },
  { key: "economic", label: "Economic" },
  { key: "sanctions", label: "Sanctions" },
  { key: "political", label: "Political" },
  { key: "technology", label: "Technology" },
  { key: "healthcare", label: "Healthcare" },
  { key: "climate", label: "Climate" },
  { key: "agriculture", label: "Agriculture" },
  { key: "trade", label: "Trade" },
  { key: "threat", label: "Threats" },
];

function categorizeEvent(title: string, summary: string): string {
  const text = `${title} ${summary}`.toLowerCase();
  const rules: Array<{ cat: string; words: string[] }> = [
    { cat: "conflict", words: ["attack", "missile", "strike", "war", "invasion", "bombing", "airstrike", "troops", "military", "combat", "casualties", "killed", "shelling", "offensive", "drone", "navy", "warship", "defense"] },
    { cat: "energy", words: ["oil", "opec", "pipeline", "natural gas", "energy", "crude", "refinery", "lng", "petroleum", "fuel", "barrel"] },
    { cat: "economic", words: ["recession", "inflation", "default", "debt", "bailout", "collapse", "bankruptcy", "crash", "downturn", "unemployment", "rate", "fed", "interest", "central bank", "gdp", "stimulus"] },
    { cat: "sanctions", words: ["sanction", "embargo", "tariff", "ban", "restriction", "blacklist", "trade war", "export control"] },
    { cat: "political", words: ["election", "protest", "revolution", "unrest", "overthrow", "impeach", "resign", "riot", "vote", "parliament", "congress"] },
    { cat: "technology", words: ["semiconductor", "chip", "ai", "artificial intelligence", "tech", "cyber", "5g", "quantum", "software", "satellite", "space", "robot", "blockchain", "crypto"] },
    { cat: "healthcare", words: ["pandemic", "virus", "vaccine", "outbreak", "epidemic", "disease", "drug", "pharmaceutical", "hospital", "health", "fda", "medical"] },
    { cat: "climate", words: ["climate", "carbon", "emissions", "earthquake", "tsunami", "hurricane", "flood", "wildfire", "drought", "renewable", "solar", "environmental"] },
    { cat: "agriculture", words: ["wheat", "grain", "crop", "famine", "food crisis", "agriculture", "corn", "soybean", "fertilizer"] },
    { cat: "trade", words: ["shipping", "freight", "maritime", "supply chain", "logistics", "port", "trade deal", "import", "export", "wto"] },
    { cat: "threat", words: ["nuclear", "threat", "crisis", "emergency", "escalation", "warning", "terror", "hostage", "assassination", "coup"] },
  ];
  let bestCat = "general";
  let bestScore = 0;
  for (const { cat, words } of rules) {
    const score = words.filter((w) => text.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestCat = cat; }
  }
  return bestCat;
}

export default function Timeline() {
  const { events, isLoading } = useEvents();
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [query, setQuery] = useState("");

  const allSymbols = useMemo(() => {
    const s = new Set<string>();
    events.forEach((e) => e.correlations?.forEach((c) => s.add(c.symbol)));
    return Array.from(s);
  }, [events]);

  const { quotes } = useQuotes(allSymbols);
  const quoteMap = useMemo(() => {
    const m = new Map<string, Quote>();
    quotes.forEach((q) => m.set(q.symbol, q));
    return m;
  }, [quotes]);

  const availableRegions = useMemo(() => {
    const regions = new Set<string>();
    events.forEach((e) => { if (e.region) regions.add(e.region); });
    return Array.from(regions).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (selectedRegion !== "all" && event.region !== selectedRegion) return false;
      if (selectedSeverity !== "all" && (event.severity ?? 0) < Number(selectedSeverity)) return false;
      if (selectedCategory !== "all") {
        const cat = categorizeEvent(event.title, event.summary);
        if (cat !== selectedCategory) return false;
      }
      if (query) {
        const lowered = query.toLowerCase();
        if (!event.title.toLowerCase().includes(lowered) && !event.summary.toLowerCase().includes(lowered)) return false;
      }
      return true;
    });
  }, [events, selectedRegion, selectedSeverity, selectedCategory, query]);

  return (
    <Layout>
      <SectionCard
        title="Event Timeline"
        subtitle={`${filtered.length} events | Geopolitical signals with market impact evidence`}
      >
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 border-b border-white/[0.06] pb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald/30 focus:outline-none sm:max-w-xs"
          />

          {/* Category pills */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {EVENT_CATEGORIES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition border ${
                  selectedCategory === key
                    ? "bg-emerald/15 text-emerald border-emerald/30"
                    : "text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:bg-white/[0.04]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:ml-auto lg:w-auto">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200"
            >
              <option value="all">All Regions</option>
              {availableRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-xs text-zinc-200"
            >
              <option value="all">All Severity</option>
              <option value="3">3+</option>
              <option value="5">5+</option>
              <option value="7">7+ (High)</option>
              <option value="9">9+ (Critical)</option>
            </select>
          </div>
        </div>

        {/* Events list */}
        <div className="space-y-2">
          {filtered.map((item) => {
            const correlations = item.correlations ?? [];
            const cat = categorizeEvent(item.title, item.summary);
            return (
              <div
                key={item.id}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] transition hover:bg-white/[0.04]"
              >
                <div className="flex flex-col lg:flex-row">
                  {/* Event side */}
                  <div className="flex-1 p-4 border-b lg:border-b-0 lg:border-r border-white/[0.04]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                          <span className="uppercase tracking-wider">{item.source}</span>
                          <span className="text-white/10">|</span>
                          <span>{item.region}</span>
                          <span className="text-white/10">|</span>
                          <span>{relativeTime(item.publishedAt)}</span>
                          <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 uppercase">
                            {cat}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-sm font-semibold text-white leading-snug">
                          <Link href={`/event/${item.id}`} className="!text-white hover:!text-emerald transition-colors">
                            {item.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{item.summary}</p>
                      </div>
                      <SeverityBadge severity={item.severity ?? 1} />
                    </div>
                  </div>

                  {/* Market reaction side */}
                  <div className="lg:w-72 p-4 shrink-0">
                    {correlations.length > 0 ? (
                      <div>
                        <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-600">
                          Market Reactions
                        </p>
                        <div className="space-y-1.5">
                          {correlations.slice(0, 4).map((corr) => {
                            const quote = quoteMap.get(corr.symbol);
                            const change = resolveCorrelationMove({
                              liveChange: quote?.changePct,
                              impactDirection: corr.impactDirection,
                              impactMagnitude: corr.impactMagnitude,
                            });
                            const isUp = change >= 0;
                            return (
                              <SymbolHoverCard key={corr.id} symbol={corr.symbol}>
                                <Link href={`/stock/${corr.symbol}`} className="flex items-center justify-between text-xs hover:bg-white/[0.04] rounded px-1 -mx-1 py-0.5 transition">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`h-1.5 w-1.5 rounded-full ${isUp ? "bg-emerald" : "bg-red-400"}`} />
                                    <span className="font-bold text-zinc-200">{corr.symbol}</span>
                                    {quote && (
                                      <span className="text-zinc-600">
                                        {formatCurrency(quote.price, quote.currency || "USD")}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-bold ${isUp ? "text-emerald" : "text-red-400"}`}>
                                    {isUp ? "\u25B2" : "\u25BC"} {formatPct(change)}
                                  </span>
                                </Link>
                              </SymbolHoverCard>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-600">No market correlations</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500">
                {events.length === 0
                  ? "No events available. Click Sync Now to populate."
                  : "No events match your filters. Try broadening your search."}
              </p>
            </div>
          )}
        </div>
        {isLoading && (
          <p className="mt-4 text-center text-xs text-zinc-500 animate-pulse">Loading events...</p>
        )}
      </SectionCard>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
