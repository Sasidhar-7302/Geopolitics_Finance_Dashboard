# GeoPulse Database Schema

## Overview

GeoPulse uses Prisma with Supabase PostgreSQL. The schema now covers three layers:

- core intelligence data
- user/product state
- operational reliability and billing foundations

Schema source: `prisma/schema.prisma`

## Core Intelligence Models

### `Event`

Stores every ingested geopolitical story plus product-facing enrichment fields.

Key fields:

- headline and source data: `title`, `summary`, `source`, `url`, `canonicalUrl`
- geography and impact context: `region`, `countryCode`, `severity`
- content intelligence: `category`, `tags`, `whyThisMatters`, `relevanceScore`
- clustering/trust: `duplicateClusterId`, `supportingSourcesCount`, `sourceReliability`
- lifecycle: `publishedAt`, `firstSeenAt`, `fetchedAt`, `createdAt`
- sentiment: `sentimentScore`, `sentimentLabel`
- product gating: `isPremiumInsight`

Indexes added for:

- `publishedAt`
- `region`
- `severity`
- `source`
- `category`
- `duplicateClusterId`
- `urlHash`

### `Correlation`

Links an event to a symbol with impact metadata.

Key fields:

- `eventId`
- `symbol`
- `impactScore`
- `impactDirection`
- `impactMagnitude`
- `window`
- `category`

### `Pattern`

Aggregated historical pattern for `eventCategory + symbol`.

Key fields:

- `eventCategory`
- `symbol`
- `avgImpactPct`
- `direction`
- `confidence`
- `occurrences`

### `MarketSnapshot`

Persistent quote fallback store.

Key fields:

- `symbol`
- `price`
- `changePct`
- `assetClass`
- `provider`
- `freshness`
- `timestamp`

## User and Product Models

### `User`

Primary account model. Related to preferences, watchlists, alerts, subscriptions, entitlements, saved filters, and deliveries.

### `UserPreference`

Stores interest selections and personalization settings.

Key fields:

- `categories`, `regions`, `symbols`
- `timezone`
- `digestHour`
- `emailDigestEnabled`
- `deliveryChannels`
- `savedViewsEnabled`
- `plan`
- `onboarded`

### `SavedFilter`

Reusable saved dashboard views.

Key fields:

- `name`
- `query`
- `regions`
- `categories`
- `symbols`
- `direction`
- `severityMin`
- `timeWindow`
- `sortKey`
- `isPinned`

### `DigestSubscription`

Controls morning-brief delivery behavior.

Key fields:

- `enabled`
- `digestHour`
- `timezone`
- `deliveryChannels`
- `topStories`
- `lastSentAt`

### `Subscription`

Billing system record for the user.

Key fields:

- `provider`
- `customerId`
- `providerSubscriptionId`
- `status`
- `plan`
- `billingInterval`
- `currentPeriodEnd`
- `cancelAtPeriodEnd`

### `Entitlement`

Feature flag / access model per user.

Example keys:

- `premium_insights`
- `saved_views`
- `unlimited_alerts`
- `unlimited_watchlists`
- `faster_market_refresh`
- `email_digest`
- `intraday_digest`

### `EmailDelivery`

Audit trail for digest or other outbound message attempts.

Key fields:

- `type`
- `status`
- `provider`
- `messageId`
- `dedupeKey`
- `payload`
- `sentAt`

## Operational Models

### `IngestionLog`

High-level record of each ingestion run.

### `IngestionJob`

Stage-aware runtime record for ingestion work.

Key fields:

- `kind`
- `stage`
- `status`
- `source`
- `attempts`
- `itemsProcessed`
- `error`
- `startedAt`
- `completedAt`

### `SourceHealth`

Per-source reliability tracking.

Key fields:

- `source`
- `feedUrl`
- `status`
- `lastFetchedAt`
- `lastSucceededAt`
- `lastError`
- `lastLatencyMs`
- `failureCount`
- `successCount`

## Legacy/Core Supporting Models

- `Watchlist`
- `WatchlistItem`
- `Alert`

These remain active and are now constrained by plan/entitlement logic in the API layer.

## Migration Workflow

Use Prisma migrations against Supabase:

```bash
npx prisma generate
npx prisma migrate deploy
```

For local iteration when you need a new migration:

```bash
npx prisma migrate dev --name <change_name>
```
