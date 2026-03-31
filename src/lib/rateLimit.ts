import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "./prisma";

declare global {
  // eslint-disable-next-line no-var
  var geoPulseRateLimitSweepCounter: number | undefined;
}

const SWEEP_INTERVAL = 200;

function setRateLimitHeaders(params: {
  res: NextApiResponse;
  limit: number;
  remaining: number;
  retryAfterSeconds?: number;
}) {
  const { res, limit, remaining, retryAfterSeconds } = params;
  res.setHeader("X-RateLimit-Limit", limit.toString());
  res.setHeader("X-RateLimit-Remaining", Math.max(remaining, 0).toString());

  if (typeof retryAfterSeconds === "number") {
    res.setHeader("Retry-After", retryAfterSeconds.toString());
  }
}

function maybeSweepExpiredBuckets() {
  const nextCount = (global.geoPulseRateLimitSweepCounter ?? 0) + 1;
  global.geoPulseRateLimitSweepCounter = nextCount;

  if (nextCount % SWEEP_INTERVAL === 0) {
    void prisma.apiRateLimit.deleteMany({
      where: {
        resetAt: { lte: new Date() },
      },
    }).catch(() => undefined);
  }
}

export function getRequestIp(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  }

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const realIp = req.headers["x-real-ip"];
  if (Array.isArray(realIp)) {
    return realIp[0] || "unknown";
  }

  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp;
  }

  return req.socket.remoteAddress || "unknown";
}

export async function enforceRateLimit(params: {
  req: NextApiRequest;
  res: NextApiResponse;
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
}) {
  const { res, namespace, key, limit, windowMs } = params;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  maybeSweepExpiredBuckets();

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "ApiRateLimit" ("namespace", "identifier", "count", "resetAt", "createdAt", "updatedAt")
      VALUES (${namespace}, ${key}, 1, ${resetAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("namespace", "identifier")
      DO UPDATE SET
        "count" = CASE
          WHEN "ApiRateLimit"."resetAt" <= ${now} THEN 1
          ELSE "ApiRateLimit"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "ApiRateLimit"."resetAt" <= ${now} THEN ${resetAt}
          ELSE "ApiRateLimit"."resetAt"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "count", "resetAt"
    `;

    const bucket = rows[0];
    const remaining = Math.max(limit - bucket.count, 0);

    if (bucket.count > limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)
      );
      setRateLimitHeaders({
        res,
        limit,
        remaining: 0,
        retryAfterSeconds,
      });

      return {
        allowed: false,
        retryAfterSeconds,
      };
    }

    setRateLimitHeaders({
      res,
      limit,
      remaining,
    });

    return { allowed: true };
  } catch {
    // Fail open if the limiter store itself is unavailable; request handlers still retain auth checks.
    setRateLimitHeaders({
      res,
      limit,
      remaining: Math.max(limit - 1, 0),
    });
    return { allowed: true, degraded: true };
  }
}
