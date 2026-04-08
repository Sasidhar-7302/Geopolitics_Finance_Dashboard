import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { startScheduler } from "../../lib/ingest/scheduler";
import { applyPublicReadGuard, sendPublicApiError } from "../../lib/publicApi";
import { serializeSourceHealthIssue, summarizeSourceHealth } from "../../lib/reliability";

// Vercel uses vercel.json cron jobs. Keep the in-process scheduler for self-hosted runtimes only.
if (process.env.VERCEL !== "1") {
  startScheduler();
}

function normalizeLastJob(
  lastLog: {
    id: string;
    status: string;
    eventsFound: number;
    startedAt: Date;
    completedAt: Date | null;
    error: string | null;
  } | null,
  lastJob: {
    id: string;
    kind: string;
    stage: string | null;
    status: string;
    itemsProcessed: number;
    startedAt: Date;
    completedAt: Date | null;
    error: string | null;
  } | null
) {
  if (!lastLog && !lastJob) return null;

  const staleRunningThresholdMs = 15 * 60 * 1000;

  if (!lastJob) {
    return {
      id: `log:${lastLog!.id}`,
      kind: "ingestion",
      stage: lastLog!.status === "success" ? "completed" : "ingest",
      status: lastLog!.status,
      itemsProcessed: lastLog!.eventsFound,
      startedAt: lastLog!.startedAt,
      completedAt: lastLog!.completedAt,
      error: lastLog!.error,
      derived: true,
    };
  }

  const staleRunningJob =
    lastJob.status === "running" &&
    !lastJob.completedAt &&
    (
      (lastLog?.completedAt !== null && lastLog?.completedAt !== undefined && lastLog.completedAt >= lastJob.startedAt) ||
      Date.now() - lastJob.startedAt.getTime() > staleRunningThresholdMs
    );

  if (lastLog && (lastJob.startedAt < lastLog.startedAt || staleRunningJob)) {
    return {
      id: `log:${lastLog.id}`,
      kind: "ingestion",
      stage: lastLog.status === "success" ? "completed" : "ingest",
      status: lastLog.status,
      itemsProcessed: lastLog.eventsFound,
      startedAt: lastLog.startedAt,
      completedAt: lastLog.completedAt,
      error: lastLog.error,
      derived: true,
    };
  }

  return {
    ...lastJob,
    derived: false,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (
    !(await applyPublicReadGuard({
      req,
      res,
      namespace: "status-read",
      limit: 120,
      windowMs: 60 * 1000,
      cacheControl: "public, s-maxage=15, stale-while-revalidate=60",
    }))
  ) {
    return;
  }

  try {
    const [lastLog, lastCompletedLog, rawLastJob, eventCount, correlationCount, patternCount, recentEvents, degradedSources, sourceHealthRows] = await Promise.all([
      prisma.ingestionLog.findFirst({
        orderBy: { startedAt: "desc" },
      }),
      // Also fetch the most recent *completed* ingestion so sync time is never "never"
      // when a new run is still in progress.
      prisma.ingestionLog.findFirst({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      }),
      prisma.ingestionJob.findFirst({
        orderBy: { startedAt: "desc" },
      }),
      prisma.event.count(),
      prisma.correlation.count(),
      prisma.pattern.count(),
      prisma.event.count({
        where: {
          publishedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.sourceHealth.count({
        where: {
          status: { in: ["degraded", "failed"] },
        },
      }),
      prisma.sourceHealth.findMany({
        select: {
          source: true,
          feedUrl: true,
          status: true,
          lastFetchedAt: true,
          lastSucceededAt: true,
          lastError: true,
          lastLatencyMs: true,
          failureCount: true,
          successCount: true,
          updatedAt: true,
        },
      }),
    ]);

    const lastJob = normalizeLastJob(lastLog, rawLastJob);
    const sourceHealth = summarizeSourceHealth(sourceHealthRows);

    // Use the current log's completedAt, but fall back to the most recent
    // *completed* ingestion so "Synced" never shows "never" while a run is in progress.
    const effectiveCompletedAt = lastLog?.completedAt ?? lastCompletedLog?.completedAt ?? null;

    res.status(200).json({
      lastIngestion: lastLog
        ? {
            status: lastLog.status,
            eventsFound: lastLog.eventsFound,
            startedAt: lastLog.startedAt,
            completedAt: effectiveCompletedAt,
            error: lastLog.error,
          }
        : null,
      lastJob,
      stats: {
        totalEvents: eventCount,
        recentEvents24h: recentEvents,
        totalCorrelations: correlationCount,
        totalPatterns: patternCount,
        degradedSources,
      },
      sourceHealth: {
        ...sourceHealth,
        activeIssues: sourceHealth.activeIssues.map(serializeSourceHealthIssue),
        sources: undefined,
      },
    });
  } catch {
    sendPublicApiError(res, "Unable to load system status right now.");
  }
}
