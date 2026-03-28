import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type CorrelationItem = {
  id: string;
  symbol: string;
  impactScore: number;
  impactDirection: string;
  impactMagnitude: number;
  window: string;
  category?: string | null;
};

export type EventItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: string;
  countryCode?: string;
  publishedAt: string;
  severity?: number;
  sentimentScore?: number | null;
  sentimentLabel?: string | null;
  url?: string;
  category?: string;
  tags?: string;
  relevanceScore?: number;
  whyThisMatters?: string | null;
  supportingSourcesCount?: number;
  sourceReliability?: number;
  isPremiumInsight?: boolean;
  correlations?: CorrelationItem[];
};

export type EventQuery = {
  q?: string;
  regions?: string[];
  categories?: string[];
  symbols?: string[];
  direction?: string;
  severityMin?: number;
  from?: string;
  to?: string;
  timeWindow?: string;
  sort?: "newest" | "severity" | "relevance" | "support";
  limit?: number;
  cursor?: string | null;
};

function buildQuery(query?: EventQuery) {
  const params = new URLSearchParams();

  if (query?.q) params.set("q", query.q);
  if (query?.regions?.length) params.set("regions", query.regions.join(","));
  if (query?.categories?.length) params.set("categories", query.categories.join(","));
  if (query?.symbols?.length) params.set("symbols", query.symbols.join(","));
  if (query?.direction && query.direction !== "all") params.set("direction", query.direction);
  if (query?.severityMin) params.set("severityMin", String(query.severityMin));
  if (query?.from) params.set("from", query.from);
  if (query?.to) params.set("to", query.to);
  if (query?.timeWindow && query.timeWindow !== "all") params.set("timeWindow", query.timeWindow);
  if (query?.sort) params.set("sort", query.sort);
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  const suffix = params.toString();
  return suffix ? `/api/events?${suffix}` : "/api/events";
}

export function useEvents(query?: EventQuery) {
  const { data, error, isLoading } = useSWR(buildQuery(query), fetcher, {
    refreshInterval: 120000, // 2 min refresh
  });
  return {
    events: (data?.events ?? []) as EventItem[],
    pagination: data?.pagination as { limit: number; nextCursor: string | null; hasMore: boolean; total: number } | undefined,
    isLoading,
    error,
  };
}
