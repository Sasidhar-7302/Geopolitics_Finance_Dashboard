import { prisma } from "../prisma";
import { categorizeEvent } from "../scoring/severity";
import { fetchMarketQuotes } from "../market";

/* ─── keyword → symbol mapping (100+ entries) ─── */

type CorrelationEntry = {
  keywords: string[];
  symbol: string;
  baseImpact: number;
  direction: "up" | "down" | "mixed";
  category: string;
};

const CORRELATION_MAP: CorrelationEntry[] = [
  // ── Energy ──
  { keywords: ["oil", "crude", "petroleum"], symbol: "USO", baseImpact: 0.8, direction: "up", category: "energy" },
  { keywords: ["oil", "crude", "petroleum"], symbol: "XLE", baseImpact: 0.75, direction: "up", category: "energy" },
  { keywords: ["oil", "crude", "petroleum"], symbol: "USO", baseImpact: 0.7, direction: "up", category: "energy" },
  { keywords: ["oil", "crude"], symbol: "XOM", baseImpact: 0.65, direction: "up", category: "energy" },
  { keywords: ["oil", "crude"], symbol: "CVX", baseImpact: 0.6, direction: "up", category: "energy" },
  { keywords: ["opec", "opec+"], symbol: "USO", baseImpact: 0.8, direction: "mixed", category: "energy" },
  { keywords: ["opec", "opec+"], symbol: "XLE", baseImpact: 0.7, direction: "mixed", category: "energy" },
  { keywords: ["natural gas", "lng"], symbol: "UNG", baseImpact: 0.75, direction: "up", category: "energy" },
  { keywords: ["natural gas", "lng"], symbol: "UNG", baseImpact: 0.7, direction: "up", category: "energy" },
  { keywords: ["pipeline", "refinery"], symbol: "XLE", baseImpact: 0.5, direction: "mixed", category: "energy" },
  { keywords: ["shipping lane", "strait of hormuz", "suez"], symbol: "BDRY", baseImpact: 0.7, direction: "up", category: "energy" },
  { keywords: ["energy crisis", "power grid"], symbol: "XLU", baseImpact: 0.6, direction: "mixed", category: "energy" },
  { keywords: ["renewable", "solar", "wind energy"], symbol: "ICLN", baseImpact: 0.5, direction: "up", category: "energy" },
  { keywords: ["nuclear energy", "uranium"], symbol: "URA", baseImpact: 0.6, direction: "up", category: "energy" },

  // ── Defense & Military ──
  { keywords: ["defense", "military", "army"], symbol: "ITA", baseImpact: 0.7, direction: "up", category: "conflict" },
  { keywords: ["defense", "military"], symbol: "LMT", baseImpact: 0.65, direction: "up", category: "conflict" },
  { keywords: ["defense", "military"], symbol: "RTX", baseImpact: 0.6, direction: "up", category: "conflict" },
  { keywords: ["defense", "military"], symbol: "NOC", baseImpact: 0.6, direction: "up", category: "conflict" },
  { keywords: ["defense", "military"], symbol: "GD", baseImpact: 0.55, direction: "up", category: "conflict" },
  { keywords: ["missile", "weapon", "arms"], symbol: "LMT", baseImpact: 0.7, direction: "up", category: "conflict" },
  { keywords: ["missile", "weapon", "arms"], symbol: "BA", baseImpact: 0.5, direction: "up", category: "conflict" },
  { keywords: ["drone", "uav"], symbol: "AVAV", baseImpact: 0.6, direction: "up", category: "conflict" },
  { keywords: ["cybersecurity", "cyber attack", "hack"], symbol: "HACK", baseImpact: 0.6, direction: "up", category: "conflict" },
  { keywords: ["cybersecurity", "cyber attack"], symbol: "CRWD", baseImpact: 0.55, direction: "up", category: "conflict" },
  { keywords: ["naval", "navy", "warship"], symbol: "HII", baseImpact: 0.55, direction: "up", category: "conflict" },

  // ── Precious Metals / Safe Havens ──
  { keywords: ["sanction", "embargo", "trade war"], symbol: "GLD", baseImpact: 0.7, direction: "up", category: "sanctions" },
  { keywords: ["sanction", "embargo"], symbol: "IAU", baseImpact: 0.65, direction: "up", category: "sanctions" },
  { keywords: ["war", "invasion", "conflict"], symbol: "GLD", baseImpact: 0.75, direction: "up", category: "conflict" },
  { keywords: ["crisis", "uncertainty"], symbol: "GLD", baseImpact: 0.5, direction: "up", category: "threat" },
  { keywords: ["crisis", "uncertainty", "fear"], symbol: "VXX", baseImpact: 0.6, direction: "up", category: "threat" },
  { keywords: ["safe haven", "gold"], symbol: "GLD", baseImpact: 0.7, direction: "up", category: "economic" },
  { keywords: ["silver"], symbol: "SLV", baseImpact: 0.5, direction: "up", category: "economic" },

  // ── Country-specific: China ──
  { keywords: ["china", "beijing", "chinese"], symbol: "FXI", baseImpact: 0.7, direction: "mixed", category: "political" },
  { keywords: ["china", "beijing"], symbol: "BABA", baseImpact: 0.6, direction: "mixed", category: "political" },
  { keywords: ["china", "beijing"], symbol: "KWEB", baseImpact: 0.55, direction: "mixed", category: "political" },
  { keywords: ["china trade", "us-china"], symbol: "FXI", baseImpact: 0.75, direction: "down", category: "sanctions" },

  // ── Country-specific: Taiwan ──
  { keywords: ["taiwan", "taipei"], symbol: "TSM", baseImpact: 0.7, direction: "mixed", category: "political" },
  { keywords: ["taiwan", "taipei"], symbol: "EWT", baseImpact: 0.65, direction: "mixed", category: "political" },
  { keywords: ["taiwan strait"], symbol: "SMH", baseImpact: 0.7, direction: "down", category: "conflict" },

  // ── Country-specific: Russia / Ukraine ──
  { keywords: ["russia", "kremlin", "moscow"], symbol: "RSX", baseImpact: 0.6, direction: "mixed", category: "political" },
  { keywords: ["ukraine", "kyiv"], symbol: "GLD", baseImpact: 0.5, direction: "up", category: "conflict" },
  { keywords: ["ukraine", "kyiv"], symbol: "WEAT", baseImpact: 0.6, direction: "up", category: "conflict" },
  { keywords: ["russia sanction"], symbol: "XLE", baseImpact: 0.6, direction: "up", category: "sanctions" },

  // ── Country-specific: Middle East ──
  { keywords: ["iran", "tehran"], symbol: "USO", baseImpact: 0.6, direction: "up", category: "conflict" },
  { keywords: ["iran", "tehran"], symbol: "GLD", baseImpact: 0.5, direction: "up", category: "conflict" },
  { keywords: ["israel", "hamas", "hezbollah", "gaza"], symbol: "GLD", baseImpact: 0.6, direction: "up", category: "conflict" },
  { keywords: ["israel", "hamas", "hezbollah"], symbol: "ITA", baseImpact: 0.55, direction: "up", category: "conflict" },
  { keywords: ["saudi", "riyadh"], symbol: "USO", baseImpact: 0.55, direction: "mixed", category: "energy" },

  // ── Country-specific: India ──
  { keywords: ["india", "delhi", "mumbai"], symbol: "INDA", baseImpact: 0.55, direction: "mixed", category: "political" },

  // ── Country-specific: Japan / Korea ──
  { keywords: ["japan", "tokyo", "yen"], symbol: "EWJ", baseImpact: 0.5, direction: "mixed", category: "economic" },
  { keywords: ["north korea", "pyongyang"], symbol: "GLD", baseImpact: 0.6, direction: "up", category: "threat" },
  { keywords: ["north korea", "pyongyang"], symbol: "ITA", baseImpact: 0.55, direction: "up", category: "threat" },
  { keywords: ["south korea", "seoul"], symbol: "EWY", baseImpact: 0.5, direction: "mixed", category: "political" },

  // ── Country-specific: Europe ──
  { keywords: ["european union", "brussels", "eu summit", "eu sanctions", "eu policy"], symbol: "EZU", baseImpact: 0.5, direction: "mixed", category: "political" },
  { keywords: ["germany", "berlin"], symbol: "EWG", baseImpact: 0.5, direction: "mixed", category: "political" },
  { keywords: ["uk", "london", "britain"], symbol: "EWU", baseImpact: 0.5, direction: "mixed", category: "political" },

  // ── Monetary Policy ──
  { keywords: ["federal reserve", "the fed", "fomc", "fed chair", "fed rate", "fed policy"], symbol: "SPY", baseImpact: 0.7, direction: "mixed", category: "economic" },
  { keywords: ["federal reserve", "the fed", "fomc", "fed chair", "fed rate"], symbol: "TLT", baseImpact: 0.75, direction: "mixed", category: "economic" },
  { keywords: ["federal reserve", "the fed", "fed rate"], symbol: "GLD", baseImpact: 0.5, direction: "mixed", category: "economic" },
  { keywords: ["interest rate", "rate hike", "rate cut"], symbol: "TLT", baseImpact: 0.8, direction: "mixed", category: "economic" },
  { keywords: ["interest rate", "rate hike"], symbol: "XLF", baseImpact: 0.65, direction: "mixed", category: "economic" },
  { keywords: ["interest rate", "rate hike"], symbol: "IYR", baseImpact: 0.6, direction: "down", category: "economic" },
  { keywords: ["inflation", "cpi", "pce"], symbol: "TIP", baseImpact: 0.65, direction: "up", category: "economic" },
  { keywords: ["inflation", "cpi"], symbol: "GLD", baseImpact: 0.6, direction: "up", category: "economic" },
  { keywords: ["quantitative easing", "stimulus", "money supply"], symbol: "SPY", baseImpact: 0.6, direction: "up", category: "economic" },
  { keywords: ["ecb", "european central bank"], symbol: "FXE", baseImpact: 0.6, direction: "mixed", category: "economic" },
  { keywords: ["bank of japan", "boj"], symbol: "EWJ", baseImpact: 0.55, direction: "mixed", category: "economic" },

  // ── Trade & Tariffs ──
  { keywords: ["tariff", "trade war", "import duty"], symbol: "SPY", baseImpact: 0.6, direction: "down", category: "sanctions" },
  { keywords: ["tariff", "trade war"], symbol: "EEM", baseImpact: 0.6, direction: "down", category: "sanctions" },
  { keywords: ["tariff"], symbol: "XLI", baseImpact: 0.5, direction: "down", category: "sanctions" },
  { keywords: ["export ban", "export control", "chip ban"], symbol: "SMH", baseImpact: 0.7, direction: "down", category: "sanctions" },
  { keywords: ["export control", "chip ban"], symbol: "NVDA", baseImpact: 0.65, direction: "down", category: "sanctions" },

  // ── Technology ──
  { keywords: ["semiconductor", "chip", "chipmaker"], symbol: "SMH", baseImpact: 0.7, direction: "mixed", category: "technology" },
  { keywords: ["semiconductor", "chip"], symbol: "NVDA", baseImpact: 0.65, direction: "mixed", category: "technology" },
  { keywords: ["semiconductor", "chip"], symbol: "TSM", baseImpact: 0.6, direction: "mixed", category: "technology" },
  { keywords: ["artificial intelligence", "ai"], symbol: "NVDA", baseImpact: 0.6, direction: "up", category: "technology" },
  { keywords: ["tech regulation", "big tech", "antitrust"], symbol: "QQQ", baseImpact: 0.55, direction: "down", category: "technology" },

  // ── Agriculture & Food ──
  { keywords: ["wheat", "grain", "food crisis"], symbol: "WEAT", baseImpact: 0.65, direction: "up", category: "agriculture" },
  { keywords: ["corn", "agriculture"], symbol: "CORN", baseImpact: 0.55, direction: "up", category: "agriculture" },
  { keywords: ["famine", "food shortage"], symbol: "DBA", baseImpact: 0.6, direction: "up", category: "agriculture" },

  // ── Recession / Economic Crisis ──
  { keywords: ["recession", "downturn", "economic collapse"], symbol: "SPY", baseImpact: 0.75, direction: "down", category: "economic" },
  { keywords: ["recession", "downturn"], symbol: "TLT", baseImpact: 0.6, direction: "up", category: "economic" },
  { keywords: ["recession", "downturn"], symbol: "GLD", baseImpact: 0.6, direction: "up", category: "economic" },
  { keywords: ["default", "debt crisis", "sovereign debt"], symbol: "TLT", baseImpact: 0.65, direction: "mixed", category: "economic" },
  { keywords: ["bankruptcy", "bank failure", "bank run"], symbol: "XLF", baseImpact: 0.7, direction: "down", category: "economic" },
  { keywords: ["unemployment", "jobless", "layoffs"], symbol: "SPY", baseImpact: 0.5, direction: "down", category: "economic" },

  // ── Currency ──
  { keywords: ["dollar", "usd", "greenback"], symbol: "UUP", baseImpact: 0.55, direction: "mixed", category: "economic" },
  { keywords: ["euro", "eurozone"], symbol: "FXE", baseImpact: 0.5, direction: "mixed", category: "economic" },
  { keywords: ["yuan", "renminbi"], symbol: "FXI", baseImpact: 0.5, direction: "mixed", category: "economic" },
  { keywords: ["cryptocurrency", "bitcoin", "crypto"], symbol: "BITO", baseImpact: 0.55, direction: "mixed", category: "technology" },

  // ── Shipping & Logistics ──
  { keywords: ["shipping", "freight", "maritime"], symbol: "BDRY", baseImpact: 0.6, direction: "up", category: "trade" },
  { keywords: ["supply chain", "logistics", "port"], symbol: "XLI", baseImpact: 0.5, direction: "down", category: "trade" },
  { keywords: ["red sea", "houthi"], symbol: "BDRY", baseImpact: 0.7, direction: "up", category: "trade" },
  { keywords: ["red sea", "houthi"], symbol: "USO", baseImpact: 0.55, direction: "up", category: "trade" },

  // ── Healthcare / Pharma ──
  { keywords: ["pandemic", "epidemic", "virus", "outbreak"], symbol: "XLV", baseImpact: 0.6, direction: "up", category: "healthcare" },
  { keywords: ["pandemic", "virus", "outbreak"], symbol: "SPY", baseImpact: 0.6, direction: "down", category: "healthcare" },
  { keywords: ["vaccine", "drug approval", "fda"], symbol: "XBI", baseImpact: 0.55, direction: "up", category: "healthcare" },

  // ── Climate / Environment ──
  { keywords: ["climate", "carbon", "emissions"], symbol: "ICLN", baseImpact: 0.5, direction: "up", category: "climate" },
  { keywords: ["climate", "carbon"], symbol: "XLE", baseImpact: 0.45, direction: "down", category: "climate" },
  { keywords: ["earthquake", "tsunami", "hurricane", "flood"], symbol: "SPY", baseImpact: 0.4, direction: "down", category: "climate" },

  // ── Election / Political ──
  { keywords: ["election", "vote", "ballot"], symbol: "SPY", baseImpact: 0.5, direction: "mixed", category: "political" },
  { keywords: ["election", "vote"], symbol: "VXX", baseImpact: 0.45, direction: "up", category: "political" },
  { keywords: ["coup", "overthrow", "revolution"], symbol: "GLD", baseImpact: 0.6, direction: "up", category: "political" },
  { keywords: ["protest", "unrest", "riot"], symbol: "VXX", baseImpact: 0.4, direction: "up", category: "political" },

  // ── Nuclear ──
  { keywords: ["nuclear", "atomic", "warhead"], symbol: "GLD", baseImpact: 0.8, direction: "up", category: "threat" },
  { keywords: ["nuclear", "warhead"], symbol: "ITA", baseImpact: 0.7, direction: "up", category: "threat" },
  { keywords: ["nuclear", "warhead"], symbol: "SPY", baseImpact: 0.7, direction: "down", category: "threat" },

  // ── International Organizations ──
  { keywords: ["nato"], symbol: "ITA", baseImpact: 0.55, direction: "up", category: "conflict" },
  { keywords: ["imf", "world bank"], symbol: "EEM", baseImpact: 0.45, direction: "mixed", category: "economic" },
  { keywords: ["un security council"], symbol: "GLD", baseImpact: 0.5, direction: "up", category: "political" },

  // ── Market indices ──
  { keywords: ["stock market", "wall street", "market crash"], symbol: "SPY", baseImpact: 0.7, direction: "mixed", category: "economic" },
  { keywords: ["nasdaq", "tech stocks"], symbol: "QQQ", baseImpact: 0.6, direction: "mixed", category: "economic" },
  { keywords: ["emerging market"], symbol: "EEM", baseImpact: 0.55, direction: "mixed", category: "economic" },
];

/* ─── Words that cause false positives when substring-matched ─── */
const FALSE_POSITIVE_GUARDS: Record<string, RegExp> = {
  oil:    /\b(?:turmoil|soil|foil|recoil|toil|broil|oily)\b/i,
  war:    /\b(?:warn|warden|warrant|wardrobe|ward|warm|warp|warfare)\b/i,
  arm:    /\b(?:farm|charm|harm|alarm|pharmacy|pharma)\b/i,
  gold:   /\b(?:golden gate|marigold)\b/i,
  chip:   /\b(?:chipmunk)\b/i,
  fed:    /\b(?:federation|fedex|federated)\b/i,
  china:  /\b(?:china cabinet|porcelain|fine china)\b/i,
  eu:     /\b(?:queue|eureka|euphoria)\b/i,
};

/** Build a regex cache for word-boundary matching (much more accurate than .includes) */
const regexCache = new Map<string, RegExp>();
function getKeywordRegex(keyword: string): RegExp {
  let r = regexCache.get(keyword);
  if (!r) {
    // Escape special regex chars, then wrap in word boundaries
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    r = new RegExp(`\\b${escaped}\\b`, "i");
    regexCache.set(keyword, r);
  }
  return r;
}

/** Check if any keyword from the entry matches the text (word-boundary, not substring) */
function matchesEntry(text: string, entry: CorrelationEntry): boolean {
  return entry.keywords.some((kw) => {
    const regex = getKeywordRegex(kw);
    if (!regex.test(text)) return false;
    // Check for false positives
    const guard = FALSE_POSITIVE_GUARDS[kw];
    if (guard && guard.test(text) && !getKeywordRegex(kw).test(text.replace(guard, ""))) {
      return false;
    }
    return true;
  });
}

/** Count how many keywords match for weighting */
function matchCount(text: string, entry: CorrelationEntry): number {
  return entry.keywords.filter((kw) => getKeywordRegex(kw).test(text)).length;
}

export async function generateCorrelations() {
  const recentEvents = await prisma.event.findMany({
    where: {
      publishedAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 48) }, // 48h window
    },
    include: { correlations: true },
  });

  // Collect all symbols we need quotes for
  const symbolsNeeded = new Set<string>();
  const eventMatches: Array<{
    event: typeof recentEvents[0];
    entry: CorrelationEntry;
    matchStrength: number;
  }> = [];

  for (const event of recentEvents) {
    const text = `${event.title} ${event.summary}`.toLowerCase();

    // Skip events that already have correlations
    if (event.correlations.length > 0) continue;

    for (const entry of CORRELATION_MAP) {
      if (!matchesEntry(text, entry)) continue;
      const count = matchCount(text, entry);
      const strength = Math.min(1, entry.baseImpact + (count - 1) * 0.1);
      symbolsNeeded.add(entry.symbol);
      eventMatches.push({ event, entry, matchStrength: strength });
    }
  }

  // Fetch live quotes for all matched symbols
  let quoteMap = new Map<string, { price: number; changePct: number; provider: string; freshness: "live" | "delayed" | "snapshot"; timestamp: string }>();
  if (symbolsNeeded.size > 0) {
    try {
      const { quotes } = await fetchMarketQuotes(Array.from(symbolsNeeded));
      for (const q of quotes) {
        quoteMap.set(q.symbol, {
          price: q.price,
          changePct: q.changePct,
          provider: q.provider,
          freshness: q.freshness,
          timestamp: q.timestamp,
        });
      }
    } catch (err) {
      console.warn("[Correlation] Failed to fetch quotes:", (err as Error).message);
    }
  }

  // Create correlations with direction and magnitude
  const seen = new Set<string>();
  for (const { event, entry, matchStrength } of eventMatches) {
    const key = `${event.id}:${entry.symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const quote = quoteMap.get(entry.symbol);
    const impactDirection = entry.direction === "mixed"
      ? (quote?.changePct ?? 0) >= 0 ? "up" : "down"
      : entry.direction;
    const impactMagnitude = Math.abs(quote?.changePct ?? 0);

    await prisma.correlation.create({
      data: {
        eventId: event.id,
        symbol: entry.symbol,
        impactScore: matchStrength,
        impactDirection,
        impactMagnitude,
        window: "24h",
        category: entry.category,
      },
    });

    // Also save market snapshot
    if (quote && quote.price > 0) {
      await prisma.marketSnapshot.create({
        data: {
          symbol: entry.symbol,
          price: quote.price,
          changePct: quote.changePct,
          assetClass: entry.category,
          timestamp: new Date(quote.timestamp),
          provider: quote.provider,
          freshness: quote.freshness,
        },
      });
    }
  }

  return { correlationsCreated: eventMatches.length };
}
