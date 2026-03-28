import { useState } from "react";
import Layout from "../components/layout/Layout";
import SectionCard from "../components/ui/SectionCard";
import { useWatchlists } from "../lib/hooks/useWatchlists";
import { useQuotes } from "../lib/hooks/useQuotes";
import { formatCurrency, formatPct } from "../lib/format";
import { requireAuth } from "../lib/serverAuth";

const fallback = [
  { symbol: "SPY", name: "S&P 500 ETF", assetClass: "ETF" },
  { symbol: "XLE", name: "Energy Select ETF", assetClass: "ETF" },
  { symbol: "GLD", name: "SPDR Gold", assetClass: "Commodity" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury", assetClass: "Bond" },
  { symbol: "ITA", name: "Aerospace & Defense ETF", assetClass: "ETF" },
];

export default function Assets() {
  const { watchlists, isLoading, mutate } = useWatchlists();
  const items = watchlists[0]?.items?.length ? watchlists[0].items : fallback;
  const { quotes } = useQuotes(items.map((item) => item.symbol));
  const [form, setForm] = useState({ symbol: "", name: "", assetClass: "ETF" });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch("/api/watchlists/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Failed");
      setForm({ symbol: "", name: "", assetClass: "ETF" });
      setStatus("done");
      mutate();
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  };

  return (
    <Layout>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <SectionCard title="Watchlist" subtitle="Tracked instruments with live pricing">
          <div className="space-y-2">
            {items.map((asset) => {
              const quote = quotes.find((q) => q.symbol === asset.symbol);
              const change = quote?.changePct ?? 0;
              return (
                <div
                  key={asset.symbol}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        change >= 0 ? "bg-emerald" : "bg-danger"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-bold text-ink">{asset.symbol}</p>
                      <p className="text-xs text-slate">{asset.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink">
                      {quote ? formatCurrency(quote.price, quote.currency || "USD") : "--"}
                    </p>
                    <p className={`text-xs font-semibold ${change >= 0 ? "text-emerald" : "text-danger"}`}>
                      {quote ? `${change >= 0 ? "\u25B2" : "\u25BC"} ${formatPct(change)}` : "Loading..."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {isLoading && <p className="mt-3 text-xs text-slate animate-pulse">Loading watchlist...</p>}
        </SectionCard>

        <SectionCard title="Add Asset" subtitle="Expand your market watchlist">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink placeholder:text-slate focus:border-emerald/40 focus:outline-none"
              placeholder="Symbol (e.g., XLE)"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
              required
            />
            <input
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink placeholder:text-slate focus:border-emerald/40 focus:outline-none"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink"
              value={form.assetClass}
              onChange={(e) => setForm({ ...form, assetClass: e.target.value })}
            >
              <option value="ETF">ETF</option>
              <option value="Equity">Equity</option>
              <option value="Commodity">Commodity</option>
              <option value="FX">FX</option>
              <option value="Bond">Bond</option>
              <option value="Crypto">Crypto</option>
            </select>
            <button type="submit" className="btn-primary w-full">
              {status === "saving" ? "Saving..." : "Add to Watchlist"}
            </button>
            {status === "done" && <p className="text-xs text-emerald">Added successfully.</p>}
            {status === "error" && <p className="text-xs text-danger">Could not save the asset.</p>}
          </form>
        </SectionCard>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
