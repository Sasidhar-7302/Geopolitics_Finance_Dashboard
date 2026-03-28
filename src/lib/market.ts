import { prisma } from "./prisma";
import { getAssetMeta } from "./assets";
import { fetchQuotes as fetchGoogleFallbackQuotes } from "./sources/yahoo";

export type MarketQuote = {
  symbol: string;
  price: number;
  changePct: number;
  currency?: string;
  provider: string;
  freshness: "live" | "delayed" | "snapshot";
  timestamp: string;
};

async function fetchTwelveDataQuotes(symbols: string[]): Promise<MarketQuote[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey || symbols.length === 0) return [];

  const batches: string[][] = [];
  for (let index = 0; index < symbols.length; index += 8) {
    batches.push(symbols.slice(index, index + 8));
  }

  const quotes: MarketQuote[] = [];

  for (const batch of batches) {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(batch.join(","))}&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) continue;

    const payload = (await response.json()) as Record<string, {
      symbol?: string;
      close?: string;
      percent_change?: string;
      currency?: string;
      datetime?: string;
    }>;

    for (const [symbol, value] of Object.entries(payload)) {
      if (!value || typeof value !== "object" || !value.close) continue;

      quotes.push({
        symbol,
        price: Number(value.close),
        changePct: Number(value.percent_change || 0),
        currency: value.currency || "USD",
        provider: "twelvedata",
        freshness: "delayed",
        timestamp: value.datetime || new Date().toISOString(),
      });
    }
  }

  return quotes;
}

async function readLatestSnapshots(symbols: string[]): Promise<MarketQuote[]> {
  const rows = await Promise.all(
    symbols.map((symbol) =>
      prisma.marketSnapshot.findFirst({
        where: { symbol },
        orderBy: { timestamp: "desc" },
      })
    )
  );

  return rows
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      symbol: row.symbol,
      price: row.price,
      changePct: row.changePct,
      provider: row.provider || "snapshot",
      freshness: (row.freshness as "live" | "delayed" | "snapshot") || "snapshot",
      timestamp: row.timestamp.toISOString(),
      currency: "USD",
    }));
}

async function persistSnapshots(quotes: MarketQuote[]) {
  if (quotes.length === 0) return;

  await prisma.marketSnapshot.createMany({
    data: quotes
      .filter((quote) => quote.price > 0)
      .map((quote) => ({
        symbol: quote.symbol,
        price: quote.price,
        changePct: quote.changePct,
        assetClass: getAssetMeta(quote.symbol).assetClass,
        timestamp: new Date(quote.timestamp),
        provider: quote.provider,
        freshness: quote.freshness,
      })),
  });
}

function validQuoteMap(quotes: MarketQuote[]) {
  const map = new Map<string, MarketQuote>();

  for (const quote of quotes) {
    if (quote.price > 0) {
      map.set(quote.symbol, quote);
    }
  }

  return map;
}

function getMissingSymbols(symbols: string[], quoteMap: Map<string, MarketQuote>) {
  return symbols.filter((symbol) => !quoteMap.has(symbol));
}

export async function fetchMarketQuotes(symbols: string[]): Promise<{
  quotes: MarketQuote[];
  meta: {
    provider: string;
    freshness: "live" | "delayed" | "snapshot";
    cached: boolean;
  };
}> {
  const normalized = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase())));
  if (normalized.length === 0) {
    return {
      quotes: [],
      meta: { provider: "none", freshness: "snapshot", cached: false },
    };
  }

  const mergedQuotes = new Map<string, MarketQuote>();
  let primaryProvider = "snapshot-cache";
  let usedSnapshots = false;

  const providerQuotes = await fetchTwelveDataQuotes(normalized);
  if (providerQuotes.length > 0) {
    primaryProvider = "twelvedata";
    for (const [symbol, quote] of validQuoteMap(providerQuotes)) {
      mergedQuotes.set(symbol, quote);
    }
    await persistSnapshots(providerQuotes);
  }

  const fallbackTargets = getMissingSymbols(normalized, mergedQuotes);
  if (fallbackTargets.length > 0) {
    const fallbackQuotes = await fetchGoogleFallbackQuotes(fallbackTargets);
    const normalizedFallback = fallbackQuotes.map((quote) => ({
      ...quote,
      provider: "google-finance-fallback",
      freshness: "delayed" as const,
      timestamp: new Date().toISOString(),
    }));

    if (normalizedFallback.some((quote) => quote.price > 0)) {
      if (primaryProvider === "snapshot-cache") {
        primaryProvider = "google-finance-fallback";
      }
      for (const [symbol, quote] of validQuoteMap(normalizedFallback)) {
        mergedQuotes.set(symbol, quote);
      }
      await persistSnapshots(normalizedFallback);
    }
  }

  const snapshotTargets = getMissingSymbols(normalized, mergedQuotes);
  if (snapshotTargets.length > 0) {
    const snapshots = await readLatestSnapshots(snapshotTargets);
    if (snapshots.length > 0) {
      usedSnapshots = true;
      for (const [symbol, quote] of validQuoteMap(snapshots)) {
        mergedQuotes.set(symbol, quote);
      }
    }
  }

  if (mergedQuotes.size > 0) {
    return {
      quotes: normalized
        .map((symbol) => mergedQuotes.get(symbol))
        .filter((quote): quote is MarketQuote => Boolean(quote)),
      meta: {
        provider: primaryProvider,
        freshness: primaryProvider === "snapshot-cache" ? "snapshot" : "delayed",
        cached: usedSnapshots,
      },
    };
  }

  return {
    quotes: [],
    meta: { provider: "snapshot-cache", freshness: "snapshot", cached: true },
  };
}
