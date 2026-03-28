import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { startScheduler } from "../../lib/ingest/scheduler";

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

  if (lastLog && lastJob.startedAt < lastLog.startedAt) {
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

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const [lastLog, rawLastJob, eventCount, correlationCount, patternCount, recentEvents, degradedSources] = await Promise.all([
    prisma.ingestionLog.findFirst({
      orderBy: { startedAt: "desc" },
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
  ]);

  const lastJob = normalizeLastJob(lastLog, rawLastJob);

  res.status(200).json({
    lastIngestion: lastLog
      ? {
          status: lastLog.status,
          eventsFound: lastLog.eventsFound,
          startedAt: lastLog.startedAt,
          completedAt: lastLog.completedAt,
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
  });
}
