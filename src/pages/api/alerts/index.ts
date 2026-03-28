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
    const alerts = await prisma.alert.findMany({ where: { userId: user.id } });
    res.status(200).json({ alerts });
    return;
  }

  if (req.method === "POST") {
    const entitlements = await getEntitlementSnapshot(user.id);
    const currentAlerts = await prisma.alert.count({ where: { userId: user.id } });
    if (entitlements.limits.alerts !== null && currentAlerts >= entitlements.limits.alerts) {
      res.status(403).json({
        error: "Alert limit reached on the free tier.",
        limit: entitlements.limits.alerts,
      });
      return;
    }

    const { name, condition } = req.body as { name?: string; condition?: string };
    if (!name || !condition) {
      res.status(400).json({ error: "Missing fields" });
      return;
    }
    const alert = await prisma.alert.create({
      data: {
        userId: user.id,
        name,
        condition,
        status: "armed",
      },
    });
    res.status(201).json({ alert });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
