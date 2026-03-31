import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthorizedCronRequest } from "../../../lib/cronAuth";
import { sendDueDigests } from "../../../lib/digest";

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
    const result = await sendDueDigests();
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: "Digest processing failed" });
  }
}
