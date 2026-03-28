import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { parseStringArray, stringifyStringArray } from "../../lib/json";
import { bootstrapUserProductState } from "../../lib/userBootstrap";
import { requireApiUser } from "../../lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await requireApiUser(req, res);
  if (!currentUser) return;
  const { user } = currentUser;

  await bootstrapUserProductState(user.id);

  if (req.method === "GET") {
    const [pref, digest, subscription] = await Promise.all([
      prisma.userPreference.findUnique({ where: { userId: user.id } }),
      prisma.digestSubscription.findUnique({ where: { userId: user.id } }),
      prisma.subscription.findUnique({ where: { userId: user.id } }),
    ]);

    if (!pref) {
      return res.json({
        categories: [],
        regions: [],
        symbols: [],
        onboarded: false,
        timezone: digest?.timezone || "UTC",
        digestHour: digest?.digestHour || 7,
        emailDigestEnabled: digest?.enabled ?? true,
        deliveryChannels: parseStringArray(digest?.deliveryChannels),
        savedViewsEnabled: true,
        plan: subscription?.plan || "free",
      });
    }

    return res.json({
      categories: parseStringArray(pref.categories),
      regions: parseStringArray(pref.regions),
      symbols: parseStringArray(pref.symbols),
      onboarded: pref.onboarded,
      timezone: pref.timezone,
      digestHour: pref.digestHour,
      emailDigestEnabled: pref.emailDigestEnabled,
      deliveryChannels: parseStringArray(pref.deliveryChannels),
      savedViewsEnabled: pref.savedViewsEnabled,
      plan: pref.plan,
    });
  }

  if (req.method === "POST" || req.method === "PUT") {
    const {
      categories,
      regions,
      symbols,
      timezone,
      digestHour,
      emailDigestEnabled,
      deliveryChannels,
      savedViewsEnabled,
      plan,
    } = req.body as {
      categories?: string[];
      regions?: string[];
      symbols?: string[];
      timezone?: string;
      digestHour?: number;
      emailDigestEnabled?: boolean;
      deliveryChannels?: string[];
      savedViewsEnabled?: boolean;
      plan?: string;
    };

    const [pref] = await Promise.all([
      prisma.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        categories: stringifyStringArray(categories || []),
        regions: stringifyStringArray(regions || []),
        symbols: stringifyStringArray(symbols || []),
        onboarded: true,
        timezone: timezone || "UTC",
        digestHour: digestHour ?? 7,
        emailDigestEnabled: emailDigestEnabled ?? true,
        deliveryChannels: stringifyStringArray(deliveryChannels || ["email"]),
        savedViewsEnabled: savedViewsEnabled ?? true,
        plan: plan || "free",
      },
      update: {
        categories: stringifyStringArray(categories || []),
        regions: stringifyStringArray(regions || []),
        symbols: stringifyStringArray(symbols || []),
        onboarded: true,
        timezone: timezone || undefined,
        digestHour: typeof digestHour === "number" ? digestHour : undefined,
        emailDigestEnabled: typeof emailDigestEnabled === "boolean" ? emailDigestEnabled : undefined,
        deliveryChannels: deliveryChannels ? stringifyStringArray(deliveryChannels) : undefined,
        savedViewsEnabled: typeof savedViewsEnabled === "boolean" ? savedViewsEnabled : undefined,
        plan: plan || undefined,
      },
      }),
      prisma.digestSubscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          enabled: emailDigestEnabled ?? true,
          digestHour: digestHour ?? 7,
          timezone: timezone || "UTC",
          deliveryChannels: stringifyStringArray(deliveryChannels || ["email"]),
        },
        update: {
          enabled: typeof emailDigestEnabled === "boolean" ? emailDigestEnabled : undefined,
          digestHour: typeof digestHour === "number" ? digestHour : undefined,
          timezone: timezone || undefined,
          deliveryChannels: deliveryChannels ? stringifyStringArray(deliveryChannels) : undefined,
        },
      }),
      prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          status: "beta",
          plan: plan || "free",
        },
        update: {
          plan: plan || undefined,
        },
      }),
    ]);

    return res.json({
      categories: parseStringArray(pref.categories),
      regions: parseStringArray(pref.regions),
      symbols: parseStringArray(pref.symbols),
      onboarded: pref.onboarded,
      timezone: pref.timezone,
      digestHour: pref.digestHour,
      emailDigestEnabled: pref.emailDigestEnabled,
      deliveryChannels: parseStringArray(pref.deliveryChannels),
      savedViewsEnabled: pref.savedViewsEnabled,
      plan: pref.plan,
    });
  }

  res.setHeader("Allow", "GET, POST, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
