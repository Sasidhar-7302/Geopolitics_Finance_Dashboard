import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { buildDigestDedupeKey, buildPersonalizedDigest, recordDigestDelivery } from "../../../lib/digest";
import { isAdminEmail } from "../../../lib/admin";
import { requireApiUser } from "../../../lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const currentUser = await requireApiUser(req, res);
  if (!currentUser) {
    return;
  }
  const { user: requestingUser } = currentUser;

  const { userId, previewOnly } = req.body as { userId?: string; previewOnly?: boolean };
  const targetUserId =
    userId && isAdminEmail(requestingUser.email) ? userId : requestingUser.id;
  const digest = await buildPersonalizedDigest(targetUserId);
  const subscription = await prisma.digestSubscription.findUnique({ where: { userId: targetUserId } });
  const dedupeKey = buildDigestDedupeKey(targetUserId, digest.timezone);

  const delivery = await recordDigestDelivery({
    userId: targetUserId,
    digestSubscriptionId: subscription?.id,
    payload: digest,
    status: previewOnly === false ? "simulated" : "preview",
    provider: previewOnly === false ? "simulated-email" : "preview",
    dedupeKey,
  });

  res.status(200).json({
    ok: true,
    previewOnly: previewOnly !== false,
    digest,
    delivery,
  });
}
