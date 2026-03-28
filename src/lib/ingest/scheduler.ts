import { getAppUrl } from "../supabase";

let schedulerStarted = false;

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Start the background scheduler for auto-ingestion.
 * Runs every 2 hours using setInterval (no external deps).
 * Safe to call multiple times (idempotent).
 */
export function startScheduler() {
  if (schedulerStarted || process.env.VERCEL === "1") return;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[Scheduler] Skipping auto-ingestion: CRON_SECRET is not set");
    return;
  }

  schedulerStarted = true;

  setInterval(async () => {
    console.log("[Scheduler] Starting auto-ingestion at", new Date().toISOString());
    try {
      const baseUrl = getAppUrl();
      const res = await fetch(`${baseUrl}/api/cron/ingest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) {
        throw new Error(`Scheduler request failed with ${res.status}`);
      }
      const data = await res.json();
      console.log("[Scheduler] Ingestion complete:", data);
    } catch (err) {
      console.error("[Scheduler] Ingestion failed:", (err as Error).message);
    }
  }, TWO_HOURS_MS);

  console.log("[Scheduler] Auto-ingestion scheduled: every 2 hours");
}
