import { summarizeStoryTrust, type StoryTrustLevel } from "./trust";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toTimestamp(value?: string | Date | null) {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function toIsoString(value?: string | Date | null) {
  const timestamp = toTimestamp(value);
  return timestamp ? new Date(timestamp).toISOString() : null;
}

function statusSeverity(status: FeedHealthState) {
  switch (status) {
    case "failed":
      return 3;
    case "degraded":
      return 2;
    case "healthy":
      return 1;
    default:
      return 0;
  }
}

function describeFeedState(status: FeedHealthState) {
  switch (status) {
    case "healthy":
      return "Feed healthy";
    case "degraded":
      return "Feed degraded";
    case "failed":
      return "Feed failing";
    default:
      return "Feed status unknown";
  }
}

export type FeedHealthState = "healthy" | "degraded" | "failed" | "unknown";

export type SourceHealthEntry = {
  source: string;
  feedUrl?: string | null;
  status?: string | null;
  lastFetchedAt?: string | Date | null;
  lastSucceededAt?: string | Date | null;
  lastError?: string | null;
  lastLatencyMs?: number | null;
  failureCount?: number | null;
  successCount?: number | null;
  updatedAt?: string | Date | null;
};

export type EventSourceHealth = {
  source: string;
  status: FeedHealthState;
  label: string;
  note: string;
  score: number;
  successRate: number;
  failureCount: number;
  successCount: number;
  lastFetchedAt: string | null;
  lastSucceededAt: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
};

export type SourceHealthOverview = {
  status: FeedHealthState;
  label: string;
  description: string;
  healthScore: number;
  totalFeeds: number;
  healthyFeeds: number;
  degradedFeeds: number;
  failedFeeds: number;
  successRate: number;
  recentSuccessAt: string | null;
  activeIssues: EventSourceHealth[];
  sources: EventSourceHealth[];
};

export type FreshnessSummary = {
  label: string;
  detail: string;
  score: number;
};

export type EventReliability = {
  level: StoryTrustLevel;
  label: string;
  overallScore: number;
  note: string;
  corroborationLabel: string;
  corroborationScore: number;
  freshnessLabel: string;
  freshnessDetail: string;
  freshnessScore: number;
  sourceQualityLabel: string;
  sourceQualityScore: number;
  feedHealthLabel: string;
  feedHealthScore: number;
  feedHealthStatus: FeedHealthState;
  feedHealthNote: string;
  supportCount: number;
};

function normalizeSourceKey(source: string) {
  return source.trim().toLowerCase().replace(/\s+/g, " ");
}

function coerceFeedHealthState(status?: string | null, lastSucceededAt?: string | Date | null) {
  const normalized = (status || "").toLowerCase();
  const lastSucceededTs = toTimestamp(lastSucceededAt);
  const hoursSinceSuccess = lastSucceededTs ? (Date.now() - lastSucceededTs) / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;

  if (normalized === "failed") return "failed";
  if (normalized === "degraded") return "degraded";
  if (normalized === "ok" || normalized === "healthy" || normalized === "success") {
    if (hoursSinceSuccess > 24) return "failed";
    if (hoursSinceSuccess > 8) return "degraded";
    return "healthy";
  }
  if (hoursSinceSuccess <= 8) return "healthy";
  if (hoursSinceSuccess <= 24) return "degraded";
  return "unknown";
}

function summarizeSingleSourceHealth(source: string, rows: SourceHealthEntry[]): EventSourceHealth {
  const successCount = rows.reduce((total, row) => total + Math.max(0, row.successCount ?? 0), 0);
  const failureCount = rows.reduce((total, row) => total + Math.max(0, row.failureCount ?? 0), 0);
  const attempts = successCount + failureCount;
  const successRate = attempts > 0 ? successCount / attempts : 0.5;
  const lastLatencyMs = rows
    .map((row) => row.lastLatencyMs)
    .find((value): value is number => typeof value === "number" && Number.isFinite(value)) ?? null;

  const latestSuccess = rows.reduce<number | null>((latest, row) => {
    const timestamp = toTimestamp(row.lastSucceededAt);
    return timestamp && (!latest || timestamp > latest) ? timestamp : latest;
  }, null);
  const latestFetch = rows.reduce<number | null>((latest, row) => {
    const timestamp = toTimestamp(row.lastFetchedAt ?? row.updatedAt);
    return timestamp && (!latest || timestamp > latest) ? timestamp : latest;
  }, null);
  const latestError = rows
    .slice()
    .sort((left, right) => (toTimestamp(right.updatedAt) ?? 0) - (toTimestamp(left.updatedAt) ?? 0))
    .find((row) => row.lastError)?.lastError ?? null;

  const explicitState = rows.reduce<FeedHealthState>((worst, row) => {
    const candidate = coerceFeedHealthState(row.status, row.lastSucceededAt);
    return statusSeverity(candidate) > statusSeverity(worst) ? candidate : worst;
  }, "unknown");

  const hoursSinceSuccess = latestSuccess ? (Date.now() - latestSuccess) / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;
  const freshnessScore =
    hoursSinceSuccess <= 2 ? 1 :
    hoursSinceSuccess <= 8 ? 0.85 :
    hoursSinceSuccess <= 24 ? 0.62 :
    hoursSinceSuccess <= 48 ? 0.38 :
    0.18;
  const latencyScore =
    lastLatencyMs === null ? 0.65 :
    lastLatencyMs <= 1200 ? 1 :
    lastLatencyMs <= 2500 ? 0.82 :
    lastLatencyMs <= 5000 ? 0.64 :
    0.42;

  const score = Number(
    clamp(successRate * 0.55 + freshnessScore * 0.3 + latencyScore * 0.15, 0, 1).toFixed(2)
  );

  let status: FeedHealthState = explicitState;
  if (
    status === "healthy" &&
    (
      successRate < 0.85 ||
      freshnessScore < 0.7 ||
      failureCount >= 3 ||
      (attempts >= 6 && failureCount / attempts > 0.15)
    )
  ) {
    status = "degraded";
  }
  if (status !== "failed" && (score < 0.38 || freshnessScore <= 0.2)) {
    status = "failed";
  }
  if (status === "unknown" && score >= 0.7) {
    status = "healthy";
  } else if (status === "unknown" && score >= 0.45) {
    status = "degraded";
  }

  const note =
    status === "healthy"
      ? "Source is fetching cleanly with recent successful updates."
      : status === "degraded"
      ? latestError
        ? `Source has delivery issues: ${latestError}`
        : "Source is still delivering, but recent fetch quality is inconsistent."
      : latestError
      ? `Source is currently unstable: ${latestError}`
      : "Source has not produced a reliable recent update.";

  return {
    source,
    status,
    label: describeFeedState(status),
    note,
    score,
    successRate: Number(successRate.toFixed(2)),
    failureCount,
    successCount,
    lastFetchedAt: latestFetch ? new Date(latestFetch).toISOString() : null,
    lastSucceededAt: latestSuccess ? new Date(latestSuccess).toISOString() : null,
    lastError: latestError,
    lastLatencyMs,
  };
}

export function summarizeSourceHealth(rows: SourceHealthEntry[]): SourceHealthOverview {
  if (!rows.length) {
    return {
      status: "unknown",
      label: "Feed health unavailable",
      description: "No feed telemetry is available yet.",
      healthScore: 0,
      totalFeeds: 0,
      healthyFeeds: 0,
      degradedFeeds: 0,
      failedFeeds: 0,
      successRate: 0,
      recentSuccessAt: null,
      activeIssues: [],
      sources: [],
    };
  }

  const grouped = new Map<string, SourceHealthEntry[]>();
  rows.forEach((row) => {
    const key = normalizeSourceKey(row.source);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  });

  const sources = Array.from(grouped.values())
    .map((groupRows) => summarizeSingleSourceHealth(groupRows[0]!.source, groupRows))
    .sort((left, right) => statusSeverity(right.status) - statusSeverity(left.status) || left.score - right.score);

  const healthyFeeds = sources.filter((item) => item.status === "healthy").length;
  const degradedFeeds = sources.filter((item) => item.status === "degraded").length;
  const failedFeeds = sources.filter((item) => item.status === "failed").length;
  const totalFeeds = sources.length;
  const healthScore = Number(
    (sources.reduce((total, item) => total + item.score, 0) / Math.max(1, totalFeeds)).toFixed(2)
  );
  const successRate = Number(
    (
      sources.reduce((total, item) => total + item.successRate, 0) /
      Math.max(1, totalFeeds)
    ).toFixed(2)
  );
  const recentSuccessAt = sources
    .map((item) => toTimestamp(item.lastSucceededAt))
    .filter((value): value is number => Boolean(value))
    .sort((left, right) => right - left)[0];

  const failedThreshold = Math.max(3, Math.ceil(totalFeeds * 0.25));
  const status: FeedHealthState =
    failedFeeds >= failedThreshold || healthScore < 0.42
      ? "failed"
      : failedFeeds > 0 || degradedFeeds > 0 || healthScore < 0.72
      ? "degraded"
      : "healthy";

  const label =
    status === "healthy"
      ? "Feed network healthy"
      : status === "degraded"
      ? "Feed network degraded"
      : "Feed network unstable";
  const description =
    status === "healthy"
      ? "Most upstream feeds are updating cleanly."
      : status === "degraded"
      ? "Some upstream feeds are delayed or erroring, but the surface remains usable."
      : "Several upstream feeds are failing. Treat emerging stories with more caution.";

  return {
    status,
    label,
    description,
    healthScore,
    totalFeeds,
    healthyFeeds,
    degradedFeeds,
    failedFeeds,
    successRate,
    recentSuccessAt: recentSuccessAt ? new Date(recentSuccessAt).toISOString() : null,
    activeIssues: sources.filter((item) => item.status !== "healthy").slice(0, 4),
    sources,
  };
}

export function matchSourceHealth(
  sources: EventSourceHealth[],
  sourceName?: string | null
): EventSourceHealth | null {
  if (!sourceName) return null;
  const normalizedTarget = normalizeSourceKey(sourceName);
  const exactMatch = sources.find((item) => normalizeSourceKey(item.source) === normalizedTarget);
  if (exactMatch) return exactMatch;

  return (
    sources.find((item) =>
      normalizeSourceKey(item.source).includes(normalizedTarget) ||
      normalizedTarget.includes(normalizeSourceKey(item.source))
    ) ?? null
  );
}

export function summarizeFreshness(publishedAt?: string | Date | null): FreshnessSummary {
  const timestamp = toTimestamp(publishedAt);
  if (!timestamp) {
    return {
      label: "Unknown freshness",
      detail: "Publish time unavailable.",
      score: 0.42,
    };
  }

  const ageHours = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
  if (ageHours <= 2) {
    return {
      label: "Fresh signal",
      detail: "Published in the last 2 hours.",
      score: 1,
    };
  }
  if (ageHours <= 12) {
    return {
      label: "Same-session signal",
      detail: "Published in the last 12 hours.",
      score: 0.86,
    };
  }
  if (ageHours <= 24) {
    return {
      label: "Last 24h",
      detail: "Published in the last trading day.",
      score: 0.72,
    };
  }
  if (ageHours <= 72) {
    return {
      label: "Aging context",
      detail: "Still relevant, but no longer fresh.",
      score: 0.52,
    };
  }

  return {
    label: "Older context",
    detail: "Treat as background rather than a new catalyst.",
    score: 0.32,
  };
}

export function buildEventReliability(params: {
  source?: string | null;
  supportingSourcesCount?: number | null;
  sourceReliability?: number | null;
  intelligenceQuality?: number | null;
  publishedAt?: string | Date | null;
  sourceHealth?: EventSourceHealth | null;
}): EventReliability {
  const supportCount = Math.max(1, params.supportingSourcesCount ?? 1);
  const sourceQualityScore = clamp(params.sourceReliability ?? 0.75, 0, 1);
  const trust = summarizeStoryTrust({
    supportingSourcesCount: params.supportingSourcesCount,
    sourceReliability: params.sourceReliability,
    intelligenceQuality: params.intelligenceQuality,
    publishedAt: params.publishedAt,
  });
  const freshness = summarizeFreshness(params.publishedAt);
  const corroborationScore = clamp(0.3 + Math.min(0.7, (supportCount - 1) * 0.23), 0, 1);
  const feedHealth = params.sourceHealth;
  const feedHealthScore = feedHealth?.score ?? 0.62;

  const overallScore = Number(
    clamp(
      trust.overallScore * 0.42 +
        corroborationScore * 0.18 +
        freshness.score * 0.18 +
        sourceQualityScore * 0.12 +
        feedHealthScore * 0.1,
      0,
      1
    ).toFixed(2)
  );

  const corroborationLabel =
    supportCount >= 4
      ? "Broadly corroborated"
      : supportCount >= 2
      ? `${supportCount} confirming sources`
      : "Single-source signal";

  const sourceQualityLabel =
    sourceQualityScore >= 0.9
      ? "Top-tier source mix"
      : sourceQualityScore >= 0.8
      ? "Reliable source mix"
      : "Mixed source quality";

  const feedHealthStatus = feedHealth?.status ?? "unknown";
  const feedHealthLabel = feedHealth?.label ?? "Feed health unverified";
  const feedHealthNote =
    feedHealth?.note ??
    (params.source ? `No live telemetry for ${params.source}.` : "No live feed telemetry is available for this story.");

  const note =
    trust.level === "high"
      ? `${corroborationLabel}. ${freshness.detail} ${feedHealthStatus === "healthy" ? "Upstream delivery is healthy." : feedHealthNote}`
      : trust.level === "solid"
      ? `${corroborationLabel}. ${freshness.detail} ${feedHealthNote}`
      : `${corroborationLabel}. ${freshness.detail} Validate against primary reporting before acting.`;

  return {
    level: trust.level,
    label: trust.label,
    overallScore,
    note,
    corroborationLabel,
    corroborationScore: Number(corroborationScore.toFixed(2)),
    freshnessLabel: freshness.label,
    freshnessDetail: freshness.detail,
    freshnessScore: freshness.score,
    sourceQualityLabel,
    sourceQualityScore: Number(sourceQualityScore.toFixed(2)),
    feedHealthLabel,
    feedHealthScore: Number(feedHealthScore.toFixed(2)),
    feedHealthStatus,
    feedHealthNote,
    supportCount,
  };
}

export function serializeSourceHealthIssue(issue: EventSourceHealth) {
  return {
    ...issue,
    lastFetchedAt: toIsoString(issue.lastFetchedAt),
    lastSucceededAt: toIsoString(issue.lastSucceededAt),
  };
}
