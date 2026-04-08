import { useState } from "react";
import { useStatus } from "../../lib/hooks/useStatus";
import { relativeTime } from "../../lib/format";
import { useEntitlements } from "../../lib/hooks/useEntitlements";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

export default function Header({
  onOpenNavigation,
  onOpenCommandPalette,
}: {
  onOpenNavigation?: () => void;
  onOpenCommandPalette?: () => void;
}) {
  const { status } = useStatus();
  const { entitlements } = useEntitlements();
  const [signingOut, setSigningOut] = useState(false);
  const isAdmin = Boolean(entitlements?.isAdmin);

  const lastSync = status?.lastIngestion?.completedAt
    ? relativeTime(status.lastIngestion.completedAt)
    : "never";
  const feedHealthScore = Math.round((status?.sourceHealth?.healthScore ?? 0) * 100);

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
    <header className="command-surface px-4 py-4 sm:px-5" data-testid="header">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="kicker">Command Center</span>
              <span className={`h-2 w-2 rounded-full ${status?.lastIngestion?.status === "success" ? "bg-emerald" : status?.lastIngestion?.status === "failed" ? "bg-red-400" : "bg-amber-400"}`} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white sm:text-xl">
                Dashboard
              </h1>
              <p className="text-sm text-zinc-500">
                Track the top region, validate signal integrity, and move into research fast.
              </p>
            </div>
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
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="status-pill min-w-[210px] justify-between text-left"
          >
            <span className="text-zinc-400">Search pages or workspace</span>
            <span className="rounded-full border border-white/8 px-2 py-1 text-[10px] text-zinc-500">Ctrl K</span>
          </button>
          <span className="chip">
            {entitlements?.accessLabel || "Free"}
          </span>
          <span className="chip">
            {status?.sourceHealth?.label || "Feed health unavailable"} {status?.sourceHealth ? `${feedHealthScore}/100` : ""}
          </span>
          <span className="chip">
            {isAdmin ? (
              <span className={`h-1.5 w-1.5 rounded-full ${
                status?.lastIngestion?.status === "success"
                  ? "bg-emerald"
                  : status?.lastIngestion?.status === "failed"
                  ? "bg-red-400"
                  : "bg-zinc-500"
              }`} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
            )}
            {isAdmin ? `Synced ${lastSync}` : `Updated ${lastSync}`}
          </span>
          <button
            className="status-pill disabled:opacity-50"
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
