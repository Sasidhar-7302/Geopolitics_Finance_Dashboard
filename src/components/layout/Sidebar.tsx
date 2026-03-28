import NavLink from "../ui/NavLink";
import { useStatus } from "../../lib/hooks/useStatus";
import { useEntitlements } from "../../lib/hooks/useEntitlements";

export default function Sidebar() {
  const { status } = useStatus();
  const { entitlements } = useEntitlements();

  return (
    <aside className="flex h-full flex-col gap-4 rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4">
      <div className="flex items-center gap-2.5 px-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald/15 text-xs font-bold text-emerald">
          G
        </div>
        <div>
          <p className="text-sm font-bold text-white">GeoPulse</p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavLink href="/dashboard" label="Dashboard" icon="grid" />
        <NavLink href="/digest" label="Morning Brief" icon="clock" />
        <NavLink href="/timeline" label="Timeline" icon="clock" />
        <NavLink href="/map" label="Global Map" icon="globe" />
        <NavLink href="/assets" label="Watchlist" icon="chart" />
        <NavLink href="/alerts" label="Alerts" icon="bell" />
        <NavLink href="/settings" label="Settings" icon="settings" />
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
          {entitlements?.premiumActive ? "Premium plan" : entitlements?.betaUnlocked ? "Free beta plan" : "Free plan"} | {status?.stats?.degradedSources ?? 0} degraded sources
        </p>
      </div>
    </aside>
  );
}
