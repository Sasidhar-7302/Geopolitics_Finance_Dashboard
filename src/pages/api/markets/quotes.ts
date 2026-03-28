import type { NextApiRequest, NextApiResponse } from "next";
import { fetchMarketQuotes } from "../../../lib/market";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const symbols = (req.query.symbols as string | undefined)?.split(",").filter(Boolean) || [];
  if (symbols.length === 0) {
    res.status(400).json({ error: "symbols query required" });
    return;
  }

  try {
    const result = await fetchMarketQuotes(symbols);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
