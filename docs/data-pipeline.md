# GeoPulse Data Pipeline

## Overview

The ingestion system turns raw geopolitical coverage into structured events that the product can filter, rank, correlate, and explain.

Primary entrypoint:

- `src/lib/ingest/events.ts`

Primary sources:

- RSS feeds from `NEWS_RSS_FEEDS` or `config/feeds.json`
- GDELT query results via `GDELT_QUERY`

## Pipeline Stages

```text
fetch -> normalize -> enrich -> persist -> correlate -> patterns -> sentiment -> digest-prep
```

Each run is tracked in both:

- `IngestionLog` for high-level run outcome
- `IngestionJob` for stage-by-stage operational state

## Stage Details

### 1. Fetch

RSS and GDELT are fetched separately. Each source fetch records a `SourceHealth` update with:

- source
- feed URL
- status
- latency
- error details

This allows partial failures without hiding which source degraded.

### 2. Normalize

Each raw event is normalized into a common shape:

- `title`
- `summary`
- `source`
- `url`
- `feedGuid`
- `publishedAt`
- `region`
- `countryCode`
- `severity`

### 3. Enrich

GeoPulse adds product-facing intelligence before or during persistence:

- `category`
- `tags`
- `whyThisMatters`
- `duplicateClusterId`
- `canonicalUrl`
- `urlHash`
- `firstSeenAt`
- `fetchedAt`
- `supportingSourcesCount`
- `sourceReliability`
- `relevanceScore`
- `isPremiumInsight`

### 4. Persist

Events are stored in Postgres via Prisma. The pipeline uses URL and URL-hash style identifiers to reduce duplication and preserve source lineage.

### 5. Correlate

The correlation engine matches event text against the asset map and creates `Correlation` records with:

- `symbol`
- `impactScore`
- `impactDirection`
- `impactMagnitude`
- `window`
- `category`

Quote resolution flows through the market-data abstraction rather than a hard-coded provider path.

### 6. Pattern Aggregation

The pattern layer groups historical event-to-symbol relationships to update `Pattern` rows and support prediction endpoints.

### 7. Sentiment

VADER sentiment labels events for quick polarity cues in the UI.

### 8. Digest Prep

The run finishes by preparing the data needed for morning-brief ranking and later delivery.

## Operational Behavior

### Manual trigger

```text
POST /api/sync
```

Requires an authenticated admin user.

### Scheduled trigger

```text
POST /api/cron/ingest
Authorization: Bearer <CRON_SECRET>
```

### Morning-brief scheduling

```text
POST /api/cron/digests
Authorization: Bearer <CRON_SECRET>
```

That route scans enabled digest subscriptions and processes only the users whose local hour matches their configured `digestHour`.

## Reliability Characteristics

What is already durable:

- partial source failures do not stop the whole run
- source health is persisted
- staged job status is persisted
- quote failures can fall back to stored market snapshots
- digest deliveries are deduped by user and day

What is still intentionally not the final scale architecture:

- execution is still request-triggered rather than queue-backed
- there is no external email provider wired yet
- there is no full observability stack or distributed tracing yet

## Feed Configuration

You can provide feeds in either of two ways:

1. `NEWS_RSS_FEEDS` as a comma-separated env var
2. `config/feeds.json`

Example `config/feeds.json` entry:

```json
{
  "name": "BBC World",
  "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
  "region": "Global",
  "countryCode": "GB"
}
```
