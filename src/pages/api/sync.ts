import type { NextApiRequest, NextApiResponse } from "next";
import { ingestEvents } from "../../lib/ingest/events";
import { isAdminEmail } from "../../lib/admin";
import { requireApiUser } from "../../lib/serverAuth";

/**
 * Manual sync endpoint - triggers ingestion for authenticated users.
 * No CRON_SECRET required, just an active session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const currentUser = await requireApiUser(req, res);
  if (!currentUser) {
    return;
  }
  if (!isAdminEmail(currentUser.user.email)) {
    res.status(403).json({ error: "Only admins can trigger sync in this environment" });
    return;
  }

  try {
    const result = await ingestEvents();
    res.status(200).json({ ok: true, ingested: result.count, errors: result.errors });
  } catch {
    res.status(500).json({ error: "Ingestion failed" });
  }
}
