import { useEffect, useRef } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export type IngestionStatus = {
  lastIngestion: {
    status: string;
    eventsFound: number;
    startedAt: string;
    completedAt: string | null;
    error: string | null;
  } | null;
  stats: {
    totalEvents: number;
    recentEvents24h: number;
    totalCorrelations: number;
    totalPatterns: number;
    degradedSources: number;
  };
  lastJob?: {
    id: string;
    kind?: string;
    stage?: string | null;
    status: string;
    itemsProcessed: number;
    startedAt: string;
    completedAt?: string | null;
    error?: string | null;
    derived?: boolean;
  } | null;
};

export function useStatus() {
  const { data, error, isLoading, mutate } = useSWR<IngestionStatus>("/api/status", fetcher, {
    refreshInterval: 60000,
  });

  const syncTriggered = useRef(false);

  // When data arrives and is stale, trigger auto-sync once per session
  useEffect(() => {
    if (!data || syncTriggered.current) return;

    const completedAt = data.lastIngestion?.completedAt;
    const completedMs = completedAt ? new Date(completedAt).getTime() : 0;
    const isStale = Date.now() - completedMs > STALE_THRESHOLD_MS;
    const isRunning = data.lastIngestion?.status === "running";

    if (isStale && !isRunning) {
      syncTriggered.current = true;
      fetch("/api/auto-sync", { method: "POST" })
        .then((res) => {
          if (res.ok) {
            // Refresh status data after sync completes
            setTimeout(() => mutate(), 2000);
          }
        })
        .catch(() => {
          // Reset so it can retry on next mount
          syncTriggered.current = false;
        });
    }
  }, [data, mutate]);

  return {
    status: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
