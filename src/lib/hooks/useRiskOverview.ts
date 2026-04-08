import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export type RiskBucket = {
  scopeType: "country" | "region";
  scopeKey: string;
  scopeLabel: string;
  region?: string;
  countryCode?: string | null;
  riskScore: number;
  trend: "rising" | "stable" | "cooling";
  heatLevel: "critical" | "elevated" | "watch" | "calm";
  storyCount: number;
  supportScore: number;
  marketPressure: number;
  avgSeverity: number;
  latestPublishedAt: string;
  topSymbols: string[];
  narrativeCount: number;
};

export type NarrativeCluster = {
  clusterId: string;
  headline: string;
  region: string;
  category: string;
  storyCount: number;
  supportScore: number;
  marketPressure: number;
  avgSeverity: number;
  trend: "rising" | "stable" | "cooling";
  heatLevel: "critical" | "elevated" | "watch" | "calm";
  latestPublishedAt: string;
  whyNow: string | null;
  watchSymbols: string[];
  storyIds: string[];
};

export type MarketRadar = {
  pressureScore: number;
  posture: "risk-on" | "risk-off" | "mixed";
  breadth: {
    positive: number;
    negative: number;
    flat: number;
  };
  topMovers: Array<{
    symbol: string;
    price: number;
    changePct: number;
    freshness: "live" | "delayed" | "snapshot";
    provider: string;
    timestamp: string;
    name: string;
    assetClass: string;
    focus: string;
  }>;
  topSymbols: string[];
  assetClassBreakdown: Array<{ assetClass: string; count: number }>;
};

export type RiskOverviewResponse = {
  generatedAt: string;
  window: string;
  regions: RiskBucket[];
  countries: RiskBucket[];
  narratives: NarrativeCluster[];
  radar: MarketRadar;
};

export function useRiskOverview(window = "72h") {
  const query = `/api/risk/overview?window=${encodeURIComponent(window)}`;
  const { data, error, isLoading, mutate } = useSWR<RiskOverviewResponse>(query, fetcher, {
    refreshInterval: 120000,
  });

  return {
    riskOverview: data,
    isLoading,
    error,
    mutate,
  };
}
