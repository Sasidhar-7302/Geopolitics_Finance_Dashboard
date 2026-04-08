import { prisma } from "./prisma";
import { ensureDefaultEntitlements } from "./entitlements";
import { stringifyStringArray } from "./json";
import { DEFAULT_WORKSPACE, serializeWorkspaceState } from "./workspace";

export async function bootstrapUserProductState(userId: string, options?: {
  timezone?: string;
  digestHour?: number;
  deliveryChannels?: string[];
}) {
  const timezone = options?.timezone || "UTC";
  const digestHour = options?.digestHour ?? 7;
  const channels = stringifyStringArray(options?.deliveryChannels ?? ["email"]);
  const preferenceUpdate = {
    ...(options?.timezone ? { timezone } : {}),
    ...(options?.digestHour !== undefined ? { digestHour } : {}),
    ...(options?.deliveryChannels ? { deliveryChannels: channels } : {}),
  };

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
      update: preferenceUpdate,
      create: {
        userId,
        timezone,
        digestHour,
        deliveryChannels: channels,
      },
    }),
    prisma.userPreference.upsert({
      where: { userId },
      update: preferenceUpdate,
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
    prisma.userWorkspace.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        ...serializeWorkspaceState(DEFAULT_WORKSPACE),
      },
    }),
  ]);

  await ensureDefaultEntitlements(userId);
}
