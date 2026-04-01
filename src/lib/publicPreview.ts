import { FEATURE_LIMITS } from "./entitlements";
import { prisma } from "./prisma";
import { getAssetMeta } from "./assets";
import { summarizeEventIntelligence } from "./intelligence";
import { summarizeStoryTrust } from "./trust";

const PREVIEW_WINDOW_HOURS = 72;
const RECENT_WINDOW_HOURS = 24;
const FALLBACK_SYMBOLS = ["SPY", "QQQ", "GLD", "USO", "TLT", "ITA", "XLE", "FXI"];

type PreviewCorrelation = {
  symbol: string;
  impactDirection: string;
  impactScore: number;
  impactMagnitude: number;
};

type PreviewStory = {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: string;
  publishedAt: string;
  category: string;
  relevanceScore: number;
  intelligenceQuality: number;
  whyThisMatters: string | null;
  supportingSourcesCount: number;
  sourceReliability: number;
  correlations: PreviewCorrelation[];
};

export type PublicPreviewData = {
  generatedAt: string;
  lastIngestion: {
    status: string;
    eventsFound: number;
    completedAt: string | null;
  } | null;
  metrics: {
    totalEvents: number;
    recentEvents24h: number;
    totalCorrelations: number;
    degradedSources: number;
    registeredUsers: number;
    foundingSpotsRemaining: number;
  };
  previewStories: PreviewStory[];
  hotspots: Array<{ region: string; count: number }>;
  topMovers: Array<{
    symbol: string;
    name: string;
    assetClass: string;
    focus: string;
    price: number;
    changePct: number;
    provider: string;
    freshness: string;
    timestamp: string;
  }>;
};

function getPreviewWindowStart(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function pickPreviewSymbols(stories: PreviewStory[]) {
  const scores = new Map<string, number>();

  for (const story of stories) {
    for (const correlation of story.correlations) {
      const current = scores.get(correlation.symbol) || 0;
      scores.set(
        correlation.symbol,
        current + correlation.impactScore + Math.abs(correlation.impactMagnitude)
      );
    }
  }

  const ranked = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([symbol]) => symbol);

  return (ranked.length > 0 ? ranked : FALLBACK_SYMBOLS).slice(0, 8);
}

async function readLatestSnapshots(symbols: string[]) {
  const rows = await Promise.all(
    symbols.map((symbol) =>
      prisma.marketSnapshot.findFirst({
        where: { symbol },
        orderBy: { timestamp: "desc" },
      })
    )
  );

  return rows
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => {
      const meta = getAssetMeta(row.symbol);
      return {
        symbol: row.symbol,
        name: meta.name,
        assetClass: meta.assetClass,
        focus: meta.focus,
        price: row.price,
        changePct: row.changePct,
        provider: row.provider,
        freshness: row.freshness,
        timestamp: row.timestamp.toISOString(),
      };
    })
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 6);
}

export async function getPublicPreviewData(): Promise<PublicPreviewData> {
  const previewWindowStart = getPreviewWindowStart(PREVIEW_WINDOW_HOURS);
  const recentWindowStart = getPreviewWindowStart(RECENT_WINDOW_HOURS);

  const [events, totalEvents, recentEvents24h, totalCorrelations, degradedSources, registeredUsers, lastIngestion] =
    await Promise.all([
      prisma.event.findMany({
        where: {
          publishedAt: { gte: previewWindowStart },
          severity: { gte: 4 },
        },
        orderBy: [
          { relevanceScore: "desc" },
          { supportingSourcesCount: "desc" },
          { severity: "desc" },
          { publishedAt: "desc" },
        ],
        take: 18,
        include: {
          correlations: {
            select: {
              symbol: true,
              impactDirection: true,
              impactScore: true,
              impactMagnitude: true,
            },
          },
        },
      }),
      prisma.event.count(),
      prisma.event.count({
        where: {
          publishedAt: { gte: recentWindowStart },
        },
      }),
      prisma.correlation.count(),
      prisma.sourceHealth.count({
        where: {
          status: { in: ["degraded", "failed"] },
        },
      }),
      prisma.user.count(),
      prisma.ingestionLog.findFirst({
        orderBy: { startedAt: "desc" },
      }),
    ]);

  const previewStories = events.map((event) => {
    const intelligence = summarizeEventIntelligence({
      title: event.title,
      summary: event.summary,
      region: event.region,
      category: event.category,
      severity: event.severity,
      publishedAt: event.publishedAt,
      supportingSourcesCount: event.supportingSourcesCount,
      sourceReliability: event.sourceReliability ?? undefined,
      symbols: event.correlations.map((corr) => corr.symbol),
    });

    return {
      id: event.id,
      title: event.title,
      summary: event.summary,
      source: event.source,
      region: event.region,
      publishedAt: event.publishedAt.toISOString(),
      category: intelligence.category,
      relevanceScore: intelligence.relevanceScore,
      intelligenceQuality: intelligence.intelligenceQuality,
      whyThisMatters: intelligence.whyThisMatters,
      supportingSourcesCount: event.supportingSourcesCount,
      sourceReliability: event.sourceReliability,
      correlations: event.correlations,
    };
  })
    .sort((a, b) => {
      const aTrust = summarizeStoryTrust(a).overallScore;
      const bTrust = summarizeStoryTrust(b).overallScore;
      const aScore = a.relevanceScore + aTrust * 4 + Math.min(3, a.supportingSourcesCount);
      const bScore = b.relevanceScore + bTrust * 4 + Math.min(3, b.supportingSourcesCount);
      return bScore - aScore;
    });

  const trustedPreviewStories = previewStories.filter((story) => {
    const trust = summarizeStoryTrust(story);
    return trust.overallScore >= 0.58 || story.supportingSourcesCount >= 2;
  });

  const visiblePreviewStories = (trustedPreviewStories.length >= 6 ? trustedPreviewStories : previewStories).slice(0, 6);

  const hotspots = Object.entries(
    visiblePreviewStories.reduce<Record<string, number>>((acc, story) => {
      acc[story.region] = (acc[story.region] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const topMovers = await readLatestSnapshots(pickPreviewSymbols(visiblePreviewStories));

  return {
    generatedAt: new Date().toISOString(),
    lastIngestion: lastIngestion
      ? {
          status: lastIngestion.status,
          eventsFound: lastIngestion.eventsFound,
          completedAt: lastIngestion.completedAt?.toISOString() || null,
        }
      : null,
    metrics: {
      totalEvents,
      recentEvents24h,
      totalCorrelations,
      degradedSources,
      registeredUsers,
      foundingSpotsRemaining: Math.max(0, FEATURE_LIMITS.foundingPremiumUsers - registeredUsers),
    },
    previewStories: visiblePreviewStories,
    hotspots,
    topMovers,
  };
}
