import type { NextApiRequest, NextApiResponse } from "next";
import { ensureDefaultEntitlements, getEntitlementSnapshot } from "../../../lib/entitlements";
import { requireApiUser } from "../../../lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await requireApiUser(req, res);
  if (!currentUser) {
    return;
  }
  const { user } = currentUser;

  await ensureDefaultEntitlements(user.id);
  const snapshot = await getEntitlementSnapshot(user.id);
  res.status(200).json(snapshot);
}
