# Stripe Billing Guide

GeoPulse already uses hosted Stripe Checkout for subscriptions and the Stripe Customer Portal for self-service billing changes. There is no custom card form in the app, so you do not need a publishable key for the current flow.

## What GeoPulse needs from Stripe

Set these environment variables in your deployment:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_PRICE_ID_YEARLY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL`

## Stripe dashboard setup

1. Create one product for `GeoPulse Premium`.
2. Create two recurring prices on that product:
   - monthly: `$8/month`
   - yearly: `$79/year`
3. Copy both Stripe Price IDs into:
   - `STRIPE_PRICE_ID_MONTHLY`
   - `STRIPE_PRICE_ID_YEARLY`
4. Enable the Stripe Customer Portal so users can manage payment methods, renewals, and cancellations.
5. Create a webhook endpoint that points to:
   - `https://YOUR_DOMAIN/api/webhooks/stripe`
6. Subscribe the webhook to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## What I need from you

To finish the connection in your live environment, I need one of these:

- access to your Stripe dashboard so I can create the product, prices, portal, and webhook for you
- or the 4 values below so I can wire them into Vercel:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PRICE_ID_MONTHLY`
  - `STRIPE_PRICE_ID_YEARLY`
  - `STRIPE_WEBHOOK_SECRET`

## Recommended rollout

1. Set everything up in Stripe test mode first.
2. Point the webhook at your preview or production domain.
3. Verify:
   - checkout opens
   - the webhook marks the user subscription as premium
   - the billing portal opens
   - cancellation and renewal events sync back into GeoPulse
4. Repeat the same steps with live keys when you are ready to charge real customers.

## Current app endpoints

- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/webhooks/stripe`
