import { prisma } from "./prisma";
import { ensureDefaultEntitlements } from "./entitlements";
import { stringifyStringArray } from "./json";

export async function bootstrapUserProductState(userId: string, options?: {
  timezone?: string;
  digestHour?: number;
  deliveryChannels?: string[];
}) {
  const timezone = options?.timezone || "UTC";
  const digestHour = options?.digestHour ?? 7;
  const channels = stringifyStringArray(options?.deliveryChannels ?? ["email"]);

  await Promise.all([
    prisma.subscription.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        status: "beta",
        plan: "free",
        billingInterval: "monthly",
      },
    }),
    prisma.digestSubscription.upsert({
      where: { userId },
      update: {
        timezone,
        digestHour,
        deliveryChannels: channels,
      },
      create: {
        userId,
        timezone,
        digestHour,
        deliveryChannels: channels,
      },
    }),
    prisma.userPreference.upsert({
      where: { userId },
      update: {
        timezone,
        digestHour,
        deliveryChannels: channels,
      },
      create: {
        userId,
        categories: "[]",
        regions: "[]",
        symbols: "[]",
        timezone,
        digestHour,
        deliveryChannels: channels,
      },
    }),
  ]);

  await ensureDefaultEntitlements(userId);
}
