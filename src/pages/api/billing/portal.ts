import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getStripeClient } from "../../../lib/stripe";
import { getAppUrl } from "../../../lib/supabase";
import { requireApiUser } from "../../../lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stripe = getStripeClient();
  const appUrl = getAppUrl();
  if (!stripe || !appUrl) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const currentUser = await requireApiUser(req, res);
  if (!currentUser) {
    return;
  }
  const { user } = currentUser;

  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!subscription?.customerId) {
    res.status(400).json({ error: "No Stripe customer is linked yet" });
    return;
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.customerId,
    return_url: `${appUrl}/settings`,
  });

  res.status(200).json({ url: portal.url });
}
