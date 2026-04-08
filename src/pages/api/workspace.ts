import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { getEntitlementSnapshot } from "../../lib/entitlements";
import { requireApiUser } from "../../lib/serverAuth";
import { bootstrapUserProductState } from "../../lib/userBootstrap";
import {
  DEFAULT_WORKSPACE,
  mergeWorkspaceState,
  parseWorkspaceRecord,
  serializeWorkspaceState,
} from "../../lib/workspace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await requireApiUser(req, res);
  if (!currentUser) return;
  const { user } = currentUser;

  await bootstrapUserProductState(user.id);

  const entitlements = await getEntitlementSnapshot(user.id);

  if (req.method === "GET") {
    const workspace = await prisma.userWorkspace.findUnique({
      where: { userId: user.id },
    });

    return res.json({
      workspace: parseWorkspaceRecord(workspace, { premiumActive: entitlements.premiumActive }),
      limits: {
        pinnedEntities: entitlements.premiumActive ? 10 : 4,
      },
    });
  }

  if (req.method === "PUT") {
    const existing = await prisma.userWorkspace.findUnique({
      where: { userId: user.id },
    });
    const current = parseWorkspaceRecord(existing, { premiumActive: entitlements.premiumActive });
    const nextState = mergeWorkspaceState(current || DEFAULT_WORKSPACE, req.body || {}, {
      premiumActive: entitlements.premiumActive,
    });

    const workspace = await prisma.userWorkspace.upsert({
      where: { userId: user.id },
      update: serializeWorkspaceState(nextState),
      create: {
        userId: user.id,
        ...serializeWorkspaceState(nextState),
      },
    });

    return res.json({
      workspace: parseWorkspaceRecord(workspace, { premiumActive: entitlements.premiumActive }),
      limits: {
        pinnedEntities: entitlements.premiumActive ? 10 : 4,
      },
    });
  }

  res.setHeader("Allow", "GET, PUT");
  res.status(405).json({ error: "Method not allowed" });
}
