import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { requireAuth } from "../lib/serverAuth";
import PremiumOfferModal from "../components/ui/PremiumOfferModal";

const TOPIC_OPTIONS = [
  { key: "energy", label: "Energy & Oil" },
  { key: "conflict", label: "Conflicts & Wars" },
  { key: "economic", label: "Economic Policy" },
  { key: "defense", label: "Defense & Military" },
  { key: "technology", label: "Technology" },
  { key: "cyber", label: "Cybersecurity" },
  { key: "sanctions", label: "Sanctions & Tariffs" },
  { key: "political", label: "Elections & Politics" },
  { key: "healthcare", label: "Healthcare" },
  { key: "climate", label: "Climate & Environment" },
  { key: "agriculture", label: "Agriculture & Food" },
  { key: "trade", label: "Trade & Shipping" },
  { key: "threat", label: "Nuclear & Threats" },
  { key: "science", label: "Science" },
];

const REGION_OPTIONS = [
  { key: "North America", label: "North America" },
  { key: "Europe", label: "Europe" },
  { key: "Middle East", label: "Middle East" },
  { key: "Asia-Pacific", label: "Asia-Pacific" },
  { key: "Africa", label: "Africa" },
  { key: "South America", label: "South America" },
  { key: "Central Asia", label: "Central Asia" },
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
  { symbol: "TSM", name: "Taiwan Semi" },
  { symbol: "VXX", name: "Volatility" },
];

function SelectionChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-cyan/30 bg-cyan/10 text-white"
          : "border-white/[0.06] bg-black/40 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>(["SPY", "QQQ", "GLD"]);
  const [saving, setSaving] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [trialEnd, setTrialEnd] = useState<Date | null>(null);
  const [lifetimeAccess, setLifetimeAccess] = useState(false);
  const [onTrial, setOnTrial] = useState(false);

  useEffect(() => {
    const fetchTrialInfo = async () => {
      try {
        const res = await fetch("/api/me/entitlements");
        const data = await res.json();
        if (data.trialEnd) setTrialEnd(new Date(data.trialEnd));
        setLifetimeAccess(Boolean(data.lifetimeAccess));
        setOnTrial(Boolean(data.onTrial));
      } catch (error) {
        console.error("Failed to fetch trial info:", error);
      }
    };
    fetchTrialInfo();
  }, []);

  const toggleItem = (list: string[], setList: (value: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);
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

      if (lifetimeAccess || onTrial) {
        setShowPremiumModal(true);
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="shell-backdrop flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl space-y-6">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-black/60 text-lg font-bold text-cyan">
              G
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">Set up your operating surface</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Choose what matters so the dashboard, map, and morning brief start in the right place.
            </p>
          </div>

          <div className="command-surface p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.05] pb-5">
              <div>
                <p className="kicker">Step {step} of 3</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {step === 1 ? "Choose topics" : step === 2 ? "Choose regions" : "Choose symbols"}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  {step === 1
                    ? "Pick the themes you want ranked highest."
                    : step === 2
                    ? "Select the regions you want visible first."
                    : "Choose the assets you want linked to your feed."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((current) => (
                  <div
                    key={current}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                      step === current
                        ? "bg-cyan text-black"
                        : step > current
                        ? "bg-cyan/15 text-cyan"
                        : "border border-white/[0.06] bg-black/40 text-zinc-500"
                    }`}
                  >
                    {current}
                  </div>
                ))}
              </div>
            </div>

            {step === 1 ? (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {TOPIC_OPTIONS.map((option) => (
                    <SelectionChip
                      key={option.key}
                      active={categories.includes(option.key)}
                      label={option.label}
                      onClick={() => toggleItem(categories, setCategories, option.key)}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">{categories.length} topics selected</p>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={categories.length < 3}
                    className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition ${
                      categories.length >= 3 ? "bg-cyan text-black hover:bg-cyan/90" : "bg-white/[0.06] text-zinc-600"
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {REGION_OPTIONS.map((option) => (
                    <SelectionChip
                      key={option.key}
                      active={regions.includes(option.key)}
                      label={option.label}
                      onClick={() => toggleItem(regions, setRegions, option.key)}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={regions.length === 0}
                    className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition ${
                      regions.length > 0 ? "bg-cyan text-black hover:bg-cyan/90" : "bg-white/[0.06] text-zinc-600"
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4 text-sm leading-6 text-zinc-400">
                  The first view after setup will prioritize these symbols across your dashboard, map drawer, and briefing.
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {POPULAR_SYMBOLS.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => toggleItem(symbols, setSymbols, item.symbol)}
                      className={`rounded-xl border p-3 text-left transition ${
                        symbols.includes(item.symbol)
                          ? "border-cyan/30 bg-cyan/10"
                          : "border-white/[0.06] bg-black/40 hover:bg-white/[0.04]"
                      }`}
                    >
                      <p className={`text-sm font-semibold ${symbols.includes(item.symbol) ? "text-white" : "text-zinc-300"}`}>
                        {item.symbol}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{item.name}</p>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={saving || symbols.length === 0}
                    className={`rounded-lg px-8 py-2.5 text-sm font-semibold transition ${
                      symbols.length > 0 && !saving ? "bg-cyan text-black hover:bg-cyan/90" : "bg-white/[0.06] text-zinc-600"
                    }`}
                  >
                    {saving ? "Saving..." : "Open dashboard"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-sm text-zinc-500 transition hover:text-zinc-300"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>

      {showPremiumModal ? (
        <PremiumOfferModal
          trialEndDate={trialEnd}
          lifetimeAccess={lifetimeAccess}
          onSkip={() => router.push("/dashboard")}
        />
      ) : null}
    </>
  );
}

export const getServerSideProps = requireAuth;
