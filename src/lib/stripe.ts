import Stripe from "stripe";
import { ensureDefaultEntitlements } from "./entitlements";
import { prisma } from "./prisma";

let stripe: Stripe | null = null;

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return stripe;
}

export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const existing = await prisma.subscription.findFirst({
    where: {
      OR: [
        { providerSubscriptionId: subscription.id },
        { customerId },
      ],
    },
  });

  if (!existing) {
    return null;
  }

  const hasPremiumPrice = subscription.items.data.some(
    (item) =>
      item.price.id === process.env.STRIPE_PRICE_ID_YEARLY ||
      item.price.id === process.env.STRIPE_PRICE_ID_MONTHLY
  );
  const premiumStatuses = new Set<Stripe.Subscription.Status>([
    "active",
    "trialing",
  ]);
  const plan =
    hasPremiumPrice && premiumStatuses.has(subscription.status)
      ? "premium"
      : "free";

  const updated = await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      provider: "stripe",
      customerId,
      providerSubscriptionId: subscription.id,
      status: subscription.status,
      plan,
      billingInterval: subscription.items.data[0]?.price.recurring?.interval || existing.billingInterval,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : existing.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  await Promise.all([
    prisma.userPreference.updateMany({
      where: { userId: updated.userId },
      data: {
        plan,
      },
    }),
  ]);

  await ensureDefaultEntitlements(updated.userId);

  return updated;
}

export async function linkStripeCustomerToUser(userId: string, customerId: string) {
  return prisma.subscription.upsert({
    where: { userId },
    update: {
      customerId,
      provider: "stripe",
    },
    create: {
      userId,
      customerId,
      provider: "stripe",
      status: "trialing",
      plan: "free",
    },
  });
}
