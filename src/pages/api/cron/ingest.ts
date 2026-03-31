import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthorizedCronRequest } from "../../../lib/cronAuth";
import { ingestEvents } from "../../../lib/ingest/events";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isAuthorizedCronRequest(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await ingestEvents();
    res.status(200).json({ ok: true, ingested: result.count, errors: result.errors });
  } catch (error) {
    res.status(500).json({ error: "Ingestion failed" });
  }
}
