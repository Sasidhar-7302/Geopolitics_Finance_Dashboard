# GeoPulse Correlation Engine

## Overview

The correlation engine links geopolitical stories to market symbols. It converts unstructured news text into `Correlation` rows that power the dashboard, morning brief, symbol pages, and learned patterns.

Primary file:

- `src/lib/correlation/matchEvents.ts`

## Flow

```text
event text -> keyword/category matching -> false-positive guards -> quote lookup -> correlation records
```

Each correlation stores:

- `symbol`
- `impactScore`
- `impactDirection`
- `impactMagnitude`
- `window`
- `category`

## Matching Strategy

The engine combines event title and summary, then tests them against the correlation map.

Key behaviors:

- word-boundary matching instead of naive substring matching
- false-positive guards for ambiguous short keywords
- category assignment alongside symbol assignment
- multi-symbol support per event

This is intentionally deterministic and explainable. It is not an opaque ML classifier.

## Market Context

Impact magnitude is informed by the quote abstraction described in `docs/market-data.md`.

That means the engine can work with:

- preferred provider-backed quotes
- fallback delayed quotes
- stored `MarketSnapshot` values

The correlation layer no longer needs to know which upstream provider produced the number.

## Categories

The map covers the main themes the product is built around, including:

- energy
- defense
- safe havens
- trade and sanctions
- semiconductors and technology
- healthcare
- climate
- agriculture
- shipping
- political risk
- monetary policy

Categories feed directly into:

- dashboard filters
- saved views
- morning-brief ranking
- pattern aggregation

## Why The Engine Is Useful

Most news products stop at the headline. GeoPulse tries to answer:

- which assets are likely exposed
- whether the move is usually risk-on or risk-off
- how strong the signal looks right now
- whether this is part of a repeated historical pattern

## Extending The Map

To add a new mapping, update the correlation map in `src/lib/correlation/matchEvents.ts` with:

- keywords
- symbols
- default direction
- category

The next ingestion run will start producing correlations for the new rule.
