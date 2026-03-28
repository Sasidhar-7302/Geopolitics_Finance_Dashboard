# GeoPulse Intelligence — Frontend Architecture Guide

## Overview

The frontend is built with **Next.js 16 (Pages Router)**, **React 18**, **TypeScript**, and **Tailwind CSS**. Data fetching uses **SWR** hooks with auto-refresh intervals. Financial charts embed **TradingView** widgets. The interactive world map uses **react-simple-maps**.

---

## Pages

### Dashboard (`/dashboard`) — `src/pages/dashboard.tsx`
The main intelligence hub. Shows all ingested events with:
- **16 category filter tabs:** All Events, For You, Conflict, Energy, Economic, Technology, Trade, Healthcare, Climate, Sanctions, Defense, Cybersecurity, Nuclear, Agriculture, Shipping, Elections, Science, General
- **"For You" personalized feed** — filters events matching user's selected categories, regions, and followed stocks
- **Event cards** with severity badges, sentiment indicators, source attribution, and time-ago timestamps
- **Affected stocks** shown inline with each event, including live price and % change

### Daily Digest (`/digest`) — `src/pages/digest.tsx`
Auto-generated daily intelligence summary:
- **Top stories** — highest severity events of the day
- **Most mentioned stocks** — symbols appearing in most correlations
- **Market movers** — biggest price changes
- **Category breakdown** — event distribution by category
- **Region breakdown** — event distribution by geography
- **Sentiment summary** — overall positive/negative/neutral distribution
- **Active patterns** — highest confidence learned patterns

### Global Map (`/map`) — `src/pages/map.tsx`
Interactive world map with per-country event visualization:
- **react-simple-maps** world map with country boundaries
- **Country markers** — circles sized by event count, colored by max severity
- **40+ country coordinates** mapped for precise marker placement
- **Click-to-view** — clicking a country opens a right-side slide-out panel
- **Slide-out panel** shows all events for that country with affected stocks
- **Country quick-access grid** — bottom grid of country buttons with event counts
- **Hover tooltips** — country name and event count on mouse hover

### Timeline (`/timeline`) — `src/pages/timeline.tsx`
Chronological event stream with filtering capabilities.

### Event Detail (`/event/[id]`) — `src/pages/event/[id].tsx`
Deep-dive into a single event:
- **Event details** — title, summary, source, region, severity, sentiment
- **Affected stocks** — each with TradingView MiniChart showing recent price action
- **Correlation reasons** — 40+ entries explaining WHY each stock is affected (e.g., "Oil events directly impact United States Oil Fund pricing")
- **Predictions** — based on learned patterns, showing expected impact direction, magnitude, and confidence
- **Related events** — other events from same region/category

### Stock Detail (`/stock/[symbol]`) — `src/pages/stock/[symbol].tsx`
Comprehensive view of a single financial instrument:
- **TradingView Advanced Chart** — full interactive candlestick chart with indicators
- **SYMBOL_NAMES map** — human-readable names for 60+ symbols
- **Related news** — all events correlated to this symbol
- **Historical patterns** — learned patterns showing how event categories affect this stock
- **"How This Works" card** — explains the correlation methodology to users

### Onboarding (`/onboarding`) — `src/pages/onboarding.tsx`
Perplexity-style interest picker shown to new users:
- **Step 1: Topics** — 14 topic options (Energy, Conflicts, Technology, etc.)
- **Step 2: Regions** — 7 region options (North America, Europe, Asia-Pacific, etc.)
- **Step 3: Stocks** — 20 popular stock symbols to follow
- **Progress bar** — visual step indicator
- **Minimum selections** — requires at least 3 topics before proceeding
- Saves to `UserPreference` model via `/api/preferences`

### Settings (`/settings`) — `src/pages/settings.tsx`
User preference management:
- **Interest management** — toggle topics, regions, and stocks inline
- **System status** — shows event count, correlation count, last ingestion time
- **Automation controls** — manual sync trigger
- **Account info** — email and account details

### Watchlist (`/assets`) — `src/pages/assets.tsx`
Asset tracking with watchlist management.

### Alerts (`/alerts`) — `src/pages/alerts.tsx`
Alert rule management (create, enable/disable alerts).

### Auth Pages
- `/auth/signin` — Login form
- `/auth/signup` — Registration form
- `/auth` — Auth redirect handler

---

## Component Hierarchy

```
_app.tsx (global styles)
│
├── PublicLayout (unauthenticated pages)
│   ├── auth/signin.tsx
│   └── auth/signup.tsx
│
└── Layout (authenticated pages)
    ├── Sidebar
    │   ├── NavLink (Dashboard)
    │   ├── NavLink (Daily Digest)
    │   ├── NavLink (Timeline)
    │   ├── NavLink (Global Map)
    │   ├── NavLink (Watchlist)
    │   ├── NavLink (Alerts)
    │   ├── NavLink (Settings)
    │   └── System Status Panel
    │       ├── Ingestion status badge
    │       ├── Event count
    │       └── Correlation count
    ├── Header
    └── Main Content Area
        └── [Page Component]
```

---

## Data Hooks (SWR)

All client-side data fetching goes through custom SWR hooks in `src/lib/hooks/`:

### `useEvents(filters?)` — `src/lib/hooks/useEvents.ts`
```typescript
interface EventItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: string;
  countryCode: string;
  severity: number;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  publishedAt: string;
  correlations: {
    symbol: string;
    impactDirection: string;
    impactMagnitude: number;
  }[];
}

const { events, isLoading, error, mutate } = useEvents();
// Auto-refreshes every 2 minutes
```

### `useQuotes(symbols)` — `src/lib/hooks/useQuotes.ts`
```typescript
const { quotes, isLoading } = useQuotes(["SPY", "NVDA", "GLD"]);
// quotes = { SPY: { price: 512.34, changePct: 0.45 }, ... }
```

### `usePatterns(filters?)` — `src/lib/hooks/usePatterns.ts`
```typescript
const { patterns, isLoading } = usePatterns({ category: "Energy" });
// Auto-refreshes every 5 minutes
```

### `usePreferences()` — `src/lib/hooks/usePreferences.ts`
```typescript
const { preferences, isLoading, savePreferences } = usePreferences();
// preferences = { categories: [...], regions: [...], symbols: [...], onboarded: true }
// savePreferences({ categories: [...] }) → POST/PUT to /api/preferences
```

### `useStatus()` — `src/lib/hooks/useStatus.ts`
```typescript
const { status, isLoading } = useStatus();
// status = { lastIngestion: {...}, counts: { events: 1338, ... } }
```

### `useWatchlists()` — `src/lib/hooks/useWatchlists.ts`
```typescript
const { watchlists, isLoading, addItem, removeItem } = useWatchlists();
```

### `useAlerts()` — `src/lib/hooks/useAlerts.ts`
```typescript
const { alerts, isLoading, createAlert, toggleAlert } = useAlerts();
```

---

## Styling System

### Tailwind CSS Configuration

Dark theme by default. Key design tokens:

```
Background:     bg-black, bg-zinc-900, bg-zinc-800
Text:           text-zinc-100, text-zinc-300, text-zinc-400
Accent:         emerald-400/500 (primary), amber-400 (warning), red-400 (danger)
Cards:          bg-zinc-900 border border-zinc-800 rounded-xl
Hover:          hover:bg-zinc-800, hover:border-zinc-700
```

### Common Patterns

**Card container:**
```html
<div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
```

**Section heading:**
```html
<h2 className="text-lg font-semibold text-zinc-100">Title</h2>
```

**Badge/pill:**
```html
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
```

**Interactive element:**
```html
<button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
```

---

## Reusable UI Components

### `SeverityBadge` — `src/components/ui/SeverityBadge.tsx`
Displays event severity as a color-coded badge (1-10 scale).
- 1-3: Green (low)
- 4-6: Amber (medium)
- 7-8: Orange (high)
- 9-10: Red (critical)

### `MetricCard` — `src/components/ui/MetricCard.tsx`
KPI display card with label, value, and optional trend indicator.

### `SectionCard` — `src/components/ui/SectionCard.tsx`
Reusable card container with title and optional header actions.

### `NavLink` — `src/components/ui/NavLink.tsx`
Sidebar navigation link with active state highlighting.

### `StockTicker` — `src/components/ui/StockTicker.tsx`
Inline stock price display with symbol, price, and % change (color-coded green/red).

### `Sparkline` — `src/components/ui/Sparkline.tsx`
Miniature line chart for showing trends in small spaces.

### `InputField` — `src/components/ui/InputField.tsx`
Form input with label, validation, and dark theme styling.

### `WorldMapSvg` — `src/components/ui/WorldMapSvg.tsx`
SVG world map component for the global map page.

### `TradingViewChart` — `src/components/ui/TradingViewChart.tsx`
Three TradingView widget wrappers:
- `TradingViewChart` — Full advanced chart
- `MiniChart` — Compact area chart
- `SymbolOverview` — Tabbed symbol info

---

## Key Frontend Patterns

### Protected Pages
Every authenticated page uses `getServerSideProps` with `requireAuth`:

```typescript
export const getServerSideProps = requireAuth(async (ctx) => {
  // Page-specific data fetching
  return { props: { /* ... */ } };
});
```

Redirects to `/auth/signin` if there is no valid Supabase session cookie.

### Client-Side Navigation
All internal navigation uses Next.js `<Link>` for client-side transitions:

```typescript
import Link from "next/link";

<Link href={`/event/${event.id}`}>
  <a className="hover:text-emerald-400">{event.title}</a>
</Link>
```

### Bidirectional Navigation
- **Event → Stocks:** Event detail page lists all affected stocks with links to `/stock/[symbol]`
- **Stock → Events:** Stock detail page lists all related events with links to `/event/[id]`
- **Map → Events:** Country click shows events with links to event detail
- **Dashboard → Everything:** Event cards link to event detail; stock badges link to stock detail

### Responsive Design
- **Sidebar:** Hidden on mobile, fixed on desktop (lg: breakpoint)
- **Dashboard grid:** Single column on mobile, multi-column on desktop
- **Map:** Full width with slide-out panel overlay on mobile
- **Cards:** Stack vertically on small screens

---

## TradingView Integration Details

### Advanced Chart (Stock Detail Page)
- Embedded via script injection into a container div
- Dark theme matching GeoPulse styling
- Default timeframe: 3 months
- Includes volume, candlesticks, and user-selectable indicators
- Symbol mapped from GeoPulse format to TradingView format (e.g., SPY → AMEX:SPY)

### Mini Chart (Event Detail Page)
- Compact area chart for quick price visualization
- Shown alongside each affected stock on event detail
- 30-day view by default
- Non-interactive (view-only)

### Symbol Overview
- Quick reference widget with price, change, and key stats
- Used in supplementary locations
