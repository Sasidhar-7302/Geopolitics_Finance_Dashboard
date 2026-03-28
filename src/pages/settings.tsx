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

export default function Settings() {
  const { status, mutate: mutateStatus } = useStatus();
  const { preferences, savePreferences, isLoading: prefsLoading } = usePreferences();
  const { entitlements } = useEntitlements();

  const [triggerStatus, setTriggerStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [billingStatus, setBillingStatus] = useState<"idle" | "loading" | "error">("idle");
  const [digestStatus, setDigestStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
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
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
  );

  const handleSavePrefs = async () => {
    setSaving(true);
    await savePreferences(effectiveForm);
    setSaving(false);
  };

  const handleManualIngest = async () => {
    setTriggerStatus("running");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      setTriggerStatus(res.ok ? "done" : "error");
      mutateStatus();
    } catch {
      setTriggerStatus("error");
    }
    setTimeout(() => setTriggerStatus("idle"), 3000);
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

  const handleCheckout = async (interval: "monthly" | "yearly") => {
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
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="Interests" subtitle="Tune the dashboard and digest around what you actually follow.">
            {prefsLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-white/[0.03]" />
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-zinc-400">Topics</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {TOPIC_OPTIONS.map(({ key, label }) => {
                      const active = effectiveForm.categories.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => setForm((current) => ({
                            ...current,
                            categories: toggleItem(current.categories, key),
                          }))}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                            active
                              ? "border-emerald/30 bg-emerald/10 text-emerald"
                              : "border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold text-zinc-400">Regions</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {REGION_OPTIONS.map(({ key, label }) => {
                      const active = effectiveForm.regions.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => setForm((current) => ({
                            ...current,
                            regions: toggleItem(current.regions, key),
                          }))}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                            active
                              ? "border-emerald/30 bg-emerald/10 text-emerald"
                              : "border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold text-zinc-400">Stocks & ETFs</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SYMBOLS.map((symbol) => {
                      const active = effectiveForm.symbols.includes(symbol);
                      return (
                        <SymbolHoverCard key={symbol} symbol={symbol}>
                          <button
                            onClick={() => setForm((current) => ({
                              ...current,
                              symbols: toggleItem(current.symbols, symbol),
                            }))}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                              active
                                ? "border-emerald/30 bg-emerald/10 text-emerald"
                                : "border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                            }`}
                          >
                            {symbol}
                          </button>
                        </SymbolHoverCard>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleSavePrefs}
                  disabled={saving}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Morning Brief" subtitle="Build a daily habit with a 7am local-market briefing.">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Timezone</label>
                <div className="flex gap-2">
                  <input
                    value={effectiveForm.timezone}
                    onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-sm text-zinc-200"
                  />
                  <button
                    onClick={() => setForm((current) => ({
                      ...current,
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    }))}
                    className="ghost-chip whitespace-nowrap hover:bg-white/[0.06]"
                  >
                    Use browser
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Digest hour</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={effectiveForm.digestHour}
                  onChange={(event) => setForm((current) => ({ ...current, digestHour: Number(event.target.value) }))}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-3 py-2 text-sm text-zinc-200"
                />
              </div>

              <label className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
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

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Daily digest preview</p>
                    <p className="text-[11px] text-zinc-500">Creates a preview delivery using your current preferences.</p>
                  </div>
                  <button onClick={handleDigestPreview} className="ghost-chip hover:bg-white/[0.06]">
                    {digestStatus === "sending" ? "Preparing..." : "Preview"}
                  </button>
                </div>
                {digestStatus === "done" && <p className="mt-2 text-[11px] text-emerald">Preview digest recorded successfully.</p>}
                {digestStatus === "error" && <p className="mt-2 text-[11px] text-red-400">Could not create digest preview.</p>}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <SectionCard title="Product Access" subtitle="Free accounts get the full core workflow. Premium expands limits, speed, and briefing depth.">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-zinc-500">Current plan</span>
                <span className="text-sm font-semibold text-white">
                  {entitlements?.premiumActive ? "Premium" : entitlements?.betaUnlocked ? "Free beta" : "Free"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-zinc-500">Saved views</span>
                <span className="text-sm font-semibold text-white">
                  {entitlements?.limits?.savedViews === null ? "Unlimited" : `${entitlements?.limits?.savedViews ?? 3} on free`}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-zinc-500">Alerts</span>
                <span className="text-sm font-semibold text-white">
                  {entitlements?.limits?.alerts === null ? "Unlimited" : `${entitlements?.limits?.alerts ?? 3} on free`}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-zinc-500">Founding beta</span>
                <span className="text-sm font-semibold text-white">
                  {entitlements?.betaSpotsRemaining && entitlements.betaSpotsRemaining > 0
                    ? `${entitlements.betaSpotsRemaining} spots remaining`
                    : "Closed"}
                </span>
              </div>
              <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4">
                <p className="text-sm font-semibold text-white">Premium roadmap</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Premium is priced at $8/month or $79/year. The public site stays previewable without an account, while free accounts keep the full core workflow.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => handleCheckout("monthly")} className="btn-primary">
                    {billingStatus === "loading" ? "Loading..." : "Start monthly checkout"}
                  </button>
                  <button onClick={() => handleCheckout("yearly")} className="ghost-chip hover:bg-white/[0.06]">
                    Yearly checkout
                  </button>
                  <button onClick={handlePortal} className="ghost-chip hover:bg-white/[0.06]">
                    Billing portal
                  </button>
                </div>
                {billingStatus === "error" && (
                  <p className="mt-2 text-[11px] text-red-400">
                    Billing is not configured yet in this environment. Add Stripe env vars before turning it on.
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="System Reliability" subtitle="Operational signals for ingestion, sources, and background jobs.">
            <div className="space-y-2">
              {[
                { label: "Last ingestion", value: status?.lastIngestion?.completedAt ? relativeTime(status.lastIngestion.completedAt) : "Never" },
                { label: "Pipeline status", value: status?.lastIngestion?.status ?? "idle" },
                { label: "Current stage", value: status?.lastJob?.stage ?? "n/a" },
                { label: "Total events", value: (status?.stats?.totalEvents ?? 0).toString() },
                { label: "Correlations", value: (status?.stats?.totalCorrelations ?? 0).toString() },
                { label: "Patterns", value: (status?.stats?.totalPatterns ?? 0).toString() },
                { label: "Degraded sources", value: (status?.stats?.degradedSources ?? 0).toString() },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <span className="text-sm text-zinc-500">{item.label}</span>
                  <span className="text-sm font-semibold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Automation" subtitle="Admin-only pipeline controls once ADMIN_EMAILS is configured.">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-zinc-500">Auto-ingest cycle</span>
                <span className="text-sm font-semibold text-white">Scheduled + manual sync</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-zinc-500">Morning digest</span>
                <span className="text-sm font-semibold text-white">{effectiveForm.emailDigestEnabled ? "Enabled" : "Disabled"}</span>
              </div>
              <button
                onClick={handleManualIngest}
                disabled={triggerStatus === "running"}
                className="btn-primary w-full disabled:opacity-50"
              >
                {triggerStatus === "running"
                  ? "Running ingestion..."
                  : triggerStatus === "done"
                  ? "Ingestion complete"
                  : triggerStatus === "error"
                  ? "Sync failed or not permitted"
                  : "Trigger manual ingestion"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Access Ladder" subtitle="Anonymous preview, full free account, then premium for heavier daily use.">
            <div className="space-y-2 text-[11px] text-zinc-500">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-semibold text-white">Public preview</p>
                <p className="mt-1">Anonymous users can see a live sample of top stories, market movers, and regional hotspots before creating an account.</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-semibold text-white">Free account</p>
                <p className="mt-1">Dashboard, timeline, digest, one watchlist, three alerts, three saved views, and the top five digest stories.</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-semibold text-white">Premium</p>
                <p className="mt-1">Unlimited alerts, unlimited watchlists and saved views, deeper explainers, faster market refresh, and richer briefing flows.</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-semibold text-white">Ads</p>
                <p className="mt-1">No programmatic ads. If you ever monetize free surfaces with sponsors, keep it to tasteful sponsor slots only.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
