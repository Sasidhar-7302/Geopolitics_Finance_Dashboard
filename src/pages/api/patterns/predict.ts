import type { NextApiRequest, NextApiResponse } from "next";
import { predictForEvent } from "../../../lib/correlation/predict";
import { applyPublicReadGuard, sendPublicApiError } from "../../../lib/publicApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (
    !(await applyPublicReadGuard({
      req,
      res,
      namespace: "pattern-predict-read",
      limit: 30,
      windowMs: 60 * 1000,
      cacheControl: "public, s-maxage=60, stale-while-revalidate=300",
      message: "Too many prediction requests. Try again later.",
    }))
  ) {
    return;
  }

  const eventId = req.query.eventId as string | undefined;
  if (!eventId) {
    res.status(400).json({ error: "eventId query parameter required" });
    return;
  }

  try {
    const predictions = await predictForEvent(eventId);
    res.status(200).json({ predictions });
  } catch {
    sendPublicApiError(res, "Unable to generate predictions right now.");
  }
}
