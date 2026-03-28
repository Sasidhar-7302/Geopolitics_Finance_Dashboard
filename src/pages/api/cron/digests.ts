import type { NextApiRequest, NextApiResponse } from "next";
import { sendDueDigests } from "../../../lib/digest";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const isVercelCron = req.headers["authorization"] === `Bearer ${process.env.CRON_SECRET}`;
  const isManualSecret = req.query.secret === process.env.CRON_SECRET;
  if (!isVercelCron && !isManualSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await sendDueDigests();
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
