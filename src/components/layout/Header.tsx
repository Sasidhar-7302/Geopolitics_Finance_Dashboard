import { useState } from "react";
import { useStatus } from "../../lib/hooks/useStatus";
import { relativeTime } from "../../lib/format";
import { useEntitlements } from "../../lib/hooks/useEntitlements";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

export default function Header() {
  const { status, mutate } = useStatus();
  const { entitlements } = useEntitlements();
  const [syncing, setSyncing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const lastSync = status?.lastIngestion?.completedAt
    ? relativeTime(status.lastIngestion.completedAt)
    : "never";

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        // Refresh status after sync
        mutate();
      }
    } catch {
      // silently fail
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await getSupabaseBrowserClient().auth.signOut();
      window.location.href = "/";
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0A0A0A] px-5 py-3">
      <div>
        <h1 className="text-base font-bold text-white">
          GeoPulse <span className="text-gradient">Intelligence</span>
        </h1>
        <p className="text-[11px] text-zinc-500">
          Geopolitical signals linked to market movements
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="chip">
          {entitlements?.premiumActive ? "Premium" : entitlements?.betaUnlocked ? "Free beta" : "Free"}
        </span>
        <span className="chip">
          <span className={`h-1.5 w-1.5 rounded-full ${
            status?.lastIngestion?.status === "success" ? "bg-emerald" : "bg-zinc-500"
          }`} />
          Synced {lastSync}
        </span>
        <button
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-400 transition hover:text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
        <button
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </header>
  );
}
