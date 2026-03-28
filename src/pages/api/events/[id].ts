import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { summarizeEventIntelligence } from "../../../lib/intelligence";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: { correlations: true },
  });

  if (!event) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const relatedCoverage = event.duplicateClusterId
    ? await prisma.event.findMany({
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
        },
        orderBy: { publishedAt: "desc" },
        take: 5,
      })
    : [];

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

  res.status(200).json({
    event: {
      ...event,
      category: intelligence.category,
      whyThisMatters: intelligence.whyThisMatters,
      relevanceScore: intelligence.relevanceScore,
    },
    relatedCoverage,
    trust: {
      supportingSourcesCount: event.supportingSourcesCount,
      sourceReliability: event.sourceReliability,
    },
  });
}
