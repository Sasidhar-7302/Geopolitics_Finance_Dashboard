import { prisma } from "../prisma";

export async function recordSourceHealth(params: {
  source: string;
  feedUrl: string;
  status: "ok" | "degraded" | "failed";
  latencyMs?: number;
  error?: string;
}) {
  const now = new Date();

  await prisma.sourceHealth.upsert({
    where: {
      source_feedUrl: {
        source: params.source,
        feedUrl: params.feedUrl,
      },
    },
    update: {
      status: params.status,
      lastFetchedAt: now,
      lastSucceededAt: params.status === "ok" ? now : undefined,
      lastError: params.error || null,
      lastLatencyMs: params.latencyMs ? Math.round(params.latencyMs) : undefined,
      successCount: {
        increment: params.status === "ok" ? 1 : 0,
      },
      failureCount: {
        increment: params.status === "failed" ? 1 : 0,
      },
    },
    create: {
      source: params.source,
      feedUrl: params.feedUrl,
      status: params.status,
      lastFetchedAt: now,
      lastSucceededAt: params.status === "ok" ? now : undefined,
      lastError: params.error,
      lastLatencyMs: params.latencyMs ? Math.round(params.latencyMs) : undefined,
      successCount: params.status === "ok" ? 1 : 0,
      failureCount: params.status === "failed" ? 1 : 0,
    },
  });
}
