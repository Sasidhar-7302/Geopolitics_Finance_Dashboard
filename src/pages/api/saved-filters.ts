import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { parseStringArray, stringifyStringArray } from "../../lib/json";
import { getEntitlementSnapshot } from "../../lib/entitlements";
import { requireApiUser } from "../../lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await requireApiUser(req, res);
  if (!currentUser) {
    return;
  }
  const { user } = currentUser;

  if (req.method === "GET") {
    const savedFilters = await prisma.savedFilter.findMany({
      where: { userId: user.id },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    res.status(200).json({
      savedFilters: savedFilters.map((item) => ({
        ...item,
        regions: parseStringArray(item.regions),
        categories: parseStringArray(item.categories),
        symbols: parseStringArray(item.symbols),
      })),
    });
    return;
  }

  if (req.method === "POST") {
    const entitlements = await getEntitlementSnapshot(user.id);
    const currentCount = await prisma.savedFilter.count({ where: { userId: user.id } });

    if (entitlements.limits.savedViews !== null && currentCount >= entitlements.limits.savedViews) {
      res.status(403).json({
        error: "Saved view limit reached on the free tier.",
        limit: entitlements.limits.savedViews,
      });
      return;
    }

    const {
      name,
      query,
      regions,
      categories,
      symbols,
      direction,
      severityMin,
      timeWindow,
      sortKey,
      isPinned,
    } = req.body as {
      name?: string;
      query?: string;
      regions?: string[];
      categories?: string[];
      symbols?: string[];
      direction?: string;
      severityMin?: number;
      timeWindow?: string;
      sortKey?: string;
      isPinned?: boolean;
    };

    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const savedFilter = await prisma.savedFilter.create({
      data: {
        userId: user.id,
        name,
        query,
        regions: stringifyStringArray(regions),
        categories: stringifyStringArray(categories),
        symbols: stringifyStringArray(symbols),
        direction: direction || "all",
        severityMin: severityMin ?? 0,
        timeWindow: timeWindow || "all",
        sortKey: sortKey || "relevance",
        isPinned: Boolean(isPinned),
      },
    });

    res.status(201).json({
      savedFilter: {
        ...savedFilter,
        regions: parseStringArray(savedFilter.regions),
        categories: parseStringArray(savedFilter.categories),
        symbols: parseStringArray(savedFilter.symbols),
      },
    });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id as string | undefined;
    if (!id) {
      res.status(400).json({ error: "Missing filter id" });
      return;
    }

    await prisma.savedFilter.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  res.status(405).json({ error: "Method not allowed" });
}
