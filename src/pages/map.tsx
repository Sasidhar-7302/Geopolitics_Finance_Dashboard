import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import Layout from "../components/layout/Layout";
import HeatBadge from "../components/ui/HeatBadge";
import SectionCard from "../components/ui/SectionCard";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import TrustSummary from "../components/ui/TrustSummary";
import { relativeTime } from "../lib/format";
import { useEvents } from "../lib/hooks/useEvents";
import { useRiskOverview } from "../lib/hooks/useRiskOverview";
import { useWorkspace } from "../lib/hooks/useWorkspace";
import { requireAuth } from "../lib/serverAuth";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  UA: "Ukraine",
  RU: "Russia",
  PL: "Poland",
  TR: "Turkey",
  NL: "Netherlands",
  SE: "Sweden",
  CH: "Switzerland",
  IL: "Israel",
  IR: "Iran",
  IQ: "Iraq",
  SY: "Syria",
  SA: "Saudi Arabia",
  YE: "Yemen",
  LB: "Lebanon",
  AE: "United Arab Emirates",
  CN: "China",
  JP: "Japan",
  IN: "India",
  KR: "South Korea",
  KP: "North Korea",
  TW: "Taiwan",
  AU: "Australia",
  ID: "Indonesia",
  PH: "Philippines",
  VN: "Vietnam",
  TH: "Thailand",
  SG: "Singapore",
  PK: "Pakistan",
  AF: "Afghanistan",
  NG: "Nigeria",
  ZA: "South Africa",
  EG: "Egypt",
  KE: "Kenya",
  ET: "Ethiopia",
  SD: "Sudan",
  LY: "Libya",
  MA: "Morocco",
  BR: "Brazil",
  AR: "Argentina",
  VE: "Venezuela",
  CO: "Colombia",
};

function getMarkerColor(heatLevel: "critical" | "elevated" | "watch" | "calm") {
  if (heatLevel === "critical") return "#ef4444";
  if (heatLevel === "elevated") return "#f97316";
  if (heatLevel === "watch") return "#fbbf24";
  return "#10b981";
}

export default function MapView() {
  const { workspace, saveWorkspace } = useWorkspace();
  const initialPreset = workspace.pinnedRegions[0] || "";
  const [activePreset, setActivePreset] = useState(initialPreset);
  const { riskOverview } = useRiskOverview(workspace.defaultTimeWindow);
  const { events } = useEvents({
    regions: activePreset ? [activePreset] : undefined,
    timeWindow: workspace.defaultTimeWindow,
    sort: "relevance",
    limit: 50,
  });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const visibleCountries = useMemo(() => {
    return (riskOverview?.countries ?? []).filter((country) => COUNTRY_COORDS[country.scopeKey]);
  }, [riskOverview?.countries]);

  useEffect(() => {
    if (!visibleCountries.length) {
      setSelectedCountry(null);
      return;
    }
    setSelectedCountry((current) =>
      current && visibleCountries.some((country) => country.scopeKey === current)
        ? current
        : visibleCountries[0].scopeKey
    );
  }, [visibleCountries]);

  const selectedCountryData = visibleCountries.find((country) => country.scopeKey === selectedCountry) || null;
  const selectedStories = useMemo(() => {
    if (!selectedCountry) return [];
    return events.filter((event) => event.countryCode === selectedCountry).slice(0, 8);
  }, [events, selectedCountry]);
  const leadStory = selectedStories[0] || null;
  const presets = (riskOverview?.regions ?? []).slice(0, 6);

  return (
    <Layout>
      <div className="space-y-4">
        <SectionCard
          title="Map Command"
          subtitle="Choose a region, inspect the country, then move from the lead story into the full event file."
          action={<span className="chip">{workspace.defaultTimeWindow}</span>}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActivePreset("")}
                className={`chip ${!activePreset ? "!border-cyan/30 !bg-cyan/10 !text-white" : ""}`}
              >
                Global
              </button>
              {presets.map((preset) => (
                <button
                  key={preset.scopeKey}
                  type="button"
                  onClick={() => setActivePreset(preset.scopeLabel)}
                  className={`chip ${activePreset === preset.scopeLabel ? "!border-cyan/30 !bg-cyan/10 !text-white" : ""}`}
                >
                  {preset.scopeLabel}
                </button>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-black/70">
                <div className="border-b border-white/[0.05] px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Geographic surface</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Marker size reflects story density. Color shows current heat level.
                  </p>
                </div>
                <div className="aspect-[1.85/1] w-full bg-[#04080d]">
                  <ComposableMap projection="geoMercator" projectionConfig={{ scale: 145, center: [20, 20] }} style={{ width: "100%", height: "100%" }}>
                    <ZoomableGroup>
                      <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                          geographies.map((geo) => (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill="#0c1218"
                              stroke="#1e2933"
                              strokeWidth={0.35}
                              style={{
                                default: { outline: "none" },
                                hover: { fill: "#14212c", outline: "none" },
                                pressed: { outline: "none" },
                              }}
                            />
                          ))
                        }
                      </Geographies>
                      {visibleCountries.map((country) => {
                        const coordinates = COUNTRY_COORDS[country.scopeKey];
                        if (!coordinates) return null;
                        const radius = Math.max(5, Math.min(20, country.storyCount * 1.4));
                        const color = getMarkerColor(country.heatLevel);
                        const isSelected = selectedCountry === country.scopeKey;

                        return (
                          <Marker key={country.scopeKey} coordinates={coordinates} onClick={() => setSelectedCountry(country.scopeKey)}>
                            <circle r={radius * 1.8} fill={color} opacity={0.12} />
                            <circle r={radius} fill={color} opacity={isSelected ? 0.96 : 0.78} stroke="#f8fafc" strokeWidth={isSelected ? 1.2 : 0.4} />
                          </Marker>
                        );
                      })}
                    </ZoomableGroup>
                  </ComposableMap>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/[0.06] bg-black/60 p-5">
                  {selectedCountryData ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Country drawer</p>
                          <h2 className="mt-2 text-2xl font-semibold text-white">
                            {COUNTRY_NAMES[selectedCountryData.scopeKey] || selectedCountryData.scopeKey}
                          </h2>
                          <p className="mt-2 text-sm text-zinc-500">
                            {selectedCountryData.storyCount} stories / support {Math.round(selectedCountryData.supportScore * 100)}%
                          </p>
                        </div>
                        <HeatBadge heatLevel={selectedCountryData.heatLevel} trend={selectedCountryData.trend} />
                      </div>

                      <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">What to do next</p>
                        <p className="mt-3 text-sm leading-6 text-zinc-400">
                          Open the lead story first, then scan the remaining country queue for corroboration or escalation.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              saveWorkspace({
                                pinnedRegions: Array.from(
                                  new Set([...workspace.pinnedRegions, selectedCountryData.region || selectedCountryData.scopeLabel])
                                ),
                              })
                            }
                            className="btn-secondary"
                          >
                            Pin {selectedCountryData.region || selectedCountryData.scopeLabel}
                          </button>
                          {leadStory ? (
                            <Link href={`/event/${leadStory.id}`} className="btn-primary">
                              Open lead story
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      {leadStory ? (
                        <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                            Lead story / {leadStory.source} / {relativeTime(leadStory.publishedAt)}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold leading-8 text-white">{leadStory.title}</h3>
                          <p className="mt-3 text-sm leading-6 text-zinc-400">{leadStory.whyThisMatters || leadStory.summary}</p>
                          <TrustSummary
                            className="mt-4"
                            supportingSourcesCount={leadStory.supportingSourcesCount}
                            sourceReliability={leadStory.sourceReliability}
                            intelligenceQuality={leadStory.intelligenceQuality}
                            publishedAt={leadStory.publishedAt}
                            reliability={leadStory.reliability}
                          />
                          <div className="mt-4 flex flex-wrap gap-2">
                            {(leadStory.correlations ?? []).slice(0, 4).map((correlation) => (
                              <SymbolHoverCard key={`${leadStory.id}-${correlation.symbol}`} symbol={correlation.symbol}>
                                <span className="chip">{correlation.symbol}</span>
                              </SymbolHoverCard>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                          No lead story is available for this country in the current window.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
                      Select a marker to inspect the related country.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Country Queue"
          subtitle="The highest-pressure countries stay visible below the map so you can jump quickly without hunting across markers."
        >
          <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="grid gap-3 md:grid-cols-2">
              {visibleCountries.slice(0, 10).map((country) => (
                <button
                  key={country.scopeKey}
                  type="button"
                  onClick={() => setSelectedCountry(country.scopeKey)}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    selectedCountry === country.scopeKey
                      ? "border-cyan/30 bg-cyan/5"
                      : "border-white/[0.06] bg-black/55 hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{COUNTRY_NAMES[country.scopeKey] || country.scopeKey}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {country.storyCount} stories / market pressure {country.marketPressure}
                      </p>
                    </div>
                    <HeatBadge heatLevel={country.heatLevel} trend={country.trend} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {country.topSymbols.slice(0, 4).map((symbol) => (
                      <SymbolHoverCard key={`${country.scopeKey}-${symbol}`} symbol={symbol}>
                        <span className="chip">{symbol}</span>
                      </SymbolHoverCard>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {selectedStories.length > 0 ? (
                selectedStories.map((story, index) => (
                  <div key={story.id} className="rounded-[24px] border border-white/[0.06] bg-black/55 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-4">
                        <div className="hidden h-10 w-10 shrink-0 rounded-2xl border border-white/[0.06] bg-black/60 text-center text-sm font-semibold leading-10 text-zinc-400 sm:block">
                          0{index + 1}
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                            {story.region} / {story.category} / {story.source}
                          </p>
                          <h3 className="mt-2 text-base font-semibold leading-7 text-white">{story.title}</h3>
                        </div>
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
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {(story.correlations ?? []).slice(0, 4).map((correlation) => (
                          <SymbolHoverCard key={`${story.id}-${correlation.symbol}`} symbol={correlation.symbol}>
                            <span className="chip">{correlation.symbol}</span>
                          </SymbolHoverCard>
                        ))}
                      </div>
                      <Link href={`/event/${story.id}`} className="status-pill">
                        Open file
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                  No story drawer items for this country in the current filter window.
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
