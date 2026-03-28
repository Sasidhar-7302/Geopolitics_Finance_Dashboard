import { prisma } from "./prisma";

export const FEATURE_LIMITS = {
  freeAlerts: 3,
  freeSavedViews: 3,
  freeWatchlists: 1,
  freeDigestStories: 5,
  premiumMonthlyPrice: 8,
  premiumYearlyPrice: 79,
  betaUserThreshold: 1000,
} as const;

const ENTITLEMENT_KEYS = [
  "premium_insights",
  "saved_views",
  "unlimited_alerts",
  "unlimited_watchlists",
  "faster_market_refresh",
  "email_digest",
  "intraday_digest",
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export async function getProductState(userId: string) {
  const [userCount, subscription] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  const betaUnlocked = userCount < FEATURE_LIMITS.betaUserThreshold;
  const plan = subscription?.plan || "free";
  const premiumActive = plan === "premium";

  return {
    betaUnlocked,
    betaSpotsRemaining: Math.max(0, FEATURE_LIMITS.betaUserThreshold - userCount),
    registeredUsers: userCount,
    plan,
    premiumActive,
    billingEnabled: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_MONTHLY),
    upgradePreview: !premiumActive,
  };
}

export async function ensureDefaultEntitlements(userId: string) {
  const state = await getProductState(userId);
  const baseAccessKeys = new Set<EntitlementKey>(["saved_views", "email_digest"]);
  const source = state.premiumActive ? state.plan : state.betaUnlocked ? "beta" : "free";

  await prisma.entitlement.createMany({
    data: ENTITLEMENT_KEYS.map((key) => ({
      userId,
      key,
      enabled: state.premiumActive || baseAccessKeys.has(key),
      source,
    })),
    skipDuplicates: true,
  });

  if (state.premiumActive) {
    await prisma.entitlement.updateMany({
      where: { userId },
      data: {
        enabled: true,
        source,
      },
    });
  } else {
    await Promise.all([
      prisma.entitlement.updateMany({
        where: {
          userId,
          key: { in: Array.from(baseAccessKeys) },
        },
        data: {
          enabled: true,
          source,
        },
      }),
      prisma.entitlement.updateMany({
        where: {
          userId,
          key: { notIn: Array.from(baseAccessKeys) },
        },
        data: {
          enabled: false,
          source,
        },
      }),
    ]);
  }

  return getEntitlementSnapshot(userId);
}

export async function getEntitlementSnapshot(userId: string) {
  const [state, entitlements] = await Promise.all([
    getProductState(userId),
    prisma.entitlement.findMany({ where: { userId }, orderBy: { key: "asc" } }),
  ]);

  return {
    ...state,
    features: Object.fromEntries(entitlements.map((item) => [item.key, item.enabled])),
    limits: {
      alerts: state.premiumActive ? null : FEATURE_LIMITS.freeAlerts,
      savedViews: state.premiumActive ? null : FEATURE_LIMITS.freeSavedViews,
      watchlists: state.premiumActive ? null : FEATURE_LIMITS.freeWatchlists,
      digestStories: state.premiumActive ? 10 : FEATURE_LIMITS.freeDigestStories,
    },
  };
}
