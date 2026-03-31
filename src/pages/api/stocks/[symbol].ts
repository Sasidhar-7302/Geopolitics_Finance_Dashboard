import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
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
      namespace: "stock-read",
      limit: 90,
      windowMs: 60 * 1000,
      cacheControl: "public, s-maxage=60, stale-while-revalidate=300",
    }))
  ) {
    return;
  }

  const { symbol } = req.query as { symbol: string };
  if (!symbol) {
    res.status(400).json({ error: "Missing symbol" });
    return;
  }

  try {
    // Get all correlations for this symbol, including the event data
    const correlations = await prisma.correlation.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { event: { publishedAt: "desc" } },
      take: 50,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            summary: true,
            source: true,
            region: true,
            countryCode: true,
            publishedAt: true,
            severity: true,
            url: true,
          },
        },
      },
    });

    // Get patterns for this symbol
    const patterns = await prisma.pattern.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { confidence: "desc" },
    });

    res.status(200).json({ symbol: symbol.toUpperCase(), correlations, patterns });
  } catch {
    sendPublicApiError(res, "Unable to load this asset right now.");
  }
}
