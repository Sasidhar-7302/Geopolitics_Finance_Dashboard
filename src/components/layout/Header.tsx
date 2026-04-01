import { useState } from "react";
import { useStatus } from "../../lib/hooks/useStatus";
import { relativeTime } from "../../lib/format";
import { useEntitlements } from "../../lib/hooks/useEntitlements";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

export default function Header({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { status } = useStatus();
  const { entitlements } = useEntitlements();
  const [signingOut, setSigningOut] = useState(false);

  const lastSync = status?.lastIngestion?.completedAt
    ? relativeTime(status.lastIngestion.completedAt)
    : "never";

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
    <header className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] px-4 py-3 sm:px-5" data-testid="header">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">
                GeoPulse <span className="text-gradient">Intelligence</span>
              </h1>

            </div>
            <p className="text-[11px] text-zinc-500">
              Geopolitical signals linked to market movements
            </p>
          </div>
          {onOpenNavigation ? (
            <button
              type="button"
              onClick={onOpenNavigation}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.06] lg:hidden"
              aria-label="Open navigation"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            {entitlements?.accessLabel || "Free"}
          </span>
          <span className="chip">
            <span className={`h-1.5 w-1.5 rounded-full ${
              status?.lastIngestion?.status === "success" ? "bg-emerald" : "bg-zinc-500"
            }`} />
            Synced {lastSync}
          </span>
          <button
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
