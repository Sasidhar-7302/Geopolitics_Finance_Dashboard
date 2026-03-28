import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import { estimateSeverity } from "../scoring/severity";
import { recordSourceHealth } from "../ingest/sourceHealth";

export type RssEvent = {
  title: string;
  summary: string;
  source: string;
  url: string;
  feedGuid?: string;
  publishedAt: Date;
  region: string;
  countryCode?: string;
  severity: number;
};

type FeedConfig = {
  name: string;
  url: string;
  region?: string;
  countryCode?: string;
};

const parser = new Parser({ timeout: 10000 });

/* ── Country detection rules with ISO codes ── */
const COUNTRY_RULES: Array<{ country: string; code: string; region: string; keywords: string[] }> = [
  // North America
  { country: "United States", code: "US", region: "North America", keywords: ["united states", "u.s.", "washington", "pentagon", "white house", "congress", "federal reserve", "wall street", "new york", "california", "texas", "florida", "biden", "trump", "american"] },
  { country: "Canada", code: "CA", region: "North America", keywords: ["canada", "ottawa", "toronto", "trudeau", "canadian"] },
  { country: "Mexico", code: "MX", region: "North America", keywords: ["mexico", "mexican", "mexico city"] },

  // Europe
  { country: "United Kingdom", code: "UK", region: "Europe", keywords: ["uk", "britain", "british", "london", "england", "scotland", "wales", "starmer", "sunak", "parliament", "westminster"] },
  { country: "Germany", code: "DE", region: "Europe", keywords: ["germany", "german", "berlin", "merz", "scholz", "bundeswehr", "bundesbank"] },
  { country: "France", code: "FR", region: "Europe", keywords: ["france", "french", "paris", "macron", "élysée"] },
  { country: "Italy", code: "IT", region: "Europe", keywords: ["italy", "italian", "rome", "meloni"] },
  { country: "Spain", code: "ES", region: "Europe", keywords: ["spain", "spanish", "madrid", "barcelona"] },
  { country: "Ukraine", code: "UA", region: "Europe", keywords: ["ukraine", "ukrainian", "kyiv", "zelensky", "zelenskyy", "donbas", "crimea"] },
  { country: "Russia", code: "RU", region: "Europe", keywords: ["russia", "russian", "moscow", "kremlin", "putin"] },
  { country: "Poland", code: "PL", region: "Europe", keywords: ["poland", "polish", "warsaw"] },
  { country: "Turkey", code: "TR", region: "Europe", keywords: ["turkey", "turkish", "ankara", "istanbul", "erdogan"] },
  { country: "Netherlands", code: "NL", region: "Europe", keywords: ["netherlands", "dutch", "amsterdam", "hague"] },
  { country: "Sweden", code: "SE", region: "Europe", keywords: ["sweden", "swedish", "stockholm"] },
  { country: "Switzerland", code: "CH", region: "Europe", keywords: ["switzerland", "swiss", "zurich", "geneva"] },

  // Middle East
  { country: "Israel", code: "IL", region: "Middle East", keywords: ["israel", "israeli", "jerusalem", "tel aviv", "netanyahu", "idf", "west bank"] },
  { country: "Palestine", code: "PS", region: "Middle East", keywords: ["gaza", "palestinian", "hamas", "west bank"] },
  { country: "Iran", code: "IR", region: "Middle East", keywords: ["iran", "iranian", "tehran", "ayatollah", "khamenei"] },
  { country: "Iraq", code: "IQ", region: "Middle East", keywords: ["iraq", "iraqi", "baghdad"] },
  { country: "Syria", code: "SY", region: "Middle East", keywords: ["syria", "syrian", "damascus", "assad"] },
  { country: "Saudi Arabia", code: "SA", region: "Middle East", keywords: ["saudi", "riyadh", "mbs", "aramco"] },
  { country: "Yemen", code: "YE", region: "Middle East", keywords: ["yemen", "houthi", "sanaa"] },
  { country: "Lebanon", code: "LB", region: "Middle East", keywords: ["lebanon", "lebanese", "beirut", "hezbollah"] },
  { country: "UAE", code: "AE", region: "Middle East", keywords: ["uae", "emirates", "dubai", "abu dhabi"] },

  // Asia-Pacific
  { country: "China", code: "CN", region: "Asia-Pacific", keywords: ["china", "chinese", "beijing", "xi jinping", "shanghai", "hong kong", "pla"] },
  { country: "Japan", code: "JP", region: "Asia-Pacific", keywords: ["japan", "japanese", "tokyo", "yen"] },
  { country: "India", code: "IN", region: "Asia-Pacific", keywords: ["india", "indian", "delhi", "mumbai", "modi", "rupee"] },
  { country: "South Korea", code: "KR", region: "Asia-Pacific", keywords: ["south korea", "korean", "seoul"] },
  { country: "North Korea", code: "KP", region: "Asia-Pacific", keywords: ["north korea", "pyongyang", "kim jong"] },
  { country: "Taiwan", code: "TW", region: "Asia-Pacific", keywords: ["taiwan", "taiwanese", "taipei", "tsmc"] },
  { country: "Australia", code: "AU", region: "Asia-Pacific", keywords: ["australia", "australian", "sydney", "canberra", "melbourne"] },
  { country: "Indonesia", code: "ID", region: "Asia-Pacific", keywords: ["indonesia", "indonesian", "jakarta"] },
  { country: "Philippines", code: "PH", region: "Asia-Pacific", keywords: ["philippines", "filipino", "manila"] },
  { country: "Vietnam", code: "VN", region: "Asia-Pacific", keywords: ["vietnam", "vietnamese", "hanoi"] },
  { country: "Thailand", code: "TH", region: "Asia-Pacific", keywords: ["thailand", "thai", "bangkok"] },
  { country: "Singapore", code: "SG", region: "Asia-Pacific", keywords: ["singapore"] },
  { country: "Pakistan", code: "PK", region: "Central Asia", keywords: ["pakistan", "pakistani", "islamabad", "karachi"] },
  { country: "Afghanistan", code: "AF", region: "Central Asia", keywords: ["afghanistan", "afghan", "kabul", "taliban"] },

  // Africa
  { country: "Nigeria", code: "NG", region: "Africa", keywords: ["nigeria", "nigerian", "lagos", "abuja"] },
  { country: "South Africa", code: "ZA", region: "Africa", keywords: ["south africa", "johannesburg", "cape town", "pretoria"] },
  { country: "Egypt", code: "EG", region: "Africa", keywords: ["egypt", "egyptian", "cairo", "suez"] },
  { country: "Kenya", code: "KE", region: "Africa", keywords: ["kenya", "kenyan", "nairobi"] },
  { country: "Ethiopia", code: "ET", region: "Africa", keywords: ["ethiopia", "ethiopian", "addis ababa"] },
  { country: "Sudan", code: "SD", region: "Africa", keywords: ["sudan", "sudanese", "khartoum"] },
  { country: "Libya", code: "LY", region: "Africa", keywords: ["libya", "libyan", "tripoli"] },
  { country: "Morocco", code: "MA", region: "Africa", keywords: ["morocco", "moroccan", "rabat"] },

  // South America
  { country: "Brazil", code: "BR", region: "South America", keywords: ["brazil", "brazilian", "brasília", "rio", "lula", "sao paulo"] },
  { country: "Argentina", code: "AR", region: "South America", keywords: ["argentina", "argentine", "buenos aires", "milei"] },
  { country: "Venezuela", code: "VE", region: "South America", keywords: ["venezuela", "venezuelan", "caracas", "maduro"] },
  { country: "Colombia", code: "CO", region: "South America", keywords: ["colombia", "colombian", "bogota"] },
];

/* Region-only fallback (when no specific country matched) */
const REGION_FALLBACK: Array<{ region: string; keywords: string[] }> = [
  { region: "Middle East", keywords: ["middle east", "persian gulf", "strait of hormuz"] },
  { region: "Europe", keywords: ["europe", "european", "eu ", "nato", "brussels", "eurozone"] },
  { region: "Asia-Pacific", keywords: ["asia", "pacific", "south china sea", "asean"] },
  { region: "Africa", keywords: ["africa", "sahel", "sub-saharan"] },
  { region: "South America", keywords: ["latin america", "south america", "caribbean"] },
  { region: "Central Asia", keywords: ["central asia", "kashmir"] },
];

function detectCountry(title: string, summary: string, feedRegion: string, feedCountryCode?: string): { region: string; countryCode: string; country?: string } {
  const text = `${title} ${summary}`.toLowerCase();

  // Try specific country match first
  let bestCountry: typeof COUNTRY_RULES[0] | null = null;
  let bestScore = 0;

  for (const rule of COUNTRY_RULES) {
    const score = rule.keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCountry = rule;
    }
  }

  if (bestCountry && bestScore >= 1) {
    return { region: bestCountry.region, countryCode: bestCountry.code, country: bestCountry.country };
  }

  // Fallback to region-level
  for (const rule of REGION_FALLBACK) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return { region: rule.region, countryCode: feedCountryCode || "GLOBAL" };
    }
  }

  return { region: feedRegion, countryCode: feedCountryCode || "GLOBAL" };
}

function loadFeeds(): FeedConfig[] {
  const fromEnv = (process.env.NEWS_RSS_FEEDS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((url) => ({ name: url, url, region: "Global", countryCode: "GLOBAL" }));

  if (fromEnv.length > 0) return fromEnv;

  const configPath = path.join(process.cwd(), "config", "feeds.json");
  if (!fs.existsSync(configPath)) return [];
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as FeedConfig[];
    return parsed;
  } catch {
    return [];
  }
}

export async function fetchRssEvents(): Promise<RssEvent[]> {
  const feeds = loadFeeds();
  if (feeds.length === 0) return [];

  const results: RssEvent[] = [];

  for (const feed of feeds) {
    const startedAt = Date.now();
    try {
      const feedData = await parser.parseURL(feed.url);
      const sourceName = feed.name || feedData.title || "RSS";

      for (const item of feedData.items.slice(0, 20)) {
        if (!item.link || !item.title) continue;
        const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();
        const summary = (item.contentSnippet || item.content || "").slice(0, 400);
        const detected = detectCountry(item.title, summary, feed.region || "Global", feed.countryCode);
        results.push({
          title: item.title,
          summary,
          source: sourceName,
          url: item.link,
          feedGuid: item.guid || item.id,
          publishedAt,
          region: detected.region,
          countryCode: detected.countryCode,
          severity: estimateSeverity(item.title, summary, sourceName),
        });
      }

      await recordSourceHealth({
        source: sourceName,
        feedUrl: feed.url,
        status: "ok",
        latencyMs: Date.now() - startedAt,
      });
    } catch (err) {
      await recordSourceHealth({
        source: feed.name,
        feedUrl: feed.url,
        status: "failed",
        latencyMs: Date.now() - startedAt,
        error: (err as Error).message,
      });
      console.warn(`[RSS] Failed to fetch ${feed.name}: ${(err as Error).message}`);
    }
  }

  return results;
}
