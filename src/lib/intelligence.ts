import { getAssetMeta } from "./assets";

export const CATEGORY_RULES: Array<{ key: string; label: string; keywords: string[] }> = [
  { key: "conflict", label: "Conflict & War", keywords: ["attack", "missile", "strike", "war", "invasion", "bombing", "airstrike", "troops", "combat", "casualties", "shelling", "offensive", "ceasefire", "clashes", "battlefield"] },
  { key: "defense", label: "Defense", keywords: ["defense", "military", "army", "navy", "warship", "fighter jet", "arms deal", "weapon", "pentagon", "nato", "drone strike", "air force", "marines", "special forces"] },
  { key: "energy", label: "Energy & Oil", keywords: ["oil", "opec", "pipeline", "natural gas", "energy", "crude", "refinery", "lng", "petroleum", "fuel", "barrel", "drilling", "offshore"] },
  { key: "economic", label: "Economy", keywords: ["recession", "inflation", "default", "debt", "bailout", "collapse", "bankruptcy", "crash", "downturn", "unemployment", "interest rate", "central bank", "gdp", "stimulus", "federal reserve", "bond", "treasury", "stock market"] },
  { key: "sanctions", label: "Sanctions & Tariffs", keywords: ["sanction", "embargo", "tariff", "blacklist", "trade war", "export control", "import duty", "trade ban", "asset freeze", "economic penalty"] },
  { key: "political", label: "Politics", keywords: ["election", "protest", "revolution", "unrest", "overthrow", "impeach", "resign", "riot", "vote", "parliament", "congress", "president", "prime minister", "democracy", "coup", "referendum"] },
  { key: "technology", label: "Technology", keywords: ["semiconductor", "chip", "artificial intelligence", "tech", "5g", "quantum", "software", "satellite", "space", "robot", "blockchain", "crypto", "machine learning", "startup", "data center"] },
  { key: "cyber", label: "Cybersecurity", keywords: ["cybersecurity", "cyber attack", "hack", "ransomware", "data breach", "malware", "phishing", "encryption", "zero-day", "cyber warfare"] },
  { key: "healthcare", label: "Healthcare", keywords: ["pandemic", "virus", "vaccine", "outbreak", "epidemic", "disease", "drug", "pharmaceutical", "hospital", "health", "fda", "medical", "clinical trial"] },
  { key: "climate", label: "Climate", keywords: ["climate", "carbon", "earthquake", "tsunami", "hurricane", "flood", "wildfire", "drought", "renewable", "solar", "environmental", "global warming"] },
  { key: "agriculture", label: "Agriculture", keywords: ["wheat", "grain", "crop", "famine", "food crisis", "agriculture", "corn", "soybean", "fertilizer", "harvest", "livestock", "farming"] },
  { key: "trade", label: "Trade & Shipping", keywords: ["shipping", "freight", "maritime", "supply chain", "logistics", "port", "trade deal", "import", "export", "container", "cargo", "customs"] },
  { key: "threat", label: "Threats", keywords: ["nuclear", "atomic", "warhead", "escalation", "terror", "hostage", "assassination", "chemical weapon", "missile test", "threat level"] },
  { key: "science", label: "Science", keywords: ["research", "discovery", "scientific", "physics", "biology", "astronomy", "genome", "crispr", "nasa", "experiment", "breakthrough", "laboratory"] },
];

const SINGLE_HIT_CATEGORIES = new Set([
  "conflict",
  "defense",
  "energy",
  "economic",
  "sanctions",
  "trade",
  "threat",
  "cyber",
]);

const STOP_WORDS = new Set([
  "the", "a", "an", "to", "of", "and", "for", "on", "in", "at", "with",
  "from", "after", "amid", "over", "under", "into", "new", "says", "say",
  "will", "may", "amid", "as", "is", "are", "be", "by", "that", "this",
]);

const SOURCE_RELIABILITY: Record<string, number> = {
  Reuters: 0.95,
  BBC: 0.9,
  "Associated Press": 0.93,
  AP: 0.93,
  CNBC: 0.82,
  NPR: 0.84,
  "Al Jazeera": 0.8,
  GDELT: 0.68,
};

const CATEGORY_MARKET_WEIGHT: Record<string, number> = {
  conflict: 0.58,
  defense: 0.52,
  energy: 0.58,
  economic: 0.56,
  sanctions: 0.54,
  trade: 0.5,
  threat: 0.54,
  technology: 0.44,
  cyber: 0.42,
  political: 0.38,
  healthcare: 0.34,
  climate: 0.3,
  agriculture: 0.32,
  science: 0.2,
  general: 0.12,
};

const MARKET_CONTEXT_KEYWORDS = Array.from(
  new Set(
    CATEGORY_RULES.flatMap((rule) => rule.keywords).concat([
      "market",
      "markets",
      "stocks",
      "stock",
      "equities",
      "equity",
      "shares",
      "bond",
      "bonds",
      "treasury",
      "yield",
      "yields",
      "volatility",
      "risk appetite",
      "safe haven",
      "etf",
      "etfs",
      "commodity",
      "commodities",
      "exporter",
      "importer",
    ])
  )
);

const LOW_SIGNAL_PATTERNS = [
  /\byou['’]ve got mail\b/i,
  /\beuthanasia\b/i,
  /\bnewsletter\b/i,
  /\bpodcast\b/i,
  /\bquiz\b/i,
  /\brecipe\b/i,
  /\breview\b/i,
  /\blive updates?\b/i,
  /\bopinion\b/i,
  /\bcelebrity\b/i,
  /\bmovie\b/i,
  /\bfilm\b/i,
  /\bmusic\b/i,
  /\bconcert\b/i,
  /\bsoccer\b/i,
  /\bfootball\b/i,
  /\bcricket\b/i,
  /\bnba\b/i,
  /\bnfl\b/i,
];

type MarketSignalParams = {
  title: string;
  summary: string;
  region: string;
  category: string;
  severity?: number;
  supportingSourcesCount?: number;
  symbols?: string[];
  sourceReliability?: number;
  marketSignalQuality?: number;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

export function categorizeEvent(title: string, summary: string): string {
  const text = `${title} ${summary}`.toLowerCase();
  let bestCat = "general";
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    const score = rule.keywords.filter((word) => text.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCat = rule.key;
    }
  }

  const minimumScore = SINGLE_HIT_CATEGORIES.has(bestCat) ? 1 : 2;
  return bestScore >= minimumScore ? bestCat : "general";
}

export function extractTags(title: string, summary: string, region: string): string[] {
  const tags = new Set<string>();
  const text = `${title} ${summary}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((word) => text.includes(word))) {
      tags.add(rule.key);
    }
  }

  if (region) tags.add(region.toLowerCase().replace(/\s+/g, "-"));

  if (text.includes("oil") || text.includes("crude")) tags.add("oil");
  if (text.includes("gold")) tags.add("safe-haven");
  if (text.includes("shipping") || text.includes("port")) tags.add("shipping");
  if (text.includes("chip") || text.includes("semiconductor")) tags.add("semiconductors");

  return Array.from(tags).slice(0, 8);
}

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";

    const filtered = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (!key.toLowerCase().startsWith("utm_") && key !== "ref" && key !== "source") {
        filtered.append(key, value);
      }
    });

    parsed.search = filtered.toString();
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function stableHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(36);
}

export function buildDuplicateClusterId(title: string, region: string, category: string): string {
  const tokens = tokenize(title).slice(0, 8).join("-");
  return `${category}:${region || "global"}:${tokens || "story"}`;
}

function countKeywordHits(text: string, keywords: string[]) {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) hits += 1;
  }
  return hits;
}

function isLowSignalStory(title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase();
  return LOW_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function metadataSignalQuality(params: Pick<MarketSignalParams, "category" | "severity" | "supportingSourcesCount" | "symbols" | "sourceReliability">) {
  const supportCount = Math.max(1, params.supportingSourcesCount ?? 1);
  const symbolCount = params.symbols?.length ?? 0;
  const severity = params.severity ?? 1;
  const sourceReliability = params.sourceReliability ?? 0.75;

  let quality = CATEGORY_MARKET_WEIGHT[params.category] ?? 0.18;
  quality += Math.min(0.16, Math.max(0, supportCount - 1) * 0.06);
  quality += Math.min(0.12, symbolCount * 0.05);
  quality += Math.min(0.12, severity * 0.015);
  quality += Math.min(0.08, Math.max(0, sourceReliability - 0.65) * 0.3);

  if (params.category === "general") {
    quality -= 0.16;
  }

  return Math.max(0.05, Math.min(1, quality));
}

export function computeMarketSignalQuality(params: MarketSignalParams): number {
  const titleText = params.title.toLowerCase();
  const text = `${params.title} ${params.summary}`.toLowerCase();
  const supportCount = Math.max(1, params.supportingSourcesCount ?? 1);
  const symbolCount = params.symbols?.length ?? 0;
  const severity = params.severity ?? 1;
  const marketHits = countKeywordHits(text, MARKET_CONTEXT_KEYWORDS);
  const titleHits = countKeywordHits(titleText, MARKET_CONTEXT_KEYWORDS);

  let quality = metadataSignalQuality(params);
  quality += Math.min(0.16, marketHits * 0.03);

  if (supportCount === 1 && symbolCount === 0 && severity < 5) {
    quality -= 0.12;
  }

  if (titleHits === 0 && marketHits <= 1 && params.category === "general") {
    quality -= 0.2;
  }

  if (isLowSignalStory(params.title, params.summary)) {
    quality -= 0.45;
  }

  return Number(Math.max(0, Math.min(1, quality)).toFixed(2));
}

function shouldExplainMarketImpact(params: MarketSignalParams) {
  const quality = params.marketSignalQuality ?? computeMarketSignalQuality(params);
  const supportCount = params.supportingSourcesCount ?? 1;
  const symbolCount = params.symbols?.length ?? 0;
  const threshold = symbolCount > 0 || supportCount >= 2 ? 0.46 : 0.58;
  return quality >= threshold;
}

export function buildWhyThisMatters(params: {
  title: string;
  summary: string;
  region: string;
  category: string;
  severity?: number;
  supportingSourcesCount?: number;
  symbols?: string[];
  sourceReliability?: number;
  marketSignalQuality?: number;
}): string | null {
  const { title, summary, region, category, symbols = [] } = params;
  const headline = `${title} ${summary}`.toLowerCase();
  const assets = symbols.slice(0, 2).map((symbol) => getAssetMeta(symbol).name);

  if (!shouldExplainMarketImpact({
    title,
    summary,
    region,
    category,
    severity: params.severity,
    supportingSourcesCount: params.supportingSourcesCount,
    symbols,
    sourceReliability: params.sourceReliability,
    marketSignalQuality: params.marketSignalQuality,
  })) {
    return null;
  }

  switch (category) {
    case "energy":
      return `Energy-sensitive assets can move when supply, shipping lanes, or producer policy shift in ${region || "global"} markets.`;
    case "conflict":
    case "defense":
      return `Escalation risk can quickly reprice defense names, oil, and broad risk sentiment when investors reassess geopolitical stability.`;
    case "economic":
      return `Macro policy and growth signals often spill into bonds, equities, and sector leadership within hours.`;
    case "sanctions":
    case "trade":
      return `Trade restrictions can hit supply chains, exporters, and region-linked ETFs before company guidance catches up.`;
    case "technology":
      return `Technology and semiconductor assets react fast to export controls, AI infrastructure demand, and cross-border policy risk.`;
    case "threat":
      return `Threat-driven headlines often boost safe havens and volatility while weakening broader risk appetite.`;
    default:
      if (headline.includes("election") || headline.includes("vote")) {
        return `Political shifts can change regulation, fiscal policy, and investor confidence for region-linked assets.`;
      }

      if (assets.length > 0) {
        return `This matters because the story can spill into ${assets.join(" and ")} if market participants treat it as an early signal.`;
      }

      return `This matters because markets often reprice before the full second-order impact becomes obvious in broader coverage.`;
  }
}

export function sourceReliabilityForSource(source: string): number {
  if (SOURCE_RELIABILITY[source]) return SOURCE_RELIABILITY[source];
  if (source.toLowerCase().includes("reuters")) return 0.95;
  if (source.toLowerCase().includes("bbc")) return 0.9;
  if (source.toLowerCase().includes("ap")) return 0.93;
  return 0.75;
}

export function computeRelevanceScore(params: {
  severity: number;
  category: string;
  region: string;
  publishedAt: Date;
  supportingSourcesCount?: number;
  symbols?: string[];
  sourceReliability?: number;
  marketSignalQuality?: number;
}): number {
  const ageHours = Math.max(1, (Date.now() - params.publishedAt.getTime()) / (1000 * 60 * 60));
  const recencyScore = Math.max(0.5, Math.min(6, 18 / ageHours));
  const supportScore = Math.min(3, params.supportingSourcesCount ?? 1);
  const symbolScore = Math.min(3, params.symbols?.length ?? 0);
  const categoryBoost = ["conflict", "energy", "economic", "technology", "trade"].includes(params.category) ? 1.2 : 1;
  const regionBoost = params.region === "Global" ? 1 : 1.1;
  const signalQuality = params.marketSignalQuality ?? metadataSignalQuality(params);
  const qualityMultiplier = 0.55 + signalQuality;
  const lowSignalPenalty = signalQuality < 0.35 ? 2 : 0;

  return Number(
    Math.max(
      0,
      (((params.severity || 1) * categoryBoost * regionBoost) + recencyScore + supportScore + symbolScore) * qualityMultiplier
        - lowSignalPenalty
    ).toFixed(2)
  );
}

export function summarizeEventIntelligence(params: {
  title: string;
  summary: string;
  region: string;
  category?: string | null;
  severity?: number;
  publishedAt: Date | string;
  supportingSourcesCount?: number;
  symbols?: string[];
  sourceReliability?: number;
}) {
  const category = categorizeEvent(params.title, params.summary);
  const publishedAt = params.publishedAt instanceof Date ? params.publishedAt : new Date(params.publishedAt);
  const marketSignalQuality = computeMarketSignalQuality({
    title: params.title,
    summary: params.summary,
    region: params.region,
    category,
    severity: params.severity,
    supportingSourcesCount: params.supportingSourcesCount,
    symbols: params.symbols,
    sourceReliability: params.sourceReliability,
  });

  return {
    category,
    intelligenceQuality: marketSignalQuality,
    whyThisMatters: buildWhyThisMatters({
      title: params.title,
      summary: params.summary,
      region: params.region,
      category,
      severity: params.severity,
      supportingSourcesCount: params.supportingSourcesCount,
      symbols: params.symbols,
      sourceReliability: params.sourceReliability,
      marketSignalQuality,
    }),
    relevanceScore: computeRelevanceScore({
      severity: params.severity ?? 1,
      category,
      region: params.region,
      publishedAt,
      supportingSourcesCount: params.supportingSourcesCount,
      symbols: params.symbols,
      sourceReliability: params.sourceReliability,
      marketSignalQuality,
    }),
  };
}
