import NavLink from "../ui/NavLink";
import { useStatus } from "../../lib/hooks/useStatus";
import { useEntitlements } from "../../lib/hooks/useEntitlements";

export default function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const { status } = useStatus();
  const { entitlements } = useEntitlements();

  return (
    <aside className="flex h-full flex-col gap-4 rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4">
      <div className="flex items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald/15 text-xs font-bold text-emerald">
            G
          </div>
          <div>
            <p className="text-sm font-bold text-white">GeoPulse</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200 lg:hidden"
            aria-label="Close navigation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavLink href="/dashboard" label="Dashboard" icon="grid" onClick={onNavigate} />
        <NavLink href="/digest" label="Morning Brief" icon="clock" onClick={onNavigate} />
        <NavLink href="/timeline" label="Timeline" icon="clock" onClick={onNavigate} />
        <NavLink href="/map" label="Global Map" icon="globe" onClick={onNavigate} />
        <NavLink href="/assets" label="Watchlist" icon="chart" onClick={onNavigate} />
        <NavLink href="/alerts" label="Alerts" icon="bell" onClick={onNavigate} />
        <NavLink href="/settings" label="Settings" icon="settings" onClick={onNavigate} />
      </nav>

      <div className="mt-auto rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-[11px]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-zinc-400">System</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
              status?.lastIngestion?.status === "success"
                ? "bg-emerald/10 text-emerald"
                : status?.lastIngestion?.status === "failed"
                ? "bg-red-500/10 text-red-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {status?.lastIngestion?.status === "success" ? "LIVE" : status?.lastIngestion?.status === "failed" ? "ERR" : "IDLE"}
          </span>
        </div>
        <p className="text-zinc-600">{status?.stats?.totalEvents ?? 0} events | {status?.stats?.totalCorrelations ?? 0} links</p>
        <p className="mt-1 text-zinc-600">
          {(entitlements?.accessLabel || "Free")} plan | {status?.stats?.degradedSources ?? 0} degraded sources
        </p>
      </div>
    </aside>
  );
}
