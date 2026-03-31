import type { NextApiRequest, NextApiResponse } from "next";
import { fetchMarketQuotes } from "../../../lib/market";
import { enforceRateLimit, getRequestIp } from "../../../lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestIp = getRequestIp(req);
  const rateLimit = await enforceRateLimit({
    req,
    res,
    namespace: "quotes-read",
    key: requestIp,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    res.status(429).json({ error: "Too many quote requests. Try again in a minute." });
    return;
  }

  const symbols = (req.query.symbols as string | undefined)?.split(",").filter(Boolean) || [];
  if (symbols.length === 0) {
    res.status(400).json({ error: "symbols query required" });
    return;
  }

  try {
    const result = await fetchMarketQuotes(symbols);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Unable to load market quotes right now." });
  }
}
