import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { enforceRateLimit, getRequestIp } from "../../../lib/rateLimit";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";
import { verifyLegacyUser } from "../../../lib/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const requestIp = getRequestIp(req);
  const ipLimit = await enforceRateLimit({
    req,
    res,
    namespace: "auth-migrate-ip",
    key: requestIp,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
    return;
  }

  const emailLimit = await enforceRateLimit({
    req,
    res,
    namespace: "auth-migrate-email",
    key: normalizedEmail,
    limit: 6,
    windowMs: 15 * 60 * 1000,
  });
  if (!emailLimit.allowed) {
    res.status(429).json({ error: "Too many sign-in attempts for this email. Try again later." });
    return;
  }

  const legacyUser = await verifyLegacyUser({
    email: normalizedEmail,
    password,
  });

  if (!legacyUser) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (legacyUser.supabaseAuthId) {
    res.status(200).json({ ok: true, alreadyLinked: true });
    return;
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: legacyUser.email,
    password,
    email_confirm: true,
    user_metadata: {
      name: legacyUser.name,
    },
  });

  if (error) {
    res.status(409).json({ error: "Legacy account migration could not be completed automatically." });
    return;
  }

  await prisma.user.update({
    where: { id: legacyUser.id },
    data: {
      supabaseAuthId: data.user.id,
    },
  });

  res.status(200).json({ ok: true });
}
