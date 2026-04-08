import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { predictForEvent } from "../../../lib/correlation/predict";
import { summarizeEventIntelligence } from "../../../lib/intelligence";
import { buildEventReliability, matchSourceHealth, summarizeSourceHealth } from "../../../lib/reliability";
import { buildNarrativeClusters } from "../../../lib/risk";
import { applyPublicReadGuard, sendPublicApiError } from "../../../lib/publicApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (
    !(await applyPublicReadGuard({
      req,
      res,
      namespace: "event-read",
      limit: 120,
      windowMs: 60 * 1000,
      cacheControl: "public, s-maxage=30, stale-while-revalidate=180",
    }))
  ) {
    return;
  }

  const { id } = req.query as { id: string };
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { correlations: true },
    });

    if (!event) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [relatedCoverage, clusterTimeline, predictions] = await Promise.all([
      event.duplicateClusterId
        ? prisma.event.findMany({
            where: {
              duplicateClusterId: event.duplicateClusterId,
              id: { not: event.id },
            },
            select: {
              id: true,
              title: true,
              source: true,
              url: true,
              publishedAt: true,
              supportingSourcesCount: true,
              sourceReliability: true,
            },
            orderBy: { publishedAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
      event.duplicateClusterId
        ? prisma.event.findMany({
            where: {
              duplicateClusterId: event.duplicateClusterId,
            },
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
            orderBy: { publishedAt: "desc" },
            take: 8,
          })
        : Promise.resolve([event]),
      predictForEvent(event.id),
    ]);
    const sourceHealthRows = await prisma.sourceHealth.findMany({
      where: {
        source: {
          in: Array.from(
            new Set(
              [event.source]
                .concat(relatedCoverage.map((item) => item.source))
                .concat(clusterTimeline.map((item) => item.source))
            )
          ),
        },
      },
      select: {
        source: true,
        feedUrl: true,
        status: true,
        lastFetchedAt: true,
        lastSucceededAt: true,
        lastError: true,
        lastLatencyMs: true,
        failureCount: true,
        successCount: true,
        updatedAt: true,
      },
    });
    const sourceHealth = summarizeSourceHealth(sourceHealthRows);

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
    const eventReliability = buildEventReliability({
      source: event.source,
      supportingSourcesCount: event.supportingSourcesCount,
      sourceReliability: event.sourceReliability,
      intelligenceQuality: intelligence.intelligenceQuality,
      publishedAt: event.publishedAt,
      sourceHealth: matchSourceHealth(sourceHealth.sources, event.source),
    });
    const narrative = buildNarrativeClusters(
      clusterTimeline.map((clusterEvent) => ({
        ...clusterEvent,
        publishedAt: clusterEvent.publishedAt.toISOString(),
      })),
      1
    )[0] || null;
    const timeline = clusterTimeline.map((clusterEvent) => {
      const timelineIntelligence = summarizeEventIntelligence({
        title: clusterEvent.title,
        summary: clusterEvent.summary,
        region: clusterEvent.region,
        category: clusterEvent.category,
        severity: clusterEvent.severity,
        publishedAt: clusterEvent.publishedAt,
        supportingSourcesCount: clusterEvent.supportingSourcesCount,
        sourceReliability: clusterEvent.sourceReliability ?? undefined,
        symbols: clusterEvent.correlations.map((corr) => corr.symbol),
      });

      return {
        id: clusterEvent.id,
        title: clusterEvent.title,
        source: clusterEvent.source,
        publishedAt: clusterEvent.publishedAt.toISOString(),
        severity: clusterEvent.severity,
        region: clusterEvent.region,
        whyThisMatters: timelineIntelligence.whyThisMatters ?? clusterEvent.whyThisMatters,
        correlations: clusterEvent.correlations,
        reliability: buildEventReliability({
          source: clusterEvent.source,
          supportingSourcesCount: clusterEvent.supportingSourcesCount,
          sourceReliability: clusterEvent.sourceReliability,
          intelligenceQuality: timelineIntelligence.intelligenceQuality,
          publishedAt: clusterEvent.publishedAt,
          sourceHealth: matchSourceHealth(sourceHealth.sources, clusterEvent.source),
        }),
      };
    });
    const nextWatch = [
      ...new Set(
        predictions
          .slice(0, 4)
          .map((prediction) => `${prediction.symbol}: ${prediction.direction} bias with ${Math.round(prediction.confidence * 100)}% confidence`)
          .concat(
            timeline
              .slice(0, 3)
              .map((item) => `${item.source}: ${item.title}`)
          )
      ),
    ].slice(0, 5);

    res.status(200).json({
      event: {
        ...event,
        category: intelligence.category,
        intelligenceQuality: intelligence.intelligenceQuality,
        whyThisMatters: intelligence.whyThisMatters,
        relevanceScore: intelligence.relevanceScore,
        cluster: narrative,
        reliability: eventReliability,
      },
      relatedCoverage: relatedCoverage.map((item) => ({
        ...item,
        reliability: buildEventReliability({
          source: item.source,
          supportingSourcesCount: item.supportingSourcesCount,
          sourceReliability: item.sourceReliability,
          publishedAt: item.publishedAt,
          sourceHealth: matchSourceHealth(sourceHealth.sources, item.source),
        }),
      })),
      timeline,
      predictions,
      nextWatch,
      trust: {
        supportingSourcesCount: event.supportingSourcesCount,
        sourceReliability: event.sourceReliability,
      },
    });
  } catch {
    sendPublicApiError(res, "Unable to load this event right now.");
  }
}
