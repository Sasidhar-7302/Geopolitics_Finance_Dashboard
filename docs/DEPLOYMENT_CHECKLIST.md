# Production Deployment Checklist

## Pre-Deployment Verification

### 1. Security & Secrets
- [ ] Run `npm run security:secrets` - verify no live keys are in tracked files
- [ ] Verify `.gitignore` includes all `.env.*` files
- [ ] Confirm no API keys in git history: `git log -p -- '*.env*' | grep -i key`
- [ ] Enable GitHub secret scanning and push protection in repository settings
- [ ] All secrets use placeholders in `.env.example`

### 2. Code Quality
- [ ] `npm run typecheck` passes with no errors
- [ ] `npm test` passes all tests
- [ ] No console.log statements with sensitive data
- [ ] All API routes verify authentication/authorization

### 3. Environment Variables Required
**Required for Stripe billing:**
- [ ] `STRIPE_SECRET_KEY` - Stripe API key (sk_live_... or sk_test_...)
- [ ] `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (whsec_...)
- [ ] `STRIPE_PRICE_ID_MONTHLY` - Monthly subscription price ID
- [ ] `STRIPE_PRICE_ID_YEARLY` - Yearly subscription price ID
- [ ] `APP_URL` - Production domain (https://your-domain.com)

**Required for Supabase:**
- [ ] `DATABASE_URL` - Pooled connection (port 6543)
- [ ] `DIRECT_URL` - Direct connection (port 5432)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Public key (safe to expose)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (NEVER expose)

**Optional but recommended:**
- [ ] `CRON_SECRET` - Protect cron endpoints
- [ ] `ADMIN_EMAILS` - Restrict admin routes
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Bot prevention
- [ ] `TURNSTILE_SECRET_KEY` - Bot verification

### 4. Vercel Configuration
- [ ] All environment variables set in Vercel dashboard
- [ ] No secrets in build logs or console output
- [ ] Production branch protection enabled
- [ ] GitHub integration connected and configured

### 5. Stripe Webhook Setup
- [ ] Webhook endpoint created: `https://your-domain.com/api/webhooks/stripe`
- [ ] Signing secret stored in `STRIPE_WEBHOOK_SECRET`
- [ ] Events subscribed:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
- [ ] Test webhook delivery succeeds with 200 response

### 6. Database
- [ ] Prisma migrations applied: `npx prisma migrate deploy`
- [ ] Database connection verified with production URL
- [ ] Backup configured in Supabase dashboard
- [ ] Point-in-time recovery enabled

### 7. Deployment
- [ ] Build succeeds: `npm run build`
- [ ] No runtime errors in development build
- [ ] Vercel deployment successful
- [ ] Live site loads without errors

## Post-Deployment Verification

- [ ] Health check: `curl https://your-domain.com/api/status`
- [ ] Webhook test: Send test event from Stripe dashboard
- [ ] Sign up flow works end-to-end
- [ ] Billing page loads and displays correctly
- [ ] Webhook events processed and database updated

## Monitoring & Maintenance

- [ ] Set up error tracking (Sentry recommended)
- [ ] Monitor Stripe webhook failures
- [ ] Review analytics/logs regularly
- [ ] Rotate secrets annually
- [ ] Keep dependencies updated
- [ ] Test disaster recovery monthly

