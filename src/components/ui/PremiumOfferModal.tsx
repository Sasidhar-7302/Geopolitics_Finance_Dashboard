import { useState } from "react";

interface PremiumOfferModalProps {
  trialEndDate?: Date | null;
  lifetimeAccess?: boolean;
  onSkip: () => void;
}

export default function PremiumOfferModal({
  trialEndDate,
  lifetimeAccess = false,
  onSkip,
}: PremiumOfferModalProps) {
  const [upgrading, setUpgrading] = useState(false);
  const daysRemaining = trialEndDate
    ? Math.max(
        1,
        Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : null;
  const isLifetimePremium = lifetimeAccess;

  const handleUpgrade = async (interval: "monthly" | "yearly") => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch (error) {
      console.error("Failed to start checkout:", error);
    }
    setUpgrading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-emerald/20 bg-gradient-to-b from-black to-black/80 p-8 shadow-2xl">
        <div className="mb-6">
          <h2 className="mb-2 text-2xl font-bold text-white">
            {isLifetimePremium ? "Welcome to Premium" : "Your Premium Trial Is Live"}
          </h2>
          <p className="text-sm text-zinc-400">
            {isLifetimePremium
              ? "You are one of the first 10 users. Premium is unlocked for life."
              : `You have ${daysRemaining ?? 7} days of premium access left in your trial.`}
          </p>
        </div>

        <div className="mb-8 space-y-3">
          {[
            {
              title: "Unlimited alerts and watchlists",
              detail: "Never miss critical market moves.",
            },
            {
              title: "Premium insights",
              detail: "Deeper analysis of geopolitical market impact.",
            },
            {
              title: "Faster market refresh",
              detail: "Higher-frequency quote and signal updates.",
            },
            {
              title: "Intraday digests",
              detail: "Extra briefings beyond the morning report.",
            },
          ].map((feature) => (
            <div key={feature.title} className="flex gap-3">
              <span className="text-sm font-bold text-emerald">OK</span>
              <div>
                <p className="text-sm font-semibold text-white">{feature.title}</p>
                <p className="text-xs text-zinc-500">{feature.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {!isLifetimePremium && (
          <div className="mb-8 space-y-3">
            <button
              onClick={() => handleUpgrade("monthly")}
              disabled={upgrading}
              className="w-full rounded-lg bg-emerald px-4 py-3 font-semibold text-black transition hover:bg-emerald/90 disabled:opacity-50"
            >
              {upgrading ? "Opening checkout..." : "Upgrade Now - $8/month"}
            </button>
            <button
              onClick={() => handleUpgrade("yearly")}
              disabled={upgrading}
              className="w-full rounded-lg border border-emerald/30 bg-emerald/5 px-4 py-3 font-semibold text-emerald transition hover:bg-emerald/10 disabled:opacity-50"
            >
              {upgrading ? "Opening checkout..." : "Best Value - $79/year"}
            </button>
          </div>
        )}

        <button
          onClick={onSkip}
          disabled={upgrading}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] disabled:opacity-50"
        >
          {isLifetimePremium ? "Continue to dashboard" : "Skip for now"}
        </button>

        {!isLifetimePremium && trialEndDate && (
          <p className="mt-4 text-center text-xs text-zinc-500">
            Your 7-day trial ends on{" "}
            <strong>{trialEndDate.toLocaleDateString()}</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
