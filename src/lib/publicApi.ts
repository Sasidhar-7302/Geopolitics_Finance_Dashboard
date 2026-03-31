import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit, getRequestIp } from "./rateLimit";

export async function applyPublicReadGuard(params: {
  req: NextApiRequest;
  res: NextApiResponse;
  namespace: string;
  limit: number;
  windowMs: number;
  cacheControl?: string;
  message?: string;
}) {
  const {
    req,
    res,
    namespace,
    limit,
    windowMs,
    cacheControl = "public, s-maxage=30, stale-while-revalidate=120",
    message = "Too many requests. Try again later.",
  } = params;

  res.setHeader("Cache-Control", cacheControl);

  const result = await enforceRateLimit({
    req,
    res,
    namespace,
    key: getRequestIp(req),
    limit,
    windowMs,
  });

  if (!result.allowed) {
    res.status(429).json({ error: message });
    return false;
  }

  return true;
}

export function sendPublicApiError(
  res: NextApiResponse,
  message = "Unable to complete this request right now."
) {
  return res.status(500).json({ error: message });
}
