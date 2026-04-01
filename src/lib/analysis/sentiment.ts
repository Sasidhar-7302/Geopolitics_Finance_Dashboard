import { prisma } from "../prisma";

// Use dynamic import since vader-sentiment is CommonJS
let vaderModule: any = null;
async function getVader() {
  if (!vaderModule) {
    vaderModule = await import("vader-sentiment");
  }
  return vaderModule;
}

export type SentimentResult = {
  score: number;    // -1 to +1 compound score
  label: "positive" | "negative" | "neutral";
  pos: number;
  neg: number;
  neu: number;
};

/**
 * Analyze sentiment of a text string using VADER.
 * VADER is optimized for social media / news headlines.
 * Returns compound score (-1 to +1) and label.
 */
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const vader = await getVader();
  const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(text);

  let label: SentimentResult["label"] = "neutral";
  if (intensity.compound >= 0.05) label = "positive";
  else if (intensity.compound <= -0.05) label = "negative";

  return {
    score: intensity.compound,
    label,
    pos: intensity.pos,
    neg: intensity.neg,
    neu: intensity.neu,
  };
}

/**
 * Analyze sentiment for all events that don't have it yet.
 * Called during ingestion pipeline.
 */
export async function analyzeEventSentiments() {
  const events = await prisma.event.findMany({
    where: { sentimentScore: null },
    select: { id: true, title: true, summary: true },
    take: 50,
  });

  if (events.length === 0) return { analyzed: 0 };

  const updates: Array<{ id: string; score: number; label: SentimentResult["label"] }> = [];
  for (const event of events) {
    try {
      const text = `${event.title}. ${event.summary}`;
      const result = await analyzeSentiment(text);
      updates.push({
        id: event.id,
        score: result.score,
        label: result.label,
      });
    } catch (err) {
      console.warn(`[Sentiment] Failed for event ${event.id}:`, (err as Error).message);
    }
  }

  for (const update of updates) {
    await prisma.event.update({
      where: { id: update.id },
      data: {
        sentimentScore: update.score,
        sentimentLabel: update.label,
      },
    });
  }

  console.log(`[Sentiment] Analyzed ${updates.length} events`);
  return { analyzed: updates.length };
}
