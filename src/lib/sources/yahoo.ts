export type MarketQuote = {
  symbol: string;
  price: number;
  changePct: number;
  currency?: string;
};

// Map symbols to the exchange identifiers used by the fallback scraper
const EXCHANGE_MAP: Record<string, string> = {
  // NYSEARCA ETFs
  SPY: "NYSEARCA", QQQ: "NASDAQ", GLD: "NYSEARCA", XLE: "NYSEARCA",
  ITA: "BATS", BDRY: "NYSEARCA", USO: "NYSEARCA", UNG: "NYSEARCA",
  SMH: "NASDAQ", XLF: "NYSEARCA", XLU: "NYSEARCA", XLI: "NYSEARCA",
  XLV: "NYSEARCA", TIP: "NYSEARCA", ICLN: "NYSEARCA", EEM: "NYSEARCA",
  EWJ: "NYSEARCA", EWY: "NYSEARCA", EWG: "NYSEARCA", EWU: "NYSEARCA",
  EZU: "NYSEARCA", FXI: "NYSEARCA", EWT: "NYSEARCA", INDA: "NYSEARCA",
  IAU: "NYSEARCA", SLV: "NYSEARCA", DBA: "NYSEARCA", WEAT: "NYSEARCA",
  CORN: "NYSEARCA", URA: "NYSEARCA", HACK: "NYSEARCA", XBI: "NYSEARCA",
  IYR: "NYSEARCA", BITO: "NYSEARCA", UUP: "NYSEARCA", FXE: "NYSEARCA",
  VXX: "BATS", KWEB: "NYSEARCA", RSX: "NYSEARCA",
  // Country-specific ETFs
  EWZ: "NYSEARCA", EWA: "NYSEARCA",
  // NASDAQ stocks
  NVDA: "NASDAQ", CRWD: "NASDAQ", AVAV: "NASDAQ",
  // NYSE stocks
  TSM: "NYSE", LMT: "NYSE", RTX: "NYSE", NOC: "NYSE", GD: "NYSE",
  BA: "NYSE", HII: "NYSE", XOM: "NYSE", CVX: "NYSE",
  // Bonds
  TLT: "NASDAQ",
  // Chinese stocks
  BABA: "NYSE",
};

/**
 * Fetch delayed quotes through the HTML scraper fallback path.
 * This is used only when the preferred provider is unavailable or not configured.
 */
export async function fetchQuotes(symbols: string[]): Promise<MarketQuote[]> {
  if (symbols.length === 0) return [];
  const results: MarketQuote[] = [];

  // Filter out futures symbols that the scraper path does not support
  const validSymbols = symbols.filter((s) => !s.includes("="));

  // Process in parallel batches of 5
  const batches: string[][] = [];
  for (let i = 0; i < validSymbols.length; i += 5) {
    batches.push(validSymbols.slice(i, i + 5));
  }

  for (const batch of batches) {
    const promises = batch.map(async (symbol) => {
      const exchange = EXCHANGE_MAP[symbol];
      if (!exchange) {
        // Try common exchanges in order
        for (const ex of ["NYSEARCA", "NASDAQ", "NYSE", "BATS"]) {
          const result = await fetchFromGoogle(symbol, ex);
          if (result && result.price > 0) return result;
        }
        return { symbol, price: 0, changePct: 0, currency: "USD" };
      }
      const result = await fetchFromGoogle(symbol, exchange);
      return result || { symbol, price: 0, changePct: 0, currency: "USD" };
    });

    const batchResults = await Promise.allSettled(promises);
    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  // Add any missing symbols (futures, etc.) with 0 price
  for (const symbol of symbols) {
    if (!results.find((r) => r.symbol === symbol)) {
      results.push({ symbol, price: 0, changePct: 0, currency: "USD" });
    }
  }

  return results;
}

async function fetchFromGoogle(
  symbol: string,
  exchange: string
): Promise<MarketQuote | null> {
  try {
    const url = `https://www.google.com/finance/quote/${symbol}:${exchange}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Extract last price from data attribute
    const priceMatch = html.match(/data-last-price="([^"]+)"/);
    if (!priceMatch) return null;

    const price = parseFloat(priceMatch[1]);
    const currency = html.match(/data-currency-code="([^"]+)"/)?.[1] ?? "USD";

    // Try multiple methods to get previous close for % change calculation
    let changePct = 0;

    // Method 1: data-previous-close attribute on older page variants
    const prevCloseAttr = html.match(/data-previous-close="([^"]+)"/);
    if (prevCloseAttr) {
      const prevClose = parseFloat(prevCloseAttr[1]);
      if (prevClose > 0) {
        changePct = ((price - prevClose) / prevClose) * 100;
      }
    }

    // Method 2: "Previous close" label followed by the current price class
    if (changePct === 0) {
      const prevCloseText = html.match(
        /Previous close<\/div>[\s\S]*?class="P6K39c"[^>]*>\$?([\d,.]+)/
      );
      if (prevCloseText) {
        const prevClose = parseFloat(prevCloseText[1].replace(/,/g, ""));
        if (prevClose > 0) {
          changePct = ((price - prevClose) / prevClose) * 100;
        }
      }
    }

    return { symbol, price, changePct, currency };
  } catch {
    return null;
  }
}
