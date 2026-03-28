type Freshness = "live" | "delayed" | "snapshot" | undefined;

export function getMarketFreshnessLabel(freshness: Freshness) {
  switch (freshness) {
    case "live":
      return "Live";
    case "delayed":
      return "Delayed";
    case "snapshot":
      return "Snapshot";
    default:
      return "Snapshot";
  }
}

export function getMarketProviderLabel(provider?: string) {
  switch (provider) {
    case "twelvedata":
      return "TwelveData";
    case "google-finance-fallback":
      return "Fallback scraper";
    case "snapshot-cache":
      return "Stored snapshots";
    case "none":
    case undefined:
      return "Stored snapshots";
    default:
      return provider;
  }
}

export function getQuoteBadgeLabel(freshness: Freshness, fallback = "modeled") {
  if (!freshness) return fallback;
  return getMarketFreshnessLabel(freshness).toLowerCase();
}
