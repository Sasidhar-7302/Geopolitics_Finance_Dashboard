import type { NextApiRequest, NextApiResponse } from "next";
import { createLocalUser } from "../../../lib/auth";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    timezone?: string;
    digestHour?: number;
  };

  if (!name || !email || !password) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    await createLocalUser({
      name,
      email: normalizedEmail,
      supabaseAuthId: data.user.id,
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}
