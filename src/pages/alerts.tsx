import { useState } from "react";
import Layout from "../components/layout/Layout";
import SectionCard from "../components/ui/SectionCard";
import { useAlerts } from "../lib/hooks/useAlerts";
import { useEntitlements } from "../lib/hooks/useEntitlements";
import { requireAuth } from "../lib/serverAuth";

export default function Alerts() {
  const { alerts, isLoading, mutate } = useAlerts();
  const { entitlements } = useEntitlements();
  const [form, setForm] = useState({ name: "", condition: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Failed");
      setForm({ name: "", condition: "" });
      setStatus("done");
      mutate();
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  };

  return (
    <Layout>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <SectionCard title="Active Alerts" subtitle="Notification triggers and watch rules">
          {entitlements?.limits?.alerts !== null && (
            <p className="mb-3 rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-[11px] text-zinc-500">
              Free tier limit: {alerts.length}/{entitlements?.limits?.alerts ?? 3} active alerts. Premium will unlock unlimited alerting after beta.
            </p>
          )}
          <div className="space-y-2">
            {alerts.length === 0 && !isLoading ? (
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-6 text-center">
                <p className="text-sm text-slate">No alerts configured yet.</p>
                <p className="mt-1 text-xs text-slate">Create your first alert using the form.</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div
                  key={`${alert.name}-${i}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-ink">{alert.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        alert.status === "armed"
                          ? "bg-emerald/10 text-emerald"
                          : alert.status === "triggered"
                          ? "bg-danger/10 text-danger"
                          : "bg-white/[0.05] text-slate"
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate">{alert.condition}</p>
                </div>
              ))
            )}
          </div>
          {isLoading && <p className="mt-3 text-xs text-slate animate-pulse">Loading alerts...</p>}
        </SectionCard>

        <SectionCard title="Create Alert" subtitle="Set up a new watch rule">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink placeholder:text-slate focus:border-emerald/40 focus:outline-none"
              placeholder="Alert name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <textarea
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink placeholder:text-slate focus:border-emerald/40 focus:outline-none"
              placeholder="Condition (e.g., XLE > 2% in 4h)"
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              rows={3}
              required
            />
            <button type="submit" className="btn-primary w-full">
              {status === "saving" ? "Saving..." : "Create Alert"}
            </button>
            {status === "done" && <p className="text-xs text-emerald">Alert created.</p>}
            {status === "error" && <p className="text-xs text-danger">Could not create alert.</p>}
          </form>
        </SectionCard>
      </div>
    </Layout>
  );
}

export const getServerSideProps = requireAuth;
