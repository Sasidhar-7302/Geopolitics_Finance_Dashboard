import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateDefaultWatchlist } from "../../../lib/watchlists";
import { prisma } from "../../../lib/prisma";
import { requireApiUser } from "../../../lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await requireApiUser(req, res);
  if (!currentUser) {
    return;
  }
  const { user } = currentUser;

  const watchlist = await getOrCreateDefaultWatchlist(user.id);

  if (req.method === "POST") {
    const { symbol, name, assetClass } = req.body as {
      symbol?: string;
      name?: string;
      assetClass?: string;
    };
    if (!symbol || !name || !assetClass) {
      res.status(400).json({ error: "Missing fields" });
      return;
    }

    const item = await prisma.watchlistItem.create({
      data: {
        symbol,
        name,
        assetClass,
        watchlistId: watchlist.id,
      },
    });

    res.status(201).json({ item });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
