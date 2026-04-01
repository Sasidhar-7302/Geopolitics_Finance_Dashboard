import { prisma } from "./prisma";

export const FEATURE_LIMITS = {
  freeAlerts: 3,
  freeSavedViews: 3,
  freeWatchlists: 1,
  freeDigestStories: 5,
  premiumMonthlyPrice: 8,
  premiumYearlyPrice: 79,
  foundingPremiumUsers: 10,
  premiumTrialDays: 7,
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
  const foundingPremiumSpotsRemaining = Math.max(0, FEATURE_LIMITS.foundingPremiumUsers - userCount);
  const lifetimeAccess =
    subscription?.status === "lifetime" ||
    subscription?.billingInterval === "lifetime" ||
    subscription?.provider === "founding";

  // Determine plan: check if trial expired
  let plan = subscription?.plan || "free";
  let premiumActive = lifetimeAccess || plan === "premium" || plan === "lifetime";
  let onTrial = false;
  let trialDaysRemaining: number | null = null;

  // Check if user has an active trial
  if (subscription?.status === "trialing" && subscription?.trialEnd) {
    const now = new Date();
    if (now < subscription.trialEnd) {
      // Trial is still active, grant premium benefits
      plan = "premium";
      onTrial = true;
      premiumActive = true;
      trialDaysRemaining = Math.max(
        1,
        Math.ceil((subscription.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
    } else {
      // Trial has expired, convert to free
      plan = "free";
      premiumActive = false;
      // Update subscription status
      await prisma.subscription.update({
        where: { userId },
        data: {
          status: "free",
          plan: "free",
          trialEnd: null,
        },
      });
    }
  }

  const accessLabel = onTrial
    ? "Premium trial"
    : lifetimeAccess
    ? "Lifetime premium"
    : premiumActive
    ? "Premium"
    : betaUnlocked
    ? "Free beta"
    : "Free";

  const billingEnabled = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_MONTHLY);
  const canManageBilling =
    billingEnabled &&
    !lifetimeAccess &&
    subscription?.provider === "stripe" &&
    Boolean(subscription?.customerId);

  return {
    betaUnlocked,
    betaSpotsRemaining: Math.max(0, FEATURE_LIMITS.betaUserThreshold - userCount),
    foundingPremiumSpotsRemaining,
    registeredUsers: userCount,
    plan,
    premiumActive,
    lifetimeAccess,
    onTrial,
    trialDaysRemaining,
    accessLabel,
    billingEnabled,
    canManageBilling,
    subscriptionStatus: subscription?.status ?? null,
    billingInterval: subscription?.billingInterval ?? null,
    subscriptionProvider: subscription?.provider ?? null,
    upgradePreview: onTrial || !premiumActive,
  };
}

export async function ensureDefaultEntitlements(userId: string) {
  const state = await getProductState(userId);
  const baseAccessKeys = new Set<EntitlementKey>(["saved_views", "email_digest"]);
  const source = state.onTrial ? "trial" : state.premiumActive ? state.plan : state.betaUnlocked ? "beta" : "free";

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
