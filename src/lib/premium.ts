import { prisma } from "./prisma";
import { ensureDefaultEntitlements } from "./entitlements";

export async function grantLifetimePremium(userId: string) {
  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      provider: "manual",
      status: "lifetime",
      plan: "premium",
      billingInterval: "lifetime",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    create: {
      userId,
      provider: "manual",
      status: "lifetime",
      plan: "premium",
      billingInterval: "lifetime",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });

  await prisma.userPreference.updateMany({
    where: { userId },
    data: {
      plan: "premium",
      onboarded: true,
    },
  });

  await prisma.digestSubscription.updateMany({
    where: { userId },
    data: {
      enabled: true,
      topStories: 10,
    },
  });

  await ensureDefaultEntitlements(userId);

  return subscription;
}
