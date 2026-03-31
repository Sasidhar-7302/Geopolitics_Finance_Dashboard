import { useState } from "react";
import { useRouter } from "next/router";
import { requireAuth } from "../lib/serverAuth";

const TOPIC_OPTIONS = [
  { key: "energy", label: "Energy & Oil", icon: "EN" },
  { key: "conflict", label: "Conflicts & Wars", icon: "CF" },
  { key: "economic", label: "Economic Policy", icon: "EC" },
  { key: "defense", label: "Defense & Military", icon: "DF" },
  { key: "technology", label: "Technology", icon: "TC" },
  { key: "cyber", label: "Cybersecurity", icon: "CY" },
  { key: "sanctions", label: "Sanctions & Tariffs", icon: "SN" },
  { key: "political", label: "Elections & Politics", icon: "PL" },
  { key: "healthcare", label: "Healthcare", icon: "HC" },
  { key: "climate", label: "Climate & Environment", icon: "CL" },
  { key: "agriculture", label: "Agriculture & Food", icon: "AG" },
  { key: "trade", label: "Trade & Shipping", icon: "TR" },
  { key: "threat", label: "Nuclear & Threats", icon: "NT" },
  { key: "science", label: "Science", icon: "SC" },
];

const REGION_OPTIONS = [
  { key: "North America", label: "North America", icon: "NA" },
  { key: "Europe", label: "Europe", icon: "EU" },
  { key: "Middle East", label: "Middle East", icon: "ME" },
  { key: "Asia-Pacific", label: "Asia-Pacific", icon: "AP" },
  { key: "Africa", label: "Africa", icon: "AF" },
  { key: "South America", label: "South America", icon: "SA" },
  { key: "Central Asia", label: "Central Asia", icon: "CA" },
];

const POPULAR_SYMBOLS = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq 100" },
  { symbol: "GLD", name: "Gold" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "XLE", name: "Energy Sector" },
  { symbol: "TLT", name: "Treasury Bonds" },
  { symbol: "USO", name: "Oil Fund" },
  { symbol: "ITA", name: "Defense & Aerospace" },
  { symbol: "SMH", name: "Semiconductors" },
  { symbol: "FXI", name: "China Large-Cap" },
  { symbol: "BABA", name: "Alibaba" },
  { symbol: "TSM", name: "Taiwan Semi" },
  { symbol: "VXX", name: "Volatility" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "EEM", name: "Emerging Markets" },
  { symbol: "WEAT", name: "Wheat" },
  { symbol: "ICLN", name: "Clean Energy" },
  { symbol: "URA", name: "Uranium" },
  { symbol: "BDRY", name: "Shipping" },
  { symbol: "BITO", name: "Bitcoin ETF" },
];

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-md border border-white/[0.06] bg-black/30 px-2 py-1 text-[10px] font-bold tracking-wide text-zinc-400">
      {children}
    </span>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>(["SPY", "QQQ", "GLD"]);
  const [saving, setSaving] = useState(false);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories,
          regions,
          symbols,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          digestHour: 7,
          emailDigestEnabled: true,
          deliveryChannels: ["email"],
        }),
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald/10 text-lg font-bold text-emerald">
            G
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white">
            Welcome to <span className="text-emerald">GeoPulse</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Customize your intelligence feed. You can change this anytime in Settings.
          </p>
        </div>

        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((current) => (
            <div key={current} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                  step === current
                    ? "bg-emerald text-black"
                    : step > current
                    ? "bg-emerald/20 text-emerald"
                    : "bg-white/[0.06] text-zinc-600"
                }`}
              >
                {step > current ? "OK" : current}
              </div>
              {current < 3 && (
                <div className={`h-0.5 w-8 rounded ${step > current ? "bg-emerald/40" : "bg-white/[0.06]"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="mb-6 flex justify-center gap-12 text-[10px] uppercase tracking-widest text-zinc-600">
          <span className={step === 1 ? "text-emerald" : ""}>Topics</span>
          <span className={step === 2 ? "text-emerald" : ""}>Regions</span>
          <span className={step === 3 ? "text-emerald" : ""}>Stocks</span>
        </div>

        {step === 1 && (
          <div>
            <h2 className="mb-1 text-lg font-semibold text-white">What topics interest you?</h2>
            <p className="mb-5 text-xs text-zinc-500">Select 3 or more to personalize your feed.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TOPIC_OPTIONS.map(({ key, label, icon }) => {
                const active = categories.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleItem(categories, setCategories, key)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition ${
                      active
                        ? "border-emerald/40 bg-emerald/10 text-white"
                        : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                    }`}
                  >
                    <Badge>{icon}</Badge>
                    <span className="text-sm font-medium">{label}</span>
                    {active && <span className="ml-auto text-emerald">OK</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-zinc-600">{categories.length} selected</span>
              <button
                onClick={() => setStep(2)}
                disabled={categories.length < 3}
                className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition ${
                  categories.length >= 3
                    ? "bg-emerald text-black hover:bg-emerald/90"
                    : "bg-white/[0.06] text-zinc-600 cursor-not-allowed"
                }`}
              >
                Continue -&gt;
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="mb-1 text-lg font-semibold text-white">Which regions matter to you?</h2>
            <p className="mb-5 text-xs text-zinc-500">Select the regions you want to monitor.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {REGION_OPTIONS.map(({ key, label, icon }) => {
                const active = regions.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleItem(regions, setRegions, key)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition ${
                      active
                        ? "border-emerald/40 bg-emerald/10 text-white"
                        : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                    }`}
                  >
                    <Badge>{icon}</Badge>
                    <span className="text-sm font-medium">{label}</span>
                    {active && <span className="ml-auto text-emerald">OK</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-white/[0.06] px-4 py-2 text-sm text-zinc-400 hover:bg-white/[0.04] transition"
              >
                &lt;- Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={regions.length === 0}
                className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition ${
                  regions.length > 0
                    ? "bg-emerald text-black hover:bg-emerald/90"
                    : "bg-white/[0.06] text-zinc-600 cursor-not-allowed"
                }`}
              >
                Continue -&gt;
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="mb-1 text-lg font-semibold text-white">What stocks do you follow?</h2>
            <p className="mb-5 text-xs text-zinc-500">Select the ETFs and stocks you want to track.</p>
            <div className="mb-5 rounded-xl border border-emerald/15 bg-emerald/5 p-4 text-[11px] leading-5 text-zinc-400">
              <p className="font-semibold text-white">What happens next</p>
              <p className="mt-1">You will land on the dashboard with your feed tuned to these interests. The best first check-in is Morning Brief, then one saved view for the region or sector you care about most.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POPULAR_SYMBOLS.map(({ symbol, name }) => {
                const active = symbols.includes(symbol);
                return (
                  <button
                    key={symbol}
                    onClick={() => toggleItem(symbols, setSymbols, symbol)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-emerald/40 bg-emerald/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className={`text-sm font-bold ${active ? "text-white" : "text-zinc-400"}`}>
                      {symbol}
                    </span>
                    <p className={`mt-0.5 text-[10px] ${active ? "text-emerald/70" : "text-zinc-600"}`}>
                      {name}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setStep(2)}
                className="rounded-lg border border-white/[0.06] px-4 py-2 text-sm text-zinc-400 hover:bg-white/[0.04] transition"
              >
                &lt;- Back
              </button>
              <button
                onClick={handleFinish}
                disabled={saving || symbols.length === 0}
                className={`rounded-lg px-8 py-2.5 text-sm font-semibold transition ${
                  symbols.length > 0 && !saving
                    ? "bg-emerald text-black hover:bg-emerald/90"
                    : "bg-white/[0.06] text-zinc-600 cursor-not-allowed"
                }`}
              >
                {saving ? "Saving..." : "Start Exploring -&gt;"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition"
          >
            Skip for now - I&apos;ll customize later
          </button>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps = requireAuth;
