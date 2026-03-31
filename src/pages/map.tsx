import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import Layout from "../components/layout/Layout";
import SeverityBadge from "../components/ui/SeverityBadge";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import { useEvents, type EventItem } from "../lib/hooks/useEvents";
import { relativeTime } from "../lib/format";
import { requireAuth } from "../lib/serverAuth";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/* ── Country lat/lng coordinates ── */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  US: [-98, 38],
  CA: [-106, 56],
  MX: [-102, 23],
  UK: [-2, 54],
  DE: [10, 51],
  FR: [2, 47],
  IT: [12, 42],
  ES: [-4, 40],
  UA: [32, 49],
  RU: [55, 58],
  PL: [20, 52],
  TR: [35, 39],
  NL: [5, 52],
  SE: [16, 62],
  CH: [8, 47],
  IL: [35, 31],
  PS: [35, 32],
  IR: [53, 33],
  IQ: [44, 33],
  SY: [38, 35],
  SA: [45, 24],
  YE: [48, 15],
  LB: [36, 34],
  AE: [54, 24],
  CN: [105, 35],
  JP: [138, 36],
  IN: [79, 22],
  KR: [128, 36],
  KP: [127, 40],
  TW: [121, 24],
  AU: [134, -25],
  ID: [118, -3],
  PH: [122, 13],
  VN: [108, 16],
  TH: [101, 15],
  SG: [104, 1],
  PK: [70, 30],
  AF: [67, 33],
  NG: [8, 10],
  ZA: [25, -29],
  EG: [30, 27],
  KE: [38, 0],
  ET: [40, 9],
  SD: [30, 15],
  LY: [17, 27],
  MA: [-8, 32],
  BR: [-51, -14],
  AR: [-64, -34],
  VE: [-66, 8],
  CO: [-74, 4],
  // Fallback regions
  EU: [10, 50],
  ME: [45, 28],
  APAC: [115, 25],
  GLOBAL: [0, -40],
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", MX: "Mexico",
  UK: "United Kingdom", DE: "Germany", FR: "France", IT: "Italy", ES: "Spain",
  UA: "Ukraine", RU: "Russia", PL: "Poland", TR: "Turkey", NL: "Netherlands",
  SE: "Sweden", CH: "Switzerland",
  IL: "Israel", PS: "Palestine", IR: "Iran", IQ: "Iraq", SY: "Syria",
  SA: "Saudi Arabia", YE: "Yemen", LB: "Lebanon", AE: "UAE",
  CN: "China", JP: "Japan", IN: "India", KR: "South Korea", KP: "North Korea",
  TW: "Taiwan", AU: "Australia", ID: "Indonesia", PH: "Philippines",
  VN: "Vietnam", TH: "Thailand", SG: "Singapore", PK: "Pakistan", AF: "Afghanistan",
  NG: "Nigeria", ZA: "South Africa", EG: "Egypt", KE: "Kenya", ET: "Ethiopia",
  SD: "Sudan", LY: "Libya", MA: "Morocco",
  BR: "Brazil", AR: "Argentina", VE: "Venezuela", CO: "Colombia",
  EU: "Europe", ME: "Middle East", APAC: "Asia-Pacific", GLOBAL: "Global",
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽", UK: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸",
  UA: "🇺🇦", RU: "🇷🇺", PL: "🇵🇱", TR: "🇹🇷", NL: "🇳🇱", SE: "🇸🇪", CH: "🇨🇭",
  IL: "🇮🇱", PS: "🇵🇸", IR: "🇮🇷", IQ: "🇮🇶", SY: "🇸🇾", SA: "🇸🇦", YE: "🇾🇪", LB: "🇱🇧", AE: "🇦🇪",
  CN: "🇨🇳", JP: "🇯🇵", IN: "🇮🇳", KR: "🇰🇷", KP: "🇰🇵", TW: "🇹🇼", AU: "🇦🇺", ID: "🇮🇩",
  PH: "🇵🇭", VN: "🇻🇳", TH: "🇹🇭", SG: "🇸🇬", PK: "🇵🇰", AF: "🇦🇫",
  NG: "🇳🇬", ZA: "🇿🇦", EG: "🇪🇬", KE: "🇰🇪", ET: "🇪🇹", SD: "🇸🇩", LY: "🇱🇾", MA: "🇲🇦",
  BR: "🇧🇷", AR: "🇦🇷", VE: "🇻🇪", CO: "🇨🇴",
  EU: "🇪🇺", ME: "🌍", APAC: "🌏", GLOBAL: "🌐",
};

type CountryGroup = {
  code: string;
  name: string;
  region: string;
  count: number;
  totalSeverity: number;
  avgSeverity: number;
  events: EventItem[];
};

function getSeverityLevel(avg: number) {
  if (avg >= 8) return { color: "#ef4444", bg: "rgba(239,68,68,0.3)", border: "#ef4444", pulse: "#ef444460" };
  if (avg >= 6) return { color: "#f97316", bg: "rgba(249,115,22,0.25)", border: "#f97316", pulse: "#f9731650" };
  if (avg >= 4) return { color: "#eab308", bg: "rgba(234,179,8,0.2)", border: "#eab308", pulse: "#eab30840" };
  return { color: "#10b981", bg: "rgba(16,185,129,0.18)", border: "#10b981", pulse: "#10b98140" };
}

export default function MapView() {
  const { events } = useEvents();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Group events by country code
  const countries = useMemo(() => {
    const map = new Map<string, CountryGroup>();
    for (const e of events) {
      const code = e.countryCode || "GLOBAL";
      if (!map.has(code)) {
        map.set(code, {
          code,
          name: COUNTRY_NAMES[code] || code,
          region: e.region || "Global",
          count: 0,
          totalSeverity: 0,
          avgSeverity: 0,
          events: [],
        });
      }
      const g = map.get(code)!;
      g.count++;
      g.totalSeverity += e.severity ?? 0;
      g.avgSeverity = g.totalSeverity / g.count;
      g.events.push(e);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [events]);

  const selectedData = useMemo(() => {
    if (!selectedCountry) return null;
    return countries.find((c) => c.code === selectedCountry) || null;
  }, [selectedCountry, countries]);

  const handleMarkerClick = useCallback((code: string) => {
    setSelectedCountry((prev) => (prev === code ? null : code));
  }, []);

  return (
    <Layout>
      <div className="flex flex-col gap-4 xl:flex-row">
        {/* Main map area */}
        <div className={`flex-1 min-w-0 transition-all duration-300 ${selectedData ? "lg:mr-0" : ""}`}>
          <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Global Threat Map</h2>
                <p className="text-[11px] text-zinc-500">Click any country to view its news events and market impact</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-black/40 px-3 py-1.5">
                  {[
                    { label: "Low", color: "#10b981" },
                    { label: "Med", color: "#eab308" },
                    { label: "High", color: "#f97316" },
                    { label: "Crit", color: "#ef4444" },
                  ].map((item) => (
                    <span key={item.label} className="flex items-center gap-1 text-[9px] text-zinc-500">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-zinc-600">
                  {events.length} events · {countries.length} locations
                </span>
              </div>
            </div>

            {/* Map */}
            <div className="relative aspect-[1.15/1] w-full overflow-hidden rounded-lg border border-white/[0.04] bg-[#08080c] sm:aspect-[1.5/1] lg:aspect-[1.8/1] xl:aspect-[2.2/1]">
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ scale: 145, center: [20, 20] }}
                style={{ width: "100%", height: "100%" }}
              >
                <ZoomableGroup>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="#14141e"
                          stroke="#222233"
                          strokeWidth={0.3}
                          style={{
                            default: { outline: "none" },
                            hover: { fill: "#1e1e30", outline: "none" },
                            pressed: { outline: "none" },
                          }}
                        />
                      ))
                    }
                  </Geographies>

                  {/* Country markers */}
                  {countries.map((c) => {
                    const coords = COUNTRY_COORDS[c.code];
                    if (!coords) return null;
                    const severity = getSeverityLevel(c.avgSeverity);
                    const isSelected = selectedCountry === c.code;
                    const size = Math.max(6, Math.min(22, c.count * 0.8 + 5));

                    return (
                      <Marker
                        key={c.code}
                        coordinates={coords}
                        onClick={() => handleMarkerClick(c.code)}
                        onMouseEnter={(e) => {
                          setHoveredCountry(c.code);
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setHoveredCountry(null)}
                      >
                        {/* Pulse for high severity */}
                        {c.avgSeverity >= 5 && (
                          <circle r={size * 2.2} fill="none" stroke={severity.pulse} strokeWidth={0.4}>
                            <animate
                              attributeName="r"
                              values={`${size * 1.5};${size * 2.5};${size * 1.5}`}
                              dur="3s"
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              values="0.5;0.05;0.5"
                              dur="3s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        )}
                        {/* Glow */}
                        <circle r={size * 1.4} fill={severity.bg} opacity={0.5} />
                        {/* Main circle */}
                        <circle
                          r={size}
                          fill={severity.bg}
                          stroke={isSelected ? "#fff" : severity.border}
                          strokeWidth={isSelected ? 2 : 1}
                          cursor="pointer"
                        />
                        {/* Count text (only for larger markers) */}
                        {size >= 10 && (
                          <text
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={severity.color}
                            fontSize={size > 14 ? 10 : 7}
                            fontWeight={700}
                            fontFamily="Inter, system-ui, sans-serif"
                            style={{ pointerEvents: "none" }}
                          >
                            {c.count}
                          </text>
                        )}
                        {/* Country label */}
                        <text
                          y={size + 10}
                          textAnchor="middle"
                          fill={isSelected ? "#fff" : "rgba(161,161,170,0.5)"}
                          fontSize={8}
                          fontWeight={isSelected ? 600 : 400}
                          fontFamily="Inter, system-ui, sans-serif"
                          style={{ pointerEvents: "none" }}
                        >
                          {c.name.length > 12 ? c.code : c.name}
                        </text>
                      </Marker>
                    );
                  })}
                </ZoomableGroup>
              </ComposableMap>

              {/* Hover tooltip */}
              {hoveredCountry && !selectedCountry && (() => {
                const c = countries.find((x) => x.code === hoveredCountry);
                if (!c) return null;
                const severity = getSeverityLevel(c.avgSeverity);
                return (
                  <div
                    className="fixed z-50 rounded-xl border border-white/10 bg-[#111118]/95 p-3 shadow-2xl backdrop-blur-md"
                    style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 10, pointerEvents: "none", minWidth: 200 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{COUNTRY_FLAGS[c.code] || "📍"}</span>
                      <span className="text-sm font-bold text-white">{c.name}</span>
                      <span className="ml-auto text-[10px] font-bold" style={{ color: severity.color }}>
                        {c.count} events
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Avg severity: {c.avgSeverity.toFixed(1)} · {c.region}
                    </p>
                    <p className="mt-1.5 text-[10px] text-zinc-400 truncate">
                      {c.events[0]?.title}
                    </p>
                    <p className="mt-0.5 text-[9px] text-emerald">Click to view all events →</p>
                  </div>
                );
              })()}
            </div>

            {/* Country quick-access grid */}
            <div className="mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-600">Countries by event count</p>
              <div className="flex flex-wrap gap-1.5">
                {countries.slice(0, 20).map((c) => {
                  const severity = getSeverityLevel(c.avgSeverity);
                  const isSelected = selectedCountry === c.code;
                  return (
                    <button
                      key={c.code}
                      onClick={() => handleMarkerClick(c.code)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition border ${
                        isSelected
                          ? "bg-white/[0.08] border-white/20 text-white"
                          : "border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>{COUNTRY_FLAGS[c.code] || "📍"}</span>
                      <span>{c.name}</span>
                      <span className="font-bold" style={{ color: severity.color }}>{c.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Side panel - slides in when a country is selected */}
        {selectedData && (
          <div className="w-full shrink-0 animate-in slide-in-from-right-5 duration-200 xl:w-[420px]">
            <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0A0A] xl:sticky xl:top-4 xl:max-h-[calc(100vh-120px)]">
              {/* Header */}
              <div className="border-b border-white/[0.06] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{COUNTRY_FLAGS[selectedData.code] || "📍"}</span>
                    <div>
                      <h3 className="text-base font-bold text-white">{selectedData.name}</h3>
                      <p className="text-[10px] text-zinc-500">{selectedData.region} · {selectedData.count} events</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={Math.round(selectedData.avgSeverity)} />
                    <button
                      onClick={() => setSelectedCountry(null)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Severity bar */}
                <div className="mt-3 h-1.5 rounded-full bg-white/[0.05]">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: getSeverityLevel(selectedData.avgSeverity).color,
                      width: `${Math.min(100, selectedData.avgSeverity * 10)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[9px] text-zinc-600">
                  <span>Avg severity: {selectedData.avgSeverity.toFixed(1)}/10</span>
                  <span>Last: {relativeTime(selectedData.events[0]?.publishedAt || new Date().toISOString())}</span>
                </div>
              </div>

              {/* Events list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedData.events.map((event) => {
                  const correlations = event.correlations ?? [];
                  return (
                    <div
                      key={event.id}
                      className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 transition hover:bg-white/[0.04]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
                            <span>{event.source}</span>
                            <span>·</span>
                            <span>{relativeTime(event.publishedAt)}</span>
                          </div>
                          <h4 className="mt-0.5 text-xs font-semibold text-white leading-snug">
                            <Link href={`/event/${event.id}`} className="!text-white hover:!text-emerald transition-colors">
                              {event.title}
                            </Link>
                          </h4>
                          <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-2">{event.summary}</p>
                        </div>
                        <SeverityBadge severity={event.severity ?? 1} />
                      </div>

                      {/* Correlated assets */}
                      {correlations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {correlations.slice(0, 4).map((corr) => {
                            const isUp = corr.impactDirection !== "down";
                            return (
                              <SymbolHoverCard key={corr.id} symbol={corr.symbol}>
                                <Link
                                  href={`/stock/${corr.symbol}`}
                                  className="inline-flex items-center gap-1 rounded border border-white/[0.05] bg-white/[0.02] px-1.5 py-0.5 text-[9px] hover:bg-white/[0.06] hover:border-white/[0.1] transition"
                                >
                                  <span className={`h-1 w-1 rounded-full ${isUp ? "bg-emerald" : "bg-red-400"}`} />
                                  <span className="font-bold text-zinc-400">{corr.symbol}</span>
                                  <span className={isUp ? "text-emerald" : "text-red-400"}>
                                    {isUp ? "↑" : "↓"}
                                  </span>
                                </Link>
                              </SymbolHoverCard>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t border-white/[0.06] p-3">
                <Link
                  href={`/timeline?region=${encodeURIComponent(selectedData.region)}`}
                  className="block w-full rounded-lg bg-emerald/10 py-2 text-center text-xs font-semibold !text-emerald hover:bg-emerald/15 transition"
                >
                  View all {selectedData.name} events on Timeline →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
