# GeoPulse API Reference

## Overview

GeoPulse exposes JSON API routes through Next.js. Authentication is handled by Supabase Auth session cookies where required.

Base URL in local development:

```text
http://localhost:3000/api
```

## Authentication

### `POST /api/auth/signup`

Create a Supabase Auth user plus the matching local GeoPulse profile row.
This route is rate-limited by IP and normalized email address.

Body:

```json
{
  "name": "Jane Investor",
  "email": "jane@example.com",
  "password": "strong-password",
  "timezone": "America/New_York",
  "digestHour": 7
}
```

Response:

```json
{
  "ok": true
}
```

Notes:

- Billing plan state is server-controlled; client signup and preference payloads cannot grant premium access
- Public self-service signup is intentionally rate-limited because the route uses the Supabase service role on the server
- The public signup form also supports honeypot checks and requires Turnstile in production

### `POST /api/auth/migrate-legacy`

Bridge an old local-password account into Supabase Auth on first sign-in.
This route is rate-limited by IP and normalized email address.

Body:

```json
{
  "email": "legacy@example.com",
  "password": "existing-password"
}
```

Response:

```json
{
  "ok": true
}
```

## Events and Intelligence

### `GET /api/events`

Server-side filtered event feed with cursor pagination.
This anonymous preview route is cached and rate-limited.

Supported query params:

| Param | Example | Notes |
|---|---|---|
| `q` | `oil` | Search across title, summary, source, region, tags, `whyThisMatters`, and symbols |
| `regions` or `region` | `Middle East,Europe` | Comma-separated |
| `categories` or `category` | `energy,conflict` | Comma-separated |
| `symbols` | `XLE,GLD` | Comma-separated |
| `direction` | `up` | `all`, `up`, `down`, `mixed`, `none` |
| `severityMin` or `severity` | `6` | Minimum event severity |
| `from` | `24h` | Relative (`6h`, `24h`, `7d`) or ISO date |
| `to` | `2026-03-26T12:00:00Z` | Optional upper bound |
| `timeWindow` | `36h` | Convenience alias for `from` |
| `sort` | `relevance` | `relevance`, `newest`, `severity`, `support` |
| `cursor` | `clx...` | Cursor from previous response |
| `limit` | `20` | Max `50` |

Response shape:

```json
{
  "events": [
    {
      "id": "clx...",
      "title": "OPEC signals a production cut",
      "category": "energy",
      "intelligenceQuality": 0.82,
      "whyThisMatters": "Energy supply risk tends to move oil-linked assets quickly.",
      "supportingSourcesCount": 3,
      "correlations": [
        {
          "symbol": "USO",
          "impactDirection": "up",
          "impactScore": 0.84,
          "category": "energy"
        }
      ]
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "clx...",
    "hasMore": true,
    "total": 461
  }
}
```

### `GET /api/events/[id]`

Fetch a single event plus trust metadata and related duplicate coverage.
This anonymous preview route is cached and rate-limited.

Response shape:

```json
{
  "event": {
    "id": "clx...",
    "title": "Headline",
    "intelligenceQuality": 0.81,
    "supportingSourcesCount": 4,
    "sourceReliability": 0.85
  },
  "relatedCoverage": [
    {
      "id": "clx...",
      "title": "Similar coverage",
      "source": "Reuters",
      "url": "https://example.com/story"
    }
  ],
  "trust": {
    "supportingSourcesCount": 4,
    "sourceReliability": 0.85
  }
}
```

### `GET /api/patterns`

Read learned patterns. Optional query params:

This anonymous preview route is cached and rate-limited.

- `category`
- `symbol`

### `GET /api/patterns/predict`

Predict likely market reactions for a specific event.
This anonymous preview route is cached and rate-limited.

Required query param:

- `eventId`

### `GET /api/stocks/[symbol]`

Fetch correlations and learned patterns for one symbol.
This anonymous preview route is cached and rate-limited.

## Market Data

### `GET /api/markets/quotes`

Fetch quotes through the market provider abstraction.
This anonymous preview route is cached and rate-limited.

Required query param:

- `symbols=SPY,NVDA,GLD`

Response shape:

```json
{
  "quotes": [
    {
      "symbol": "SPY",
      "price": 512.34,
      "changePct": 0.45,
      "provider": "twelvedata",
      "freshness": "delayed",
      "timestamp": "2026-03-26T12:00:00.000Z"
    }
  ],
  "meta": {
    "provider": "twelvedata",
    "freshness": "delayed",
    "cached": false
  }
}
```

If the provider is unavailable, the endpoint falls back to the latest stored `MarketSnapshot` records. GeoPulse no longer uses the old scraper fallback in this route.

## Preferences and Personalization

### `GET /api/preferences`

Read the authenticated user's preferences and personalization settings.

Response includes:

- `categories`
- `regions`
- `symbols`
- `timezone`
- `digestHour`
- `emailDigestEnabled`
- `deliveryChannels`
- `savedViewsEnabled`
- `plan`
- `onboarded`

`plan` is read-only in this API. GeoPulse derives it from the server-side subscription record instead of trusting client input.

### `POST /api/preferences`

Create or initialize the authenticated user's preferences.

### `PUT /api/preferences`

Update the authenticated user's preferences.

Example body:

```json
{
  "categories": ["energy", "technology"],
  "regions": ["Middle East", "Asia-Pacific"],
  "symbols": ["XLE", "NVDA"],
  "timezone": "America/New_York",
  "digestHour": 7,
  "emailDigestEnabled": true,
  "deliveryChannels": ["email"],
  "savedViewsEnabled": true
}
```

Ignored fields:

- `plan`

### `GET /api/me/entitlements`

Returns plan state, founding-beta cohort status, feature flags, and free-tier limits.

Example response:

```json
{
  "betaUnlocked": true,
  "betaSpotsRemaining": 954,
  "registeredUsers": 46,
  "plan": "free",
  "premiumActive": false,
  "billingEnabled": false,
  "limits": {
    "alerts": 3,
    "savedViews": 3,
    "watchlists": 1,
    "digestStories": 5
  }
}
```

### `GET /api/saved-filters`

List the authenticated user's saved views.

### `POST /api/saved-filters`

Create a saved view.

Body:

```json
{
  "name": "Middle East risk",
  "query": "oil",
  "regions": ["Middle East"],
  "categories": ["energy"],
  "symbols": ["XLE", "USO"],
  "direction": "up",
  "severityMin": 6,
  "timeWindow": "24h",
  "sortKey": "relevance",
  "isPinned": true
}
```

### `DELETE /api/saved-filters?id=<filterId>`

Delete one saved view.

### `POST /api/digests/send`

Generate a personalized digest preview or simulated delivery record.

Body:

```json
{
  "previewOnly": true
}
```

Admin users may additionally specify a `userId`.

## Watchlists and Alerts

### `GET /api/watchlists`

List the user's watchlists and items.

### `POST /api/watchlists`

Create a watchlist, subject to entitlement limits.

### `POST /api/watchlists/items`

Add an item to the default watchlist.

Body:

```json
{
  "symbol": "NVDA",
  "name": "NVIDIA",
  "assetClass": "Stock"
}
```

### `GET /api/alerts`

List the user's alerts.

### `POST /api/alerts`

Create an alert, subject to entitlement limits.

Body:

```json
{
  "name": "Oil risk alert",
  "condition": "category:energy AND severity:>=8"
}
```

## Billing

Stripe routes return `503` until the relevant Stripe environment variables are configured.

### `POST /api/billing/checkout`

Create a Stripe checkout session.

Body:

```json
{
  "interval": "monthly"
}
```

`interval` may be `monthly` or `yearly`.

### `POST /api/billing/portal`

Create a Stripe customer portal session for the authenticated user.

### `POST /api/webhooks/stripe`

Stripe webhook endpoint. Requires a valid `Stripe-Signature` header and `STRIPE_WEBHOOK_SECRET`.

## Operations

### `GET /api/status`

Read system health and aggregate counts.
This anonymous preview route is cached and rate-limited.

Response includes:

- `lastIngestion`
- `lastJob`
- `stats.totalEvents`
- `stats.recentEvents24h`
- `stats.totalCorrelations`
- `stats.totalPatterns`
- `stats.degradedSources`

### `POST /api/sync`

Trigger ingestion manually. Requires an authenticated admin user.

### `GET` or `POST /api/cron/ingest`

Protected cron entrypoint for ingestion.

Authorization:

```text
Authorization: Bearer <CRON_SECRET>
```

### `GET` or `POST /api/cron/digests`

Protected cron entrypoint for scheduled morning-brief processing.

Authorization:

```text
Authorization: Bearer <CRON_SECRET>
```

## Error Shape

Errors are returned as:

```json
{
  "error": "Human-readable message"
}
```

Common status codes:

- `400` bad request
- `401` unauthorized
- `403` forbidden
- `404` not found
- `405` method not allowed
- `500` server error
- `503` optional provider not configured
