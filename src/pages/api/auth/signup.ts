import type { NextApiRequest, NextApiResponse } from "next";
import { FEATURE_LIMITS, ensureDefaultEntitlements } from "../../../lib/entitlements";
import { enforceRateLimit, getRequestIp } from "../../../lib/rateLimit";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";
import { verifyTurnstileToken } from "../../../lib/turnstile";
import { prisma } from "../../../lib/prisma";
import { bootstrapUserProductState } from "../../../lib/userBootstrap";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, email, password, website, formStartedAt, turnstileToken } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    website?: string;
    formStartedAt?: number;
    turnstileToken?: string;
    timezone?: string;
    digestHour?: number;
  };

  if (!name || !email || !password) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const requestIp = getRequestIp(req);

  if (website && website.trim().length > 0) {
    res.status(400).json({ error: "Unable to verify signup request." });
    return;
  }

  if (typeof formStartedAt === "number") {
    const submitAgeMs = Date.now() - formStartedAt;
    if (submitAgeMs < 1500) {
      res.status(400).json({ error: "Please take a moment to review the form and try again." });
      return;
    }
    if (submitAgeMs > 2 * 60 * 60 * 1000) {
      res.status(400).json({ error: "This signup form expired. Please refresh and try again." });
      return;
    }
  }

  const ipLimit = await enforceRateLimit({
    req,
    res,
    namespace: "auth-signup-ip",
    key: requestIp,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    res.status(429).json({ error: "Too many signup attempts. Try again later." });
    return;
  }

  const emailLimit = await enforceRateLimit({
    req,
    res,
    namespace: "auth-signup-email",
    key: normalizedEmail,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!emailLimit.allowed) {
    res.status(429).json({ error: "Too many signup attempts for this email. Try again later." });
    return;
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) {
    res.status(400).json({ error: "Name must be between 2 and 80 characters." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters long." });
    return;
  }

  const turnstileResult = await verifyTurnstileToken({
    token: turnstileToken,
    remoteIp: requestIp,
  });
  if (!turnstileResult.ok) {
    const statusCode = turnstileResult.message.includes("not configured") ? 503 : 400;
    res.status(statusCode).json({ error: turnstileResult.message });
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: trimmedName,
      },
    });

    if (error) {
      const normalizedMessage = error.message.toLowerCase();
      if (normalizedMessage.includes("already")) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      throw new Error("Unable to create account right now.");
    }

    try {
      const initialTimezone =
        typeof req.body?.timezone === "string" && req.body.timezone.trim().length > 0
          ? req.body.timezone.trim()
          : "UTC";
      const initialDigestHour =
        typeof req.body?.digestHour === "number" && req.body.digestHour >= 0 && req.body.digestHour <= 23
          ? req.body.digestHour
          : 7;

      const { user, isFoundingUser, trialEndDate } = await prisma.$transaction(async (tx) => {
        const userCount = await tx.user.count();
        const isFirstTenUser = userCount < FEATURE_LIMITS.foundingPremiumUsers;

        const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
          throw new Error("Email already registered");
        }

        const user = await tx.user.create({
          data: {
            name: trimmedName,
            email: normalizedEmail,
            supabaseAuthId: data.user.id,
          },
        });

        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + FEATURE_LIMITS.premiumTrialDays);

        await tx.subscription.create({
          data: isFirstTenUser
            ? {
                userId: user.id,
                provider: "founding",
                status: "lifetime",
                plan: "premium",
                billingInterval: "lifetime",
                currentPeriodEnd: null,
                trialEnd: null,
                cancelAtPeriodEnd: false,
              }
            : {
                userId: user.id,
                provider: "trial",
                status: "trialing",
                plan: "premium",
                billingInterval: "monthly",
                trialEnd: trialEndDate,
                cancelAtPeriodEnd: false,
              },
        });

        return {
          user,
          isFoundingUser: isFirstTenUser,
          trialEndDate,
        };
      }, {
        isolationLevel: "Serializable",
      });

      await bootstrapUserProductState(user.id, {
        timezone: initialTimezone,
        digestHour: initialDigestHour,
        deliveryChannels: ["email"],
      });
      await ensureDefaultEntitlements(user.id);

      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        user_metadata: {
          name: trimmedName,
          accessGrant: isFoundingUser ? "founding" : "trial",
          lifetimePremium: isFoundingUser,
          plan: isFoundingUser ? "premium" : undefined,
          trialEndsAt: isFoundingUser ? undefined : trialEndDate.toISOString(),
        },
      });
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      throw error;
    }

    res.status(201).json({ ok: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Email already registered") {
      res.status(409).json({ error: message });
      return;
    }

    res.status(500).json({ error: "Unable to create account right now." });
  }
}
