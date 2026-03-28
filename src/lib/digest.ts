import { prisma } from "./prisma";
import { parseStringArray, stringifyStringArray } from "./json";
import { bootstrapUserProductState } from "./userBootstrap";
import { buildEventWhere } from "./eventFilters";
import { summarizeEventIntelligence } from "./intelligence";
import { getEntitlementSnapshot } from "./entitlements";

type DigestStory = {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: string;
  publishedAt: Date;
  whyThisMatters: string | null;
  supportingSourcesCount: number;
  category: string;
  correlations: Array<{ symbol: string; impactDirection: string; impactScore: number }>;
};

type DigestScheduleCandidate = {
  id: string;
  userId: string;
  timezone: string;
  digestHour: number;
  enabled: boolean;
};

export async function buildPersonalizedDigest(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preference: true,
      digest: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  await bootstrapUserProductState(user.id, {
    timezone: user.preference?.timezone || user.digest?.timezone || "UTC",
    digestHour: user.preference?.digestHour || user.digest?.digestHour || 7,
    deliveryChannels: parseStringArray(user.preference?.deliveryChannels || user.digest?.deliveryChannels),
  });

  const prefs = user.preference;
  const digest = await prisma.digestSubscription.findUnique({ where: { userId: user.id } });
  const entitlements = await getEntitlementSnapshot(user.id);

  const preferredCategories = parseStringArray(prefs?.categories);
  const preferredRegions = parseStringArray(prefs?.regions);
  const preferredSymbols = parseStringArray(prefs?.symbols);

  const baseWhere = buildEventWhere({
    from: "36h",
    severityMin: 3,
  });

  const events = await prisma.event.findMany({
    where: baseWhere,
    orderBy: [{ publishedAt: "desc" }],
    take: 40,
    include: {
      correlations: {
        select: {
          symbol: true,
          impactDirection: true,
          impactScore: true,
        },
      },
    },
  });

  const rankedStories = events
    .map((event) => {
      let preferenceBoost = 0;

      if (preferredCategories.includes(event.category)) preferenceBoost += 2;
      if (preferredRegions.includes(event.region)) preferenceBoost += 1.5;
      if (event.correlations.some((corr) => preferredSymbols.includes(corr.symbol))) preferenceBoost += 2;

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

      return {
        ...event,
        whyThisMatters: intelligence.whyThisMatters,
        personalizedScore: intelligence.relevanceScore + preferenceBoost,
      };
    })
    .sort((a, b) => b.personalizedScore - a.personalizedScore);

  const limit = entitlements.limits.digestStories ?? Math.max(digest?.topStories ?? 5, 10);
  const stories = rankedStories.slice(0, limit) as DigestStory[];

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    timezone: digest?.timezone || prefs?.timezone || "UTC",
    digestHour: digest?.digestHour || prefs?.digestHour || 7,
    stories,
    sections: {
      topStories: stories.slice(0, 5),
      watchlistSignals: stories.filter((story) =>
        story.correlations.some((corr) => preferredSymbols.includes(corr.symbol))
      ).slice(0, 5),
      regions: preferredRegions,
    },
    entitlements,
  };
}

export async function recordDigestDelivery(params: {
  userId: string;
  digestSubscriptionId?: string | null;
  payload: unknown;
  status: string;
  provider?: string;
  dedupeKey: string;
  messageId?: string;
}) {
  return prisma.emailDelivery.upsert({
    where: { dedupeKey: params.dedupeKey },
    update: {
      payload: JSON.stringify(params.payload),
      status: params.status,
      provider: params.provider,
      messageId: params.messageId,
      sentAt: new Date(),
    },
    create: {
      userId: params.userId,
      digestSubscriptionId: params.digestSubscriptionId || undefined,
      type: "morning_digest",
      status: params.status,
      provider: params.provider,
      messageId: params.messageId,
      dedupeKey: params.dedupeKey,
      payload: JSON.stringify(params.payload),
      sentAt: new Date(),
    },
  });
}

export function buildDigestDedupeKey(userId: string, timezone: string, date: Date = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  return `${userId}:morning-digest:${day}`;
}

export function serializeDigestChannels(channels: string[]) {
  return stringifyStringArray(channels.length > 0 ? channels : ["email"]);
}

export function isDigestDueNow(candidate: DigestScheduleCandidate, date: Date = new Date()) {
  if (!candidate.enabled) return false;

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: candidate.timezone || "UTC",
      hour: "2-digit",
      hour12: false,
    }).format(date)
  );

  return hour === candidate.digestHour;
}

export async function sendDueDigests(date: Date = new Date()) {
  const subscriptions = await prisma.digestSubscription.findMany({
    where: { enabled: true },
    select: {
      id: true,
      userId: true,
      timezone: true,
      digestHour: true,
      enabled: true,
    },
  });

  const results: Array<{
    userId: string;
    status: "sent" | "skipped" | "failed";
    reason?: string;
    deliveryId?: string;
  }> = [];

  for (const subscription of subscriptions) {
    if (!isDigestDueNow(subscription, date)) {
      results.push({
        userId: subscription.userId,
        status: "skipped",
        reason: "not_due_this_hour",
      });
      continue;
    }

    const dedupeKey = buildDigestDedupeKey(subscription.userId, subscription.timezone, date);
    const existing = await prisma.emailDelivery.findUnique({
      where: { dedupeKey },
    });

    if (existing?.status === "simulated" || existing?.status === "sent") {
      results.push({
        userId: subscription.userId,
        status: "skipped",
        reason: "already_processed",
        deliveryId: existing.id,
      });
      continue;
    }

    try {
      const digest = await buildPersonalizedDigest(subscription.userId);
      const delivery = await recordDigestDelivery({
        userId: subscription.userId,
        digestSubscriptionId: subscription.id,
        payload: digest,
        status: "simulated",
        provider: "scheduled-digest",
        dedupeKey,
      });

      await prisma.digestSubscription.update({
        where: { id: subscription.id },
        data: { lastSentAt: date },
      });

      results.push({
        userId: subscription.userId,
        status: "sent",
        deliveryId: delivery.id,
      });
    } catch (error) {
      const delivery = await recordDigestDelivery({
        userId: subscription.userId,
        digestSubscriptionId: subscription.id,
        payload: {
          error: (error as Error).message,
          attemptedAt: date.toISOString(),
        },
        status: "failed",
        provider: "scheduled-digest",
        dedupeKey,
      });

      results.push({
        userId: subscription.userId,
        status: "failed",
        reason: (error as Error).message,
        deliveryId: delivery.id,
      });
    }
  }

  return {
    processedAt: date.toISOString(),
    scanned: subscriptions.length,
    sent: results.filter((item) => item.status === "sent").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    results,
  };
}
