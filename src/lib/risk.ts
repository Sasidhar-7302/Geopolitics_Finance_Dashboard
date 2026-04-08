import { getAssetMeta } from "./assets";
import { fetchMarketQuotes, type MarketQuote } from "./market";
import { prisma } from "./prisma";
import { summarizeStoryTrust } from "./trust";

export type RiskTrend = "rising" | "stable" | "cooling";
export type HeatLevel = "critical" | "elevated" | "watch" | "calm";
export type RiskScopeType = "country" | "region";

export type RiskCorrelationLike = {
  symbol: string;
  impactScore: number;
  impactDirection: string;
  impactMagnitude: number;
};

export type RiskEventLike = {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: string;
  countryCode?: string | null;
  category: string;
  severity: number;
  publishedAt: string | Date;
  duplicateClusterId?: string | null;
  supportingSourcesCount?: number | null;
  sourceReliability?: number | null;
  relevanceScore?: number | null;
  whyThisMatters?: string | null;
  correlations?: RiskCorrelationLike[];
};

export type RiskBucket = {
  scopeType: RiskScopeType;
  scopeKey: string;
  scopeLabel: string;
  region?: string;
  countryCode?: string | null;
  riskScore: number;
  trend: RiskTrend;
  heatLevel: HeatLevel;
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
  trend: RiskTrend;
  heatLevel: HeatLevel;
  latestPublishedAt: string;
  whyNow: string | null;
  watchSymbols: string[];
  storyIds: string[];
};

export type RadarMover = MarketQuote & {
  name: string;
  assetClass: string;
  focus: string;
};

export type MarketRadar = {
  pressureScore: number;
  posture: "risk-on" | "risk-off" | "mixed";
  breadth: {
    positive: number;
    negative: number;
    flat: number;
  };
  topMovers: RadarMover[];
  topSymbols: string[];
  assetClassBreakdown: Array<{ assetClass: string; count: number }>;
};

export type RiskOverview = {
  generatedAt: string;
  window: string;
  regions: RiskBucket[];
  countries: RiskBucket[];
  narratives: NarrativeCluster[];
  radar: MarketRadar;
};

const DEFAULT_WINDOW_HOURS = 72;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function asDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function parseWindowToHours(windowValue?: string | null) {
  if (!windowValue) return DEFAULT_WINDOW_HOURS;
  if (windowValue === "all") return 24 * 7;
  const match = windowValue.match(/^(\d+)(h|d)$/i);
  if (!match) return DEFAULT_WINDOW_HOURS;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit === "d" ? amount * 24 : amount;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function computeTrend(currentScore: number, previousScore: number): RiskTrend {
  if (currentScore >= previousScore * 1.2 + 0.3) return "rising";
  if (previousScore >= currentScore * 1.2 + 0.3) return "cooling";
  return "stable";
}

function computeHeatLevel(score: number): HeatLevel {
  if (score >= 76) return "critical";
  if (score >= 56) return "elevated";
  if (score >= 34) return "watch";
  return "calm";
}

function computeEventWeight(event: RiskEventLike, now: number) {
  const publishedAt = asDate(event.publishedAt).getTime();
  const ageHours = Math.max(0, (now - publishedAt) / (1000 * 60 * 60));
  const recencyWeight =
    ageHours <= 6 ? 1 :
    ageHours <= 24 ? 0.78 :
    ageHours <= 72 ? 0.56 :
    0.34;
  const trust = summarizeStoryTrust({
    supportingSourcesCount: event.supportingSourcesCount,
    sourceReliability: event.sourceReliability,
    intelligenceQuality: clamp((event.relevanceScore ?? 4) / 10, 0, 1),
    publishedAt: event.publishedAt,
  }).overallScore;
  const correlationPressure = (event.correlations ?? []).reduce(
    (total, correlation) => total + Math.abs(correlation.impactMagnitude || correlation.impactScore || 0),
    0
  );

  return {
    recencyWeight,
    trust,
    weightedSeverity: (event.severity || 0) * recencyWeight,
    weightedPressure: correlationPressure * recencyWeight,
  };
}

function getTopSymbols(events: RiskEventLike[], limit = 4) {
  const symbolScores = new Map<string, number>();
  for (const event of events) {
    for (const correlation of event.correlations ?? []) {
      const current = symbolScores.get(correlation.symbol) || 0;
      symbolScores.set(
        correlation.symbol,
        current + Math.abs(correlation.impactMagnitude || correlation.impactScore || 0) + (correlation.impactScore || 0)
      );
    }
  }

  return Array.from(symbolScores.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([symbol]) => symbol);
}

export function buildNarrativeClusters(events: RiskEventLike[], limit = 6): NarrativeCluster[] {
  const now = Date.now();
  const groups = new Map<string, RiskEventLike[]>();

  for (const event of events) {
    const clusterId = event.duplicateClusterId || `${event.category}:${event.region}:${event.id}`;
    const existing = groups.get(clusterId);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(clusterId, [event]);
    }
  }

  const clusters = Array.from(groups.entries()).map(([clusterId, clusterEvents]) => {
    const sortedEvents = [...clusterEvents].sort(
      (left, right) => asDate(right.publishedAt).getTime() - asDate(left.publishedAt).getTime()
    );
    const leadEvent = [...clusterEvents].sort((left, right) => {
      const leftTrust = summarizeStoryTrust({
        supportingSourcesCount: left.supportingSourcesCount,
        sourceReliability: left.sourceReliability,
        intelligenceQuality: clamp((left.relevanceScore ?? 4) / 10, 0, 1),
        publishedAt: left.publishedAt,
      }).overallScore;
      const rightTrust = summarizeStoryTrust({
        supportingSourcesCount: right.supportingSourcesCount,
        sourceReliability: right.sourceReliability,
        intelligenceQuality: clamp((right.relevanceScore ?? 4) / 10, 0, 1),
        publishedAt: right.publishedAt,
      }).overallScore;

      return (right.severity + rightTrust * 5) - (left.severity + leftTrust * 5);
    })[0];

    const currentScore = clusterEvents
      .filter((event) => now - asDate(event.publishedAt).getTime() <= 24 * 60 * 60 * 1000)
      .reduce((total, event) => total + computeEventWeight(event, now).weightedSeverity, 0);
    const previousScore = clusterEvents
      .filter((event) => {
        const age = now - asDate(event.publishedAt).getTime();
        return age > 24 * 60 * 60 * 1000 && age <= 48 * 60 * 60 * 1000;
      })
      .reduce((total, event) => total + computeEventWeight(event, now).weightedSeverity, 0);

    const supportScore = round(
      clusterEvents.reduce((total, event) => {
        return total + summarizeStoryTrust({
          supportingSourcesCount: event.supportingSourcesCount,
          sourceReliability: event.sourceReliability,
          intelligenceQuality: clamp((event.relevanceScore ?? 4) / 10, 0, 1),
          publishedAt: event.publishedAt,
        }).overallScore;
      }, 0) / Math.max(clusterEvents.length, 1)
    );

    const avgSeverity = round(
      clusterEvents.reduce((total, event) => total + event.severity, 0) / Math.max(clusterEvents.length, 1)
    );
    const marketPressure = round(
      clusterEvents.reduce((total, event) => total + computeEventWeight(event, now).weightedPressure, 0)
    );
    const score = round(
      clamp(avgSeverity * 7 + supportScore * 24 + Math.min(18, marketPressure * 2.4) + clusterEvents.length * 4, 0, 100)
    );

    return {
      clusterId,
      headline: leadEvent.title,
      region: leadEvent.region,
      category: leadEvent.category,
      storyCount: clusterEvents.length,
      supportScore,
      marketPressure,
      avgSeverity,
      trend: computeTrend(currentScore, previousScore),
      heatLevel: computeHeatLevel(score),
      latestPublishedAt: asDate(sortedEvents[0].publishedAt).toISOString(),
      whyNow: leadEvent.whyThisMatters || leadEvent.summary || null,
      watchSymbols: getTopSymbols(clusterEvents, 4),
      storyIds: sortedEvents.map((event) => event.id),
    };
  });

  return clusters
    .sort((left, right) => {
      const leftScore = left.storyCount * 3 + left.avgSeverity * 4 + left.supportScore * 16 + left.marketPressure;
      const rightScore = right.storyCount * 3 + right.avgSeverity * 4 + right.supportScore * 16 + right.marketPressure;
      return rightScore - leftScore;
    })
    .slice(0, limit);
}

export function buildRiskBuckets(events: RiskEventLike[], scopeType: RiskScopeType): RiskBucket[] {
  const now = Date.now();
  const groups = new Map<string, RiskEventLike[]>();

  for (const event of events) {
    const scopeKey = scopeType === "country"
      ? event.countryCode || "GLOBAL"
      : event.region || "Global";

    const existing = groups.get(scopeKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(scopeKey, [event]);
    }
  }

  return Array.from(groups.entries())
    .map(([scopeKey, bucketEvents]) => {
      const weighted = bucketEvents.map((event) => computeEventWeight(event, now));
      const storyCount = bucketEvents.length;
      const currentScore = bucketEvents
        .filter((event) => now - asDate(event.publishedAt).getTime() <= 24 * 60 * 60 * 1000)
        .reduce((total, event) => total + computeEventWeight(event, now).weightedSeverity, 0);
      const previousScore = bucketEvents
        .filter((event) => {
          const age = now - asDate(event.publishedAt).getTime();
          return age > 24 * 60 * 60 * 1000 && age <= 48 * 60 * 60 * 1000;
        })
        .reduce((total, event) => total + computeEventWeight(event, now).weightedSeverity, 0);
      const avgSeverity = round(
        bucketEvents.reduce((total, event) => total + event.severity, 0) / Math.max(storyCount, 1)
      );
      const supportScore = round(
        weighted.reduce((total, item) => total + item.trust, 0) / Math.max(storyCount, 1)
      );
      const marketPressure = round(
        weighted.reduce((total, item) => total + item.weightedPressure, 0)
      );
      const riskScore = round(
        clamp(
          avgSeverity * 6.2
            + supportScore * 22
            + Math.min(22, weighted.reduce((total, item) => total + item.recencyWeight, 0) * 5)
            + Math.min(18, marketPressure * 2.2)
            + Math.min(14, storyCount * 2.5),
          0,
          100
        )
      );
      const latestEvent = [...bucketEvents].sort(
        (left, right) => asDate(right.publishedAt).getTime() - asDate(left.publishedAt).getTime()
      )[0];
      const narrativeCount = new Set(bucketEvents.map((event) => event.duplicateClusterId || event.id)).size;

      return {
        scopeType,
        scopeKey,
        scopeLabel: scopeType === "country" ? (latestEvent.countryCode || "Global") : latestEvent.region,
        region: latestEvent.region,
        countryCode: latestEvent.countryCode,
        riskScore,
        trend: computeTrend(currentScore, previousScore),
        heatLevel: computeHeatLevel(riskScore),
        storyCount,
        supportScore,
        marketPressure,
        avgSeverity,
        latestPublishedAt: asDate(latestEvent.publishedAt).toISOString(),
        topSymbols: getTopSymbols(bucketEvents, 4),
        narrativeCount,
      };
    })
    .sort((left, right) => right.riskScore - left.riskScore);
}

export function buildMarketRadar(events: RiskEventLike[], quotes: MarketQuote[]): MarketRadar {
  const topMovers = [...quotes]
    .sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct))
    .slice(0, 8)
    .map((quote) => ({
      ...quote,
      ...getAssetMeta(quote.symbol),
    }));

  const breadth = topMovers.reduce(
    (totals, quote) => {
      if (quote.changePct > 0.15) totals.positive += 1;
      else if (quote.changePct < -0.15) totals.negative += 1;
      else totals.flat += 1;
      return totals;
    },
    { positive: 0, negative: 0, flat: 0 }
  );

  const assetClassBreakdown = Array.from(
    topMovers.reduce((acc, mover) => {
      acc.set(mover.assetClass, (acc.get(mover.assetClass) || 0) + 1);
      return acc;
    }, new Map<string, number>())
  )
    .map(([assetClass, count]) => ({ assetClass, count }))
    .sort((left, right) => right.count - left.count);

  const pressureFromEvents = events.reduce((total, event) => {
    return total + (event.correlations ?? []).reduce(
      (inner, correlation) => inner + Math.abs(correlation.impactMagnitude || correlation.impactScore || 0),
      0
    );
  }, 0);
  const pressureFromQuotes = topMovers.reduce((total, quote) => total + Math.abs(quote.changePct), 0);
  const pressureScore = round(clamp(pressureFromEvents * 3 + pressureFromQuotes * 1.8, 0, 100));
  const posture =
    breadth.negative >= breadth.positive + 2 ? "risk-off" :
    breadth.positive >= breadth.negative + 2 ? "risk-on" :
    "mixed";

  return {
    pressureScore,
    posture,
    breadth,
    topMovers,
    topSymbols: topMovers.map((mover) => mover.symbol),
    assetClassBreakdown,
  };
}

export async function getRiskOverview(window = "72h"): Promise<RiskOverview> {
  const hours = parseWindowToHours(window);
  const start = new Date(Date.now() - hours * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      publishedAt: { gte: start },
      severity: { gte: 3 },
    },
    orderBy: [
      { publishedAt: "desc" },
      { relevanceScore: "desc" },
    ],
    include: {
      correlations: {
        select: {
          symbol: true,
          impactScore: true,
          impactDirection: true,
          impactMagnitude: true,
        },
      },
    },
    take: 180,
  });

  const normalizedEvents: RiskEventLike[] = events.map((event) => ({
    ...event,
    publishedAt: event.publishedAt.toISOString(),
  }));

  const narratives = buildNarrativeClusters(normalizedEvents, 7);
  const regions = buildRiskBuckets(normalizedEvents, "region").slice(0, 8);
  const countries = buildRiskBuckets(
    normalizedEvents.filter((event) => Boolean(event.countryCode)),
    "country"
  ).slice(0, 12);

  const symbols = Array.from(
    new Set(
      narratives
        .flatMap((cluster) => cluster.watchSymbols)
        .concat(countries.flatMap((bucket) => bucket.topSymbols))
        .slice(0, 16)
    )
  );
  const quoteResult = await fetchMarketQuotes(symbols);
  const radar = buildMarketRadar(normalizedEvents, quoteResult.quotes);

  const snapshotPayload = [...regions, ...countries].map((bucket) =>
    prisma.riskSnapshot.upsert({
      where: {
        scopeType_scopeKey_snapshotWindow: {
          scopeType: bucket.scopeType,
          scopeKey: bucket.scopeKey,
          snapshotWindow: window,
        },
      },
      update: {
        scopeLabel: bucket.scopeLabel,
        riskScore: bucket.riskScore,
        trend: bucket.trend,
        heatLevel: bucket.heatLevel,
        storyCount: bucket.storyCount,
        supportScore: bucket.supportScore,
        marketPressure: bucket.marketPressure,
        narrativeCount: bucket.narrativeCount,
        topSymbol: bucket.topSymbols[0] || null,
        metadata: JSON.stringify({
          region: bucket.region,
          countryCode: bucket.countryCode,
          topSymbols: bucket.topSymbols,
          latestPublishedAt: bucket.latestPublishedAt,
          avgSeverity: bucket.avgSeverity,
        }),
      },
      create: {
        scopeType: bucket.scopeType,
        scopeKey: bucket.scopeKey,
        scopeLabel: bucket.scopeLabel,
        snapshotWindow: window,
        riskScore: bucket.riskScore,
        trend: bucket.trend,
        heatLevel: bucket.heatLevel,
        storyCount: bucket.storyCount,
        supportScore: bucket.supportScore,
        marketPressure: bucket.marketPressure,
        narrativeCount: bucket.narrativeCount,
        topSymbol: bucket.topSymbols[0] || null,
        metadata: JSON.stringify({
          region: bucket.region,
          countryCode: bucket.countryCode,
          topSymbols: bucket.topSymbols,
          latestPublishedAt: bucket.latestPublishedAt,
          avgSeverity: bucket.avgSeverity,
        }),
      },
    })
  );

  await Promise.all(snapshotPayload);

  return {
    generatedAt: new Date().toISOString(),
    window,
    regions,
    countries,
    narratives,
    radar,
  };
}
