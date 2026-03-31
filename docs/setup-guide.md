# GeoPulse Setup Guide

## Prerequisites

- Node.js 20+
- npm
- Supabase PostgreSQL
- Git

Optional but supported:

- Stripe account and price IDs for billing
- TwelveData API key for provider-backed quotes
- Cloudflare Turnstile for production signup verification

## Quick Start

```bash
git clone <repo-url> GPF_Dashboard
cd GPF_Dashboard
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

The app runs at `http://localhost:3000`.

## Environment Variables

Required:

```env
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...pooler.supabase.com:5432/postgres"
APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
CRON_SECRET="generate-a-random-secret"
```

Optional:

```env
ADMIN_EMAILS="founder@example.com,ops@example.com"
NEWS_RSS_FEEDS="https://feeds.bbci.co.uk/news/world/rss.xml,https://www.aljazeera.com/xml/rss/all.xml"
GDELT_QUERY="conflict OR sanctions OR election OR protest"
TWELVEDATA_API_KEY="..."
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4AAAA..."
TURNSTILE_SECRET_KEY="0x4AAAA..."
STRIPE_SECRET_KEY="..."
STRIPE_PRICE_ID_MONTHLY="price_..."
STRIPE_PRICE_ID_YEARLY="price_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Notes:

- `DATABASE_URL` should use the Supabase transaction pooler on port `6543`
- `DIRECT_URL` should use the direct/session connection on port `5432`
- `NEXT_PUBLIC_SUPABASE_URL` should match your Supabase project reference, e.g. `https://your-project-ref.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` is required because GeoPulse creates auth users server-side and migrates legacy local-password accounts into Supabase Auth on first sign-in
- `ADMIN_EMAILS` should be set in production; admin-only routes are denied if it is missing
- `TWELVEDATA_API_KEY` is optional, but without it GeoPulse can only serve the latest stored snapshots
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` should be treated as required for any public production signup flow

## Database Workflow

Checked-in Prisma migrations live under `prisma/migrations`.

Common commands:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma migrate dev --name your_change_name
npx prisma studio
```

## Development Commands

```bash
npm run dev
npm run security:secrets
npm run typecheck
npm run build
```

Notes:

- `npm run lint` currently aliases to `npm run typecheck`
- `npm run security:secrets` scans tracked files for obvious credential leaks before you push
- `npm run build` runs `prisma generate` and then `next build`

## Manual Admin Actions

Manual ingestion:

```bash
curl -X POST http://localhost:3000/api/sync \
  --cookie "<authenticated-session-cookie>"
```

Cron-style ingestion:

```bash
curl -X POST http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Digest processing:

```bash
curl -X POST http://localhost:3000/api/cron/digests \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Cron endpoints accept bearer auth only. Query-string secrets are intentionally rejected.

`/api/sync` is intentionally admin-only. In local development it works without `ADMIN_EMAILS`; in production you must configure `ADMIN_EMAILS`.

## Deploying to Vercel

### 1. Import the repository

Vercel detects this as a Next.js project automatically.

### 2. Add environment variables

Required in Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `ADMIN_EMAILS`

Optional in Vercel:

- `TWELVEDATA_API_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_PRICE_ID_YEARLY`
- `STRIPE_WEBHOOK_SECRET`
- `NEWS_RSS_FEEDS`
- `GDELT_QUERY`

### 3. Run production migrations

Before the first production deployment:

```bash
npx prisma migrate deploy
```

Do this from your machine or CI against the production database.

### 4. Deploy

Once env vars are set and migrations are applied, Vercel builds normally.

### 5. Run launch smoke checks

For a local production build:

```bash
npm test
npm run build
npm start
BASE_URL=http://127.0.0.1:3000 npm run smoke:beta
```

For a deployed environment, point `BASE_URL` at the deployment URL.

## Cron Behavior

`vercel.json` ships with a Hobby-safe daily ingestion schedule:

```text
0 6 * * *
```

That targets `/api/cron/ingest`.

Timezone-aware digest generation is implemented in `/api/cron/digests`, but not enabled in `vercel.json` by default. To make 7 AM local-time digests work in production, trigger that route hourly from:

- Vercel cron on a paid plan
- an external scheduler
- a self-hosted scheduler

## Self-Hosted Runtime

For a long-running container or VM:

```bash
npm install
npx prisma migrate deploy
npm run build
npm start
```

Outside Vercel, the in-process scheduler can still run, but explicit cron or queue-backed workers are a better long-term production model.

## Troubleshooting

### Vercel deployment fails before build starts

Check `vercel.json`. Hobby plans reject unsupported cron schedules.

### Auth works locally but fails on Vercel

Check `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. `APP_URL` must match the deployed domain.

### Signup or legacy migration gets `429`

Auth endpoints are rate-limited. Wait for the `Retry-After` window to pass, then try again.

### Public signup still gets bot traffic

Enable `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. GeoPulse already uses distributed rate limits, a honeypot field, and minimum form dwell time, but production signup is intentionally blocked until Turnstile is configured.

### Public preview APIs get `429`

Anonymous read routes such as `/api/events`, `/api/events/[id]`, `/api/markets/quotes`, `/api/patterns`, `/api/patterns/predict`, `/api/stocks/[symbol]`, and `/api/status` are rate-limited and cache-backed through the shared Postgres store to reduce scraping pressure and provider quota burn.

### Database calls fail in production

Check:

- `DATABASE_URL` uses port `6543`
- `DIRECT_URL` uses port `5432`
- `npx prisma migrate deploy` has already run

### Manual sync returns `403`

Set `ADMIN_EMAILS` in production and sign in with one of those addresses.

### Quotes look stale

If `TWELVEDATA_API_KEY` is not configured, the app serves the latest stored `MarketSnapshot` data only. That is acceptable for stale context, not for fresh market coverage.
