import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { buildEventOrderBy, buildEventWhere, parseArrayParam } from "../../lib/eventFilters";
import { summarizeEventIntelligence } from "../../lib/intelligence";
import { applyPublicReadGuard, sendPublicApiError } from "../../lib/publicApi";

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
      namespace: "events-read",
      limit: 120,
      windowMs: 60 * 1000,
      cacheControl: "public, s-maxage=30, stale-while-revalidate=180",
    }))
  ) {
    return;
  }

  const limit = Math.min(Number(req.query.limit || req.query.take) || 20, 50);
  const cursor = req.query.cursor as string | undefined;
  const sort = (req.query.sort as "newest" | "severity" | "relevance" | "support" | undefined) || "relevance";
  const where = buildEventWhere({
    q: req.query.q as string | undefined,
    regions: parseArrayParam(req.query.regions as string | string[] | undefined).concat(
      parseArrayParam(req.query.region as string | string[] | undefined)
    ),
    categories: parseArrayParam(req.query.categories as string | string[] | undefined).concat(
      parseArrayParam(req.query.category as string | string[] | undefined)
    ),
    symbols: parseArrayParam(req.query.symbols as string | string[] | undefined),
    direction: (req.query.direction as string | undefined) || "all",
    severityMin: Number(req.query.severityMin || req.query.severity || 0) || 0,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    timeWindow: req.query.timeWindow as string | undefined,
    sort,
    limit,
    cursor,
  });

  try {
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        orderBy: buildEventOrderBy(sort),
        take: limit + 1,
        where,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          correlations: {
            select: {
              id: true,
              symbol: true,
              impactScore: true,
              impactDirection: true,
              impactMagnitude: true,
              window: true,
              category: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;
    const enrichedPage = page.map((event) => {
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
        ...event,
        category: intelligence.category,
        intelligenceQuality: intelligence.intelligenceQuality,
        whyThisMatters: intelligence.whyThisMatters,
        relevanceScore: intelligence.relevanceScore,
      };
    });

    res.status(200).json({
      events: enrichedPage,
      pagination: {
        limit,
        nextCursor,
        hasMore,
        total,
      },
    });
  } catch {
    sendPublicApiError(res, "Unable to load events right now.");
  }
}
