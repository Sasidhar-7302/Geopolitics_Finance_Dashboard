import { useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import SectionCard from "../components/ui/SectionCard";
import SymbolHoverCard from "../components/ui/SymbolHoverCard";
import { useStatus } from "../lib/hooks/useStatus";
import { usePreferences } from "../lib/hooks/usePreferences";
import { useEntitlements } from "../lib/hooks/useEntitlements";
import { relativeTime } from "../lib/format";
import { requireAuth } from "../lib/serverAuth";

const TOPIC_OPTIONS = [
  { key: "energy", label: "Energy & Oil" },
  { key: "conflict", label: "Conflicts & War" },
  { key: "economic", label: "Economic Policy" },
  { key: "defense", label: "Defense & Military" },
  { key: "technology", label: "Technology" },
  { key: "cyber", label: "Cybersecurity" },
  { key: "sanctions", label: "Sanctions & Tariffs" },
  { key: "political", label: "Politics & Elections" },
  { key: "healthcare", label: "Healthcare" },
  { key: "climate", label: "Climate" },
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
  "SPY", "QQQ", "GLD", "NVDA", "XLE", "TLT", "USO", "ITA",
  "SMH", "FXI", "BABA", "TSM", "VXX", "XLF", "EEM", "WEAT",
  "ICLN", "URA", "BDRY", "BITO",
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

export default function Settings() {
  const { status, mutate: mutateStatus } = useStatus();
  const { preferences, savePreferences, isLoading: prefsLoading } = usePreferences();
  const { entitlements } = useEntitlements();
  const isAdmin = Boolean(entitlements?.isAdmin);

  const [billingStatus, setBillingStatus] = useState<"idle" | "loading" | "error">("idle");
  const [digestStatus, setDigestStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [syncStatus, setSyncStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    categories: preferences.categories,
    regions: preferences.regions,
    symbols: preferences.symbols,
    timezone: preferences.timezone,
    digestHour: preferences.digestHour,
    emailDigestEnabled: preferences.emailDigestEnabled,
    deliveryChannels: preferences.deliveryChannels,
    savedViewsEnabled: preferences.savedViewsEnabled,
  });

  useEffect(() => {
    setForm({
      categories: preferences.categories,
      regions: preferences.regions,
      symbols: preferences.symbols,
      timezone: preferences.timezone,
      digestHour: preferences.digestHour,
      emailDigestEnabled: preferences.emailDigestEnabled,
      deliveryChannels: preferences.deliveryChannels,
      savedViewsEnabled: preferences.savedViewsEnabled,
    });
  }, [preferences]);

  const effectiveForm = useMemo(() => ({
    categories: form.categories.length > 0 || prefsLoading ? form.categories : preferences.categories,
    regions: form.regions.length > 0 || prefsLoading ? form.regions : preferences.regions,
    symbols: form.symbols.length > 0 || prefsLoading ? form.symbols : preferences.symbols,
    timezone: form.timezone || preferences.timezone,
    digestHour: form.digestHour || preferences.digestHour,
    emailDigestEnabled: form.emailDigestEnabled,
    deliveryChannels: form.deliveryChannels.length > 0 ? form.deliveryChannels : preferences.deliveryChannels,
    savedViewsEnabled: form.savedViewsEnabled,
  }), [form, preferences, prefsLoading]);

  const toggleItem = (list: string[], item: string) => (
    list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
  );

  const handleSavePrefs = async () => {
    setSaving(true);
    await savePreferences(effectiveForm);
    setSaving(false);
  };

  const handleDigestPreview = async () => {
    setDigestStatus("sending");
    try {
      const res = await fetch("/api/digests/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewOnly: true }),
      });
      setDigestStatus(res.ok ? "done" : "error");
    } catch {
      setDigestStatus("error");
    }
    setTimeout(() => setDigestStatus("idle"), 2500);
  };

  const handleSyncNow = async () => {
    setSyncStatus("running");
    try {
      const res = await fetch("/api/auto-sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      setSyncStatus("done");
      setTimeout(() => {
        mutateStatus();
        setSyncStatus("idle");
      }, 2000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 2500);
    }
  };

  const handleCheckout = async (interval: "monthly" | "yearly") => {
    if (entitlements?.premiumActive && !entitlements?.onTrial) return;
    setBillingStatus("loading");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Billing unavailable");
      window.location.href = data.url;
    } catch {
      setBillingStatus("error");
    }
  };

  const handlePortal = async () => {
    if (!entitlements?.canManageBilling) return;
    setBillingStatus("loading");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Portal unavailable");
      window.location.href = data.url;
    } catch {
      setBillingStatus("error");
    }
  };

  return (
    <Layout>
      <div className="space-y-4">
        <SectionCard title="Personalization" subtitle="Choose what stays closest to the top of the dashboard, map, and morning brief.">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">Topics</p>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_OPTIONS.map((option) => (
                    <SelectionChip
                      key={option.key}
                      active={effectiveForm.categories.includes(option.key)}
                      label={option.label}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          categories: toggleItem(current.categories, option.key),
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">Regions</p>
                <div className="flex flex-wrap gap-2">
                  {REGION_OPTIONS.map((option) => (
                    <SelectionChip
                      key={option.key}
                      active={effectiveForm.regions.includes(option.key)}
                      label={option.label}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          regions: toggleItem(current.regions, option.key),
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">Symbols</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SYMBOLS.map((symbol) => (
                    <SymbolHoverCard key={symbol} symbol={symbol}>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            symbols: toggleItem(current.symbols, symbol),
                          }))
                        }
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          effectiveForm.symbols.includes(symbol)
                            ? "border-cyan/30 bg-cyan/10 text-white"
                            : "border-white/[0.06] bg-black/40 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                        }`}
                      >
                        {symbol}
                      </button>
                    </SymbolHoverCard>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[24px] border border-white/[0.06] bg-black/55 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Current focus</p>
                <p className="mt-3 text-sm font-semibold text-white">
                  {effectiveForm.categories.length} topics / {effectiveForm.regions.length} regions / {effectiveForm.symbols.length} symbols
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  These selections steer ranking, digest ordering, and the most visible market links.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSavePrefs}
                disabled={saving}
                className="btn-primary w-full disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save preferences"}
              </button>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SectionCard title="Morning Brief Delivery" subtitle="Control the daily briefing schedule and preview the current output.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-zinc-500">Timezone</label>
                  <div className="flex gap-2">
                    <input
                      value={effectiveForm.timezone}
                      onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                      className="w-full rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2 text-sm text-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        }))
                      }
                      className="btn-secondary whitespace-nowrap"
                    >
                      Use browser
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-zinc-500">Digest hour</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={effectiveForm.digestHour}
                    onChange={(event) => setForm((current) => ({ ...current, digestHour: Number(event.target.value) }))}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2 text-sm text-zinc-200"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between rounded-[22px] border border-white/[0.06] bg-black/55 px-4 py-4">
                  <span>
                    <span className="block text-sm font-medium text-white">Email delivery</span>
                    <span className="text-[11px] text-zinc-500">Send the top stories at your scheduled time.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={effectiveForm.emailDigestEnabled}
                    onChange={(event) => setForm((current) => ({ ...current, emailDigestEnabled: event.target.checked }))}
                  />
                </label>

                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-sm font-semibold text-white">Digest preview</p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                    Generates a preview using your current preferences so you can validate the briefing flow.
                  </p>
                  <button type="button" onClick={handleDigestPreview} className="btn-secondary mt-4">
                    {digestStatus === "sending" ? "Preparing..." : "Preview digest"}
                  </button>
                  {digestStatus === "done" ? <p className="mt-3 text-[11px] text-emerald">Preview digest recorded successfully.</p> : null}
                  {digestStatus === "error" ? <p className="mt-3 text-[11px] text-red-400">Could not create digest preview.</p> : null}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Product Access" subtitle="Free stays usable. Premium expands capacity and persistence rather than locking the core workflow.">
            <div className="space-y-3">
              <div className="rounded-[22px] border border-white/[0.06] bg-black/55 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Current plan</p>
                <p className="mt-2 text-sm font-semibold text-white">{entitlements?.accessLabel || "Free"}</p>
              </div>
              <div className="rounded-[22px] border border-white/[0.06] bg-black/55 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Saved views</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {entitlements?.limits?.savedViews === null ? "Unlimited" : `${entitlements?.limits?.savedViews ?? 3} on free`}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/[0.06] bg-black/55 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Alerts</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {entitlements?.limits?.alerts === null ? "Unlimited" : `${entitlements?.limits?.alerts ?? 3} on free`}
                </p>
              </div>

              {entitlements?.lifetimeAccess ? (
                <div className="rounded-[22px] border border-emerald/20 bg-emerald/5 p-4">
                  <p className="text-sm font-semibold text-white">Founding lifetime premium</p>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                    This account already has lifetime premium access. Billing is not required.
                  </p>
                </div>
              ) : entitlements?.premiumActive ? (
                <div className="rounded-[22px] border border-emerald/20 bg-emerald/5 p-4">
                  <p className="text-sm font-semibold text-white">Premium is active</p>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                    {entitlements?.canManageBilling
                      ? "Open the billing portal to manage payment details."
                      : "No upgrade action is required right now."}
                  </p>
                  {entitlements?.canManageBilling ? (
                    <button type="button" onClick={handlePortal} className="btn-secondary mt-4">
                      Billing portal
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[22px] border border-amber-400/15 bg-amber-400/5 p-4">
                  <p className="text-sm font-semibold text-white">{entitlements?.onTrial ? "Premium trial" : "Premium roadmap"}</p>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                    {entitlements?.onTrial
                      ? `You are on a premium trial${typeof entitlements?.trialDaysRemaining === "number" ? ` with ${entitlements.trialDaysRemaining} day${entitlements.trialDaysRemaining === 1 ? "" : "s"} remaining` : ""}.`
                      : "Premium is priced at $8/month or $79/year and is built for heavier daily use."}
                  </p>
                  {entitlements?.billingEnabled ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleCheckout("monthly")} className="btn-primary">
                        {billingStatus === "loading" ? "Loading..." : "Monthly checkout"}
                      </button>
                      <button type="button" onClick={() => handleCheckout("yearly")} className="btn-secondary">
                        Yearly checkout
                      </button>
                    </div>
                  ) : null}
                  {billingStatus === "error" ? <p className="mt-3 text-[11px] text-red-400">Billing action failed. Try again.</p> : null}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {isAdmin ? (
          <SectionCard title="System Reliability" subtitle="Use this to confirm whether ingestion is alive, how often cron should run, and which upstream feeds are hurting coverage.">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Last ingestion</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {status?.lastIngestion?.completedAt ? relativeTime(status.lastIngestion.completedAt) : "Never"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Status {status?.lastIngestion?.status ?? "idle"}</p>
                </div>
                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Cron cadence</p>
                  <p className="mt-2 text-sm font-semibold text-white">Daily cron on Vercel Hobby</p>
                  <p className="mt-1 text-xs text-zinc-500">Fresh visits trigger on-demand stale-data sync. More frequent scheduled ingests require Vercel Pro or an external scheduler.</p>
                </div>
                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Feed network</p>
                  <p className="mt-2 text-sm font-semibold text-white">{status?.sourceHealth?.label || "Unavailable"}</p>
                  <p className="mt-1 text-xs text-zinc-500">{status?.sourceHealth?.description || "No source-health summary yet."}</p>
                </div>
                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Coverage</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {status?.stats?.totalEvents ?? 0} events / {status?.stats?.recentEvents24h ?? 0} in last 24h
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {status?.stats?.totalCorrelations ?? 0} correlations / {status?.stats?.totalPatterns ?? 0} patterns
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                  <p className="text-sm font-semibold text-white">Manual sync check</p>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                    If the surface looks stale, this triggers the same guarded sync path the client uses when data is old.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={handleSyncNow} className="btn-primary">
                      {syncStatus === "running" ? "Running..." : "Run sync now"}
                    </button>
                    <button type="button" onClick={() => mutateStatus()} className="btn-secondary">
                      Refresh status
                    </button>
                  </div>
                  {syncStatus === "done" ? <p className="mt-3 text-[11px] text-emerald">Sync request accepted.</p> : null}
                  {syncStatus === "error" ? <p className="mt-3 text-[11px] text-red-400">Sync request failed.</p> : null}
                </div>

                {(status?.sourceHealth?.activeIssues ?? []).length ? (
                  <div className="space-y-2">
                    {status?.sourceHealth?.activeIssues?.slice(0, 3).map((issue) => (
                      <div key={issue.source} className="rounded-[22px] border border-white/[0.06] bg-black/55 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{issue.source}</p>
                          <span className="chip">{issue.label}</span>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-zinc-500">{issue.note}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
