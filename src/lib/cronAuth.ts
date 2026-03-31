import crypto from "node:crypto";
import type { NextApiRequest } from "next";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthorizedCronRequest(req: NextApiRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization;

  if (!expectedSecret || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  const providedSecret = authorization.slice("Bearer ".length);
  return safeEqual(providedSecret, expectedSecret);
}
