import type { NextApiRequest, NextApiResponse } from "next";
import { getRiskOverview } from "../../../lib/risk";
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
      namespace: "risk-overview-read",
      limit: 60,
      windowMs: 60 * 1000,
      cacheControl: "public, s-maxage=60, stale-while-revalidate=300",
    }))
  ) {
    return;
  }

  try {
    const window = typeof req.query.window === "string" ? req.query.window : "72h";
    const overview = await getRiskOverview(window);
    res.status(200).json(overview);
  } catch {
    sendPublicApiError(res, "Unable to load the risk overview right now.");
  }
}
