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
      namespace: "patterns-read",
      limit: 90,
      windowMs: 60 * 1000,
      cacheControl: "public, s-maxage=60, stale-while-revalidate=300",
    }))
  ) {
    return;
  }

  const { category, symbol } = req.query;

  const where: Record<string, unknown> = {};
  if (category && typeof category === "string") where.eventCategory = category;
  if (symbol && typeof symbol === "string") where.symbol = symbol;

  try {
    const patterns = await prisma.pattern.findMany({
      where,
      orderBy: { confidence: "desc" },
      take: 50,
    });

    res.status(200).json({ patterns });
  } catch {
    sendPublicApiError(res, "Unable to load pattern insights right now.");
  }
}
