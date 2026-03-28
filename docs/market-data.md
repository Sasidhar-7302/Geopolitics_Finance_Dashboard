# GeoPulse Market Data

## Overview

GeoPulse now uses a provider abstraction instead of coupling the product directly to one quote source.

Current priority order:

1. `TWELVEDATA_API_KEY` provider-backed delayed quotes
2. HTML scraper fallback exposed as `google-finance-fallback`
3. Latest stored `MarketSnapshot` rows from Postgres

This gives the UI a consistent contract even when live quote providers degrade.

Relevant files:

- `src/lib/market.ts`
- `src/pages/api/markets/quotes.ts`
- `src/lib/sources/yahoo.ts`

## Quote Flow

```text
request symbols -> fetchMarketQuotes()
                -> TwelveData if configured
                -> scraper fallback if provider unavailable
                -> latest MarketSnapshot rows if both fail
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

Whenever provider or fallback quotes resolve successfully, the app stores them into `MarketSnapshot`.

That turns quotes into a persistent cache instead of relying only on in-memory server state. If the provider path is down, GeoPulse can still show the latest known values with explicit freshness labeling.

If the provider path returns only a partial symbol set, GeoPulse now fills the missing symbols from the latest stored snapshots instead of returning raw zero-price placeholders.

Stored fields include:

- `symbol`
- `price`
- `changePct`
- `assetClass`
- `provider`
- `freshness`
- `timestamp`

## Why This Design

The earlier approach depended directly on the scraper path. That was acceptable for prototyping, but not strong enough for a product that wants:

- clearer freshness semantics
- provider swap flexibility
- a durable cache
- more reliable degradation behavior

The current design keeps the UI contract stable while making it possible to move to better licensed feeds later without rewriting the app.

## Fallback Behavior

### TwelveData configured

- Quotes come from TwelveData
- `provider = "twelvedata"`
- `freshness = "delayed"`

### TwelveData unavailable but fallback succeeds

- Quotes come from the scraper wrapper
- `provider = "google-finance-fallback"`
- `freshness = "delayed"`

### Both network paths fail

- Quotes come from the most recent `MarketSnapshot`
- `provider = "snapshot-cache"`
- `freshness = "snapshot"`
- `cached = true`

## TradingView

Interactive charts are still rendered through TradingView embeds on symbol and event detail pages. TradingView is charting and visualization only; it is not the server-side quote provider for GeoPulse API routes.

## Operational Notes

- Set `TWELVEDATA_API_KEY` when you want the preferred provider path
- Leave it unset if you want to run with fallback behavior only
- Do not present the fallback scraper as a fully licensed market-data strategy for a paid product
- User-facing copy should describe this path as delayed fallback data, not as live exchange-grade pricing
