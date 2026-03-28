import type { NextApiRequest, NextApiResponse } from "next";
import { getEntitlementSnapshot } from "../../../lib/entitlements";
import { prisma } from "../../../lib/prisma";
import { requireApiUser } from "../../../lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await requireApiUser(req, res);
  if (!currentUser) {
    return;
  }
  const { user } = currentUser;

  if (req.method === "GET") {
    const lists = await prisma.watchlist.findMany({
      where: { userId: user.id },
      include: { items: true },
    });
    res.status(200).json({ watchlists: lists });
    return;
  }

  if (req.method === "POST") {
    const entitlements = await getEntitlementSnapshot(user.id);
    const count = await prisma.watchlist.count({ where: { userId: user.id } });
    if (entitlements.limits.watchlists !== null && count >= entitlements.limits.watchlists) {
      res.status(403).json({
        error: "Watchlist limit reached on the free tier.",
        limit: entitlements.limits.watchlists,
      });
      return;
    }

    const { name } = req.body as { name?: string };
    const list = await prisma.watchlist.create({
      data: {
        name: name || "Watchlist",
        userId: user.id,
      },
    });
    res.status(201).json({ watchlist: list });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
