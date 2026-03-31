# Professional Production Deployment Guide

## Overview

This guide ensures your GeoPulse deployment is production-ready, secure, and properly monitored. Follow all steps in order.

## Phase 1: Pre-Deployment (Local)

### 1.1 Run Pre-Deployment Checks
```bash
bash scripts/pre-deploy.sh
```

This validates:
- No exposed secrets in codebase
- All tests pass
- TypeScript compiles without errors
- Production build succeeds
- Stripe webhook handler configured
- Git working tree is clean

### 1.2 Verify Environment Variables Locally

Create `.env.local` with:
```
# Required for development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
APP_URL=http://localhost:3000
CRON_SECRET=generate-a-random-secret
```

Do NOT commit this file - it's in `.gitignore`

## Phase 2: Vercel Setup

### 2.1 Create Vercel Project
- Go to https://vercel.com/new
- Import your GitHub repository
- Select project root: `.`

### 2.2 Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

**Production Environment:**
Set these in Vercel dashboard (DO NOT commit real values):
```
DATABASE_URL=postgresql://...@pooler.supabase.com:6543/...?pgbouncer=true
DIRECT_URL=postgresql://...@supabase.com:5432/...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_public_...
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
APP_URL=https://your-domain.vercel.app
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_YEARLY=price_...
CRON_SECRET=generate-a-random-secret
ADMIN_EMAILS=founder@example.com
```

⚠️ **IMPORTANT:** These are templates. Replace `...` with actual values from your providers.
Do NOT commit real secrets - add to Vercel dashboard only.

### 2.3 Branch Protection

- Go to GitHub → Settings → Branches
- Add rule for `main`
- Enable:
  - Require pull request reviews (1)
  - Dismiss stale pull requests
  - Require status checks to pass
  - Require branches to be up to date

## Phase 3: Stripe Setup

### 3.1 Create Stripe Account
- https://dashboard.stripe.com

### 3.2 Create Webhook Endpoint
1. Go to: Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-domain.vercel.app/api/webhooks/stripe`
4. Events: Select
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
5. Copy signing secret → Add to Vercel as `STRIPE_WEBHOOK_SECRET`

### 3.3 Create Price Objects
In Stripe Dashboard → Products:
1. Create product "Premium Monthly"
   - Name: Premium Monthly
   - Pricing: $8/month
   - Get price ID → Add to Vercel as `STRIPE_PRICE_ID_MONTHLY`

2. Create product "Premium Yearly"
   - Name: Premium Yearly
   - Pricing: $79/year
   - Get price ID → Add to Vercel as `STRIPE_PRICE_ID_YEARLY`

## Phase 4: Database Migrations

### 4.1 Run Prisma Migrations
```bash
# Against production database
npx prisma migrate deploy --skip-generate
```

### 4.2 Verify Database Connection
```bash
# Test connection
npx prisma db execute --stdin < <(echo "SELECT NOW();")
```

## Phase 5: Deployment

### 5.1 Deploy to Vercel
```bash
# Option 1: Push to main branch (automatic)
git push origin main

# Option 2: Manual deployment via Vercel CLI
npm i -g vercel
vercel deploy --prod
```

### 5.2 Monitor Deployment
- Watch build logs at: https://vercel.com/dashboard
- Check for errors in: Deployments → [Latest] → Build Logs
- Verify: Deployments → [Latest] → Live URL works

## Phase 6: Post-Deployment Verification

### 6.1 Health Checks
```bash
# Status endpoint
curl https://your-domain.vercel.app/api/status

# Should return: { "status": "ok" }
```

### 6.2 Test Stripe Webhook
1. Go to: Stripe Dashboard → Developers → Webhooks
2. Click your endpoint
3. Click "Send test event"
4. Select "checkout.session.completed"
5. Verify Stripe shows: "Test message sent to endpoint"
6. Check your deployment logs for processing

### 6.3 Test Sign-Up Flow (if Turnstile enabled)
1. Visit https://your-domain.vercel.app
2. Sign up with test account
3. Complete Turnstile challenge
4. Verify account created in Supabase

### 6.4 Test Billing (if Stripe enabled)
1. Sign in with test account
2. Go to Settings → Billing
3. Click "Upgrade to Premium"
4. Complete Stripe checkout (use test cards)
5. Verify subscription created in Stripe dashboard
6. Verify database updated

## Phase 7: Monitoring & Maintenance

### 7.1 Set Up Monitoring
- Error tracking: Sentry, Datadog, or similar
- Logs: Vercel Analytics
- Uptime: StatusPage.io or similar

### 7.2 Key Rotation Schedule
- Stripe API keys: Quarterly
- Webhook secrets: Quarterly or on rotation
- CRON_SECRET: Quarterly
- Database passwords: Semi-annually

### 7.3 Regular Checks
- Weekly: Review error logs
- Monthly: Verify backups
- Quarterly: Security audit
- Quarterly: Update dependencies

## Troubleshooting

### "STRIPE_WEBHOOK_SECRET is not configured"
- Verify env var in Vercel dashboard
- Check exact name matches (case-sensitive)
- Redeploy after setting variables

### "Cannot read properties of undefined (reading 'email')"
- Usually USER authentication issue
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify JWT validation in auth middleware

### Webhook delivery failures
- Check Stripe webhook logs: Developers → Webhooks → Event Log
- Verify endpoint URL is correct and accessible
- Check for 200 response in logs
- Verify webhook secret matches

## Security Checklist

- [ ] No secrets visible in Vercel logs
- [ ] GitHub secret scanning enabled
- [ ] Push protection enabled
- [ ] Branch protection on main
- [ ] All env vars use values (not CHANGE_ME)
- [ ] Production uses `sk_live_` keys (not test)
- [ ] Database backups configured
- [ ] Monitoring/alerting configured

