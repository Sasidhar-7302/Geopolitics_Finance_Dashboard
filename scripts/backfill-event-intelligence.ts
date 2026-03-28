import { prisma } from "../src/lib/prisma";
import { summarizeEventIntelligence } from "../src/lib/intelligence";

async function main() {
  const batchSize = 200;
  const updateBatchSize = 25;
  let cursor: string | undefined;
  let processed = 0;

  while (true) {
    const events = await prisma.event.findMany({
      take: batchSize,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        correlations: {
          select: {
            symbol: true,
          },
        },
      },
    });

    if (events.length === 0) {
      break;
    }

    for (let index = 0; index < events.length; index += updateBatchSize) {
      const chunk = events.slice(index, index + updateBatchSize);

      await Promise.all(
        chunk.map((event) => {
          const intelligence = summarizeEventIntelligence({
            title: event.title,
            summary: event.summary,
            region: event.region,
            category: event.category,
            severity: event.severity,
            publishedAt: event.publishedAt,
            supportingSourcesCount: event.supportingSourcesCount,
            sourceReliability: event.sourceReliability ?? undefined,
            symbols: event.correlations.map((corr) => corr.symbol),
          });

          return prisma.event.update({
            where: { id: event.id },
            data: {
              category: intelligence.category,
              whyThisMatters: intelligence.whyThisMatters,
              relevanceScore: intelligence.relevanceScore,
            },
          });
        })
      );
    }

    processed += events.length;
    cursor = events[events.length - 1]?.id;
    console.log(`Processed ${processed} events`);
  }

  console.log(`Backfilled intelligence for ${processed} events`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
