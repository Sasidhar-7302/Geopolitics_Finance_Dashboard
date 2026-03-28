import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
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

  const legacyUser = await verifyLegacyUser({
    email,
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
    res.status(409).json({ error: error.message });
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
