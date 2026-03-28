import { prisma } from "../prisma";
import { fetchGdeltEvents } from "../sources/gdelt";
import { fetchRssEvents } from "../sources/rss";
import { generateCorrelations } from "../correlation/matchEvents";
import { aggregatePatterns } from "../correlation/patterns";
import { analyzeEventSentiments } from "../analysis/sentiment";
import {
  buildDuplicateClusterId,
  canonicalizeUrl,
  categorizeEvent,
  extractTags,
  sourceReliabilityForSource,
  summarizeEventIntelligence,
  stableHash,
} from "../intelligence";
import { createIngestionJob, updateIngestionJob } from "./jobs";
import { stringifyStringArray } from "../json";

type RawEvent = Awaited<ReturnType<typeof fetchRssEvents>>[number] | Awaited<ReturnType<typeof fetchGdeltEvents>>[number];

export async function ingestEvents() {
  const startedAt = new Date();
  let totalEvents = 0;
  const errors: string[] = [];

  // Log ingestion start
  const log = await prisma.ingestionLog.create({
    data: {
      source: "all",
      eventsFound: 0,
      status: "running",
      startedAt,
    },
  });
  const job = await createIngestionJob("ingest_events");

  try {
    await updateIngestionJob(job.id, { stage: "fetch", status: "running" });

    // Fetch from all sources in parallel
    const [rssEvents, gdeltEvents] = await Promise.allSettled([
      fetchRssEvents(),
      fetchGdeltEvents(),
    ]);

    const rss = rssEvents.status === "fulfilled" ? rssEvents.value : [];
    if (rssEvents.status === "rejected") {
      errors.push(`RSS: ${rssEvents.reason}`);
    }

    const gdelt = gdeltEvents.status === "fulfilled" ? gdeltEvents.value : [];
    if (gdeltEvents.status === "rejected") {
      errors.push(`GDELT: ${gdeltEvents.reason}`);
    }

    await updateIngestionJob(job.id, {
      stage: "normalize",
      status: "running",
      itemsProcessed: rss.length + gdelt.length,
    });

    const merged = [...rss, ...gdelt];
    const deduped = new Map<string, RawEvent>();
    for (const item of merged) {
      const canonicalUrl = canonicalizeUrl(item.url);
      const existing = deduped.get(canonicalUrl);
      if (!existing || item.severity > existing.severity) {
        deduped.set(canonicalUrl, item);
      }
    }

    const normalized = Array.from(deduped.values()).map((event) => {
      const canonicalUrl = canonicalizeUrl(event.url);
      const category = categorizeEvent(event.title, event.summary);
      const duplicateClusterId = buildDuplicateClusterId(event.title, event.region, category);
      const tags = extractTags(event.title, event.summary, event.region);
      const sourceReliability = sourceReliabilityForSource(event.source);
      const intelligence = summarizeEventIntelligence({
        title: event.title,
        summary: event.summary,
        region: event.region,
        category,
        severity: event.severity,
        publishedAt: event.publishedAt,
        supportingSourcesCount: 1,
        sourceReliability,
      });

      return {
        ...event,
        canonicalUrl,
        urlHash: stableHash(canonicalUrl),
        category,
        duplicateClusterId,
        tags,
        whyThisMatters: intelligence.whyThisMatters,
        relevanceScore: intelligence.relevanceScore,
        sourceReliability,
      };
    });

    await updateIngestionJob(job.id, { stage: "persist", status: "running" });

    const persistedEvents: Array<{ id: string; category: string; region: string; severity: number; publishedAt: Date; duplicateClusterId: string | null; url: string }> = [];
    for (const event of normalized) {
      try {
        const saved = await prisma.event.upsert({
          where: { url: event.url },
          update: {
            title: event.title,
            summary: event.summary,
            source: event.source,
            region: event.region,
            countryCode: event.countryCode,
            severity: event.severity,
            publishedAt: event.publishedAt,
            canonicalUrl: event.canonicalUrl,
            urlHash: event.urlHash,
            feedGuid: event.feedGuid,
            fetchedAt: new Date(),
            duplicateClusterId: event.duplicateClusterId,
            category: event.category,
            tags: stringifyStringArray(event.tags),
            whyThisMatters: event.whyThisMatters,
            sourceReliability: event.sourceReliability,
            relevanceScore: event.relevanceScore,
          },
          create: {
            title: event.title,
            summary: event.summary,
            source: event.source,
            url: event.url,
            region: event.region,
            countryCode: event.countryCode,
            severity: event.severity,
            publishedAt: event.publishedAt,
            canonicalUrl: event.canonicalUrl,
            urlHash: event.urlHash,
            feedGuid: event.feedGuid,
            fetchedAt: new Date(),
            duplicateClusterId: event.duplicateClusterId,
            category: event.category,
            tags: stringifyStringArray(event.tags),
            whyThisMatters: event.whyThisMatters,
            sourceReliability: event.sourceReliability,
            relevanceScore: event.relevanceScore,
          },
        });
        totalEvents++;
        persistedEvents.push({
          id: saved.id,
          category: saved.category,
          region: saved.region,
          severity: saved.severity,
          publishedAt: saved.publishedAt,
          duplicateClusterId: saved.duplicateClusterId,
          url: saved.url,
        });
      } catch (err) {
        // Skip duplicates or malformed entries silently
      }
    }

    const clusterIds = Array.from(
      new Set(persistedEvents.map((event) => event.duplicateClusterId).filter((value): value is string => Boolean(value)))
    );

    if (clusterIds.length > 0) {
      const clusterCounts = await prisma.event.groupBy({
        by: ["duplicateClusterId"],
        where: {
          duplicateClusterId: {
            in: clusterIds,
          },
        },
        _count: {
          _all: true,
        },
      });

      const countMap = new Map(
        clusterCounts.map((item) => [item.duplicateClusterId || "", item._count._all])
      );

      for (const event of persistedEvents) {
        const supportCount = countMap.get(event.duplicateClusterId || "") || 1;
        const refreshed = await prisma.event.findUnique({
          where: { id: event.id },
          include: {
            correlations: {
              select: {
                symbol: true,
              },
            },
          },
        });

        const intelligence = summarizeEventIntelligence({
          title: refreshed?.title || "",
          summary: refreshed?.summary || "",
          region: event.region,
          category: event.category,
          severity: event.severity,
          publishedAt: event.publishedAt,
          supportingSourcesCount: supportCount,
          sourceReliability: refreshed?.sourceReliability ?? undefined,
          symbols: refreshed?.correlations.map((corr) => corr.symbol) ?? [],
        });

        await prisma.event.update({
          where: { id: event.id },
          data: {
            supportingSourcesCount: supportCount,
            isPremiumInsight: supportCount >= 3 || event.severity >= 8,
            whyThisMatters: intelligence.whyThisMatters,
            relevanceScore: intelligence.relevanceScore,
          },
        });
      }
    }

    await updateIngestionJob(job.id, { stage: "correlate", status: "running", itemsProcessed: totalEvents });

    try {
      await generateCorrelations();
    } catch (err) {
      errors.push(`Correlations: ${(err as Error).message}`);
    }

    await updateIngestionJob(job.id, { stage: "patterns", status: "running", itemsProcessed: totalEvents });

    try {
      await aggregatePatterns();
    } catch (err) {
      errors.push(`Patterns: ${(err as Error).message}`);
    }

    await updateIngestionJob(job.id, { stage: "sentiment", status: "running", itemsProcessed: totalEvents });

    try {
      await analyzeEventSentiments();
    } catch (err) {
      errors.push(`Sentiment: ${(err as Error).message}`);
    }

    await updateIngestionJob(job.id, {
      stage: "digest-prep",
      status: errors.length > 0 ? "partial" : "success",
      itemsProcessed: totalEvents,
      error: errors.length > 0 ? errors.join("; ") : null,
      completed: true,
    });

    // Update log
    await prisma.ingestionLog.update({
      where: { id: log.id },
      data: {
        eventsFound: totalEvents,
        status: errors.length > 0 ? "partial" : "success",
        error: errors.length > 0 ? errors.join("; ") : null,
        completedAt: new Date(),
      },
    });

    return { count: totalEvents, errors };
  } catch (error) {
    await updateIngestionJob(job.id, {
      stage: "failed",
      status: "failed",
      error: (error as Error).message,
      completed: true,
    });
    // Update log with failure
    await prisma.ingestionLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: (error as Error).message,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}
