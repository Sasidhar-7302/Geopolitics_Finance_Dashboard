import { prisma } from "../prisma";

export async function createIngestionJob(kind: string, source = "all") {
  return prisma.ingestionJob.create({
    data: {
      kind,
      source,
      status: "running",
      stage: "fetch",
      attempts: 1,
    },
  });
}

export async function updateIngestionJob(
  jobId: string,
  params: {
    stage?: string;
    status?: string;
    itemsProcessed?: number;
    error?: string | null;
    completed?: boolean;
  }
) {
  return prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      ...(params.stage ? { stage: params.stage } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.itemsProcessed === "number" ? { itemsProcessed: params.itemsProcessed } : {}),
      ...(params.error !== undefined ? { error: params.error } : {}),
      ...(params.completed ? { completedAt: new Date() } : {}),
    },
  });
}
