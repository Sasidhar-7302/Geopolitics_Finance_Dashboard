import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getStripeClient, linkStripeCustomerToUser } from "../../../lib/stripe";
import { getAppUrl } from "../../../lib/supabase";
import { requireApiUser } from "../../../lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stripe = getStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const currentUser = await requireApiUser(req, res);
  if (!currentUser) {
    return;
  }
  const { user } = currentUser;

  const { interval } = req.body as { interval?: "monthly" | "yearly" };
  const priceId = interval === "yearly" ? process.env.STRIPE_PRICE_ID_YEARLY : process.env.STRIPE_PRICE_ID_MONTHLY;
  const appUrl = getAppUrl();
  if (!priceId || !appUrl) {
    res.status(503).json({ error: "Stripe pricing is not configured" });
    return;
  }

  let subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!subscription?.customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id,
      },
    });
    subscription = await linkStripeCustomerToUser(user.id, customer.id);
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: subscription.customerId || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?billing=success`,
    cancel_url: `${appUrl}/settings?billing=cancelled`,
    allow_promotion_codes: true,
    metadata: {
      userId: user.id,
      interval: interval || "monthly",
    },
  });

  res.status(200).json({ url: checkout.url });
}
