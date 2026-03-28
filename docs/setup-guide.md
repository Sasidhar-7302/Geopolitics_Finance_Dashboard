# GeoPulse Setup Guide

## Prerequisites

- Node.js 20+
- npm
- Supabase PostgreSQL
- Git

Optional but supported:

- Stripe account and price IDs for billing
- TwelveData API key for provider-backed quotes

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
- `TWELVEDATA_API_KEY` is optional, but it is the preferred quote provider if you want to reduce dependence on the fallback scraper

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
npm run typecheck
npm run build
```

Notes:

- `npm run lint` currently aliases to `npm run typecheck`
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

### Database calls fail in production

Check:

- `DATABASE_URL` uses port `6543`
- `DIRECT_URL` uses port `5432`
- `npx prisma migrate deploy` has already run

### Manual sync returns `403`

Set `ADMIN_EMAILS` in production and sign in with one of those addresses.

### Quotes look stale

If `TWELVEDATA_API_KEY` is not configured, the app uses the fallback quote path and then falls back again to the latest stored `MarketSnapshot`.
