import NavLink from "../ui/NavLink";
import { useStatus } from "../../lib/hooks/useStatus";
import { useEntitlements } from "../../lib/hooks/useEntitlements";
import { useWorkspace } from "../../lib/hooks/useWorkspace";

export default function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const { status } = useStatus();
  const { entitlements } = useEntitlements();
  const { workspace } = useWorkspace();
  const isAdmin = Boolean(entitlements?.isAdmin);
  const syncLabel =
    status?.lastIngestion?.status === "success" ? "Live" : status?.lastIngestion?.status === "failed" ? "Degraded" : "Idle";

  return (
    <aside className="command-surface flex h-full flex-col gap-6 p-5">
      <div className="flex items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan/10 text-sm font-bold text-cyan">
            G
          </div>
          <div>
            <p className="text-sm font-semibold text-white">GeoPulse</p>
            <p className="text-[11px] text-zinc-500">Finance-grade geopolitical operating surface</p>
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

      <div className="rounded-[24px] border border-white/[0.05] bg-black/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Operator status</p>
            <p className="mt-2 text-sm font-semibold text-white">{syncLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Plan</p>
            <p className="mt-2 text-sm font-semibold text-white">{entitlements?.accessLabel || "Free"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">Workspace</p>
        <nav className="flex flex-col gap-1">
        <NavLink href="/dashboard" label="Dashboard" icon="grid" onClick={onNavigate} />
        <NavLink href="/digest" label="Morning Brief" icon="clock" onClick={onNavigate} />
        <NavLink href="/timeline" label="Timeline" icon="clock" onClick={onNavigate} />
        <NavLink href="/map" label="Global Map" icon="globe" onClick={onNavigate} />
        <NavLink href="/assets" label="Watchlist" icon="chart" onClick={onNavigate} />
        <NavLink href="/alerts" label="Alerts" icon="bell" onClick={onNavigate} />
        <NavLink href="/settings" label="Settings" icon="settings" onClick={onNavigate} />
        </nav>
      </div>

      <div className="rounded-[24px] border border-white/[0.05] bg-black/35 p-4 text-[11px]">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Pinned scope</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {workspace.pinnedRegions.length === 0 && workspace.pinnedSymbols.length === 0 ? (
            <span className="text-zinc-500">Pin regions and symbols from the dashboard to keep them in view here.</span>
          ) : null}
          {workspace.pinnedRegions.map((region) => (
            <span key={region} className="chip">{region}</span>
          ))}
          {workspace.pinnedSymbols.map((symbol) => (
            <span key={symbol} className="chip">{symbol}</span>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-[24px] border border-white/[0.05] bg-black/35 p-4 text-[11px]">
        {isAdmin ? (
          <>
            <div className="mb-2 flex items-center justify-between">
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
            <p className="text-zinc-600">{status?.stats?.totalEvents ?? 0} events / {status?.stats?.totalCorrelations ?? 0} links</p>
            <p className="mt-1 text-zinc-600">
              {(entitlements?.accessLabel || "Free")} plan / {status?.stats?.degradedSources ?? 0} degraded feeds
            </p>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-zinc-400">Account</span>
              <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald">
                ACTIVE
              </span>
            </div>
            <p className="text-zinc-600">{entitlements?.accessLabel || "Free"} plan</p>
            <p className="mt-1 text-zinc-600">Workspace view: {workspace.activeView}</p>
          </>
        )}
      </div>
    </aside>
  );
}
