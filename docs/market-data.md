# GeoPulse Market Data

## Overview

GeoPulse now uses a trust-first quote model:

1. `TWELVEDATA_API_KEY` provider-backed delayed quotes
2. Latest stored `MarketSnapshot` rows from Postgres

The old scraper path has been removed from the live quote pipeline. If the preferred provider is unavailable, the app degrades to explicitly labeled stored snapshots rather than pretending to have fresh data from an unlicensed fallback.

Relevant files:

- `src/lib/market.ts`
- `src/pages/api/markets/quotes.ts`
- `src/lib/marketPresentation.ts`

## Quote Flow

```text
request symbols -> fetchMarketQuotes()
                -> TwelveData if configured
                -> latest MarketSnapshot rows if provider unavailable or partial
```

Returned quote shape:

```json
{
  "symbol": "SPY",
  "price": 512.34,
  "changePct": 0.45,
  "provider": "twelvedata",
  "freshness": "delayed",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

Freshness values:

- `live`
- `delayed`
- `snapshot`

## Persistence Strategy

Whenever provider quotes resolve successfully, the app stores them into `MarketSnapshot`.

That gives GeoPulse a persistent cache instead of relying on in-memory quote state. If the provider path is down, GeoPulse can still show the latest known values with explicit freshness labeling.

If the provider path returns only a partial symbol set, GeoPulse fills the missing symbols from the latest stored snapshots instead of returning raw zero-price placeholders.

Stored fields include:

- `symbol`
- `price`
- `changePct`
- `assetClass`
- `provider`
- `freshness`
- `timestamp`

## Why This Design

The earlier approach depended on an HTML scraper fallback. That was acceptable for prototyping, but not strong enough for a product that wants:

- clearer freshness semantics
- more defensible public-market-data copy
- less operational fragility
- easier movement toward licensed data later

The current design keeps the UI contract stable while favoring honesty over synthetic “fresh” coverage.

## Fallback Behavior

### TwelveData configured and available

- Quotes come from TwelveData
- `provider = "twelvedata"`
- `freshness = "delayed"`

### TwelveData missing or unavailable, but snapshots exist

- Quotes come from the most recent `MarketSnapshot`
- `provider = "snapshot-cache"`
- `freshness = "snapshot"`
- `cached = true`

### No provider and no stored snapshots

- The API returns an empty quote list
- The UI should describe the state as unavailable, not as live pricing

## TradingView

Interactive charts are still rendered through TradingView embeds on symbol and event detail pages. TradingView is charting and visualization only; it is not the server-side quote provider for GeoPulse API routes.

## Operational Notes

- Set `TWELVEDATA_API_KEY` when you want fresh delayed quotes
- Without `TWELVEDATA_API_KEY`, GeoPulse should be treated as snapshot-backed only
- User-facing copy should describe snapshot fallback as stale context, not as exchange-grade pricing
