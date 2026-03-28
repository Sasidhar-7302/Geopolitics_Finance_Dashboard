import type { Prisma } from "@prisma/client";

export type EventSortKey = "newest" | "severity" | "relevance" | "support";

export type EventFilterInput = {
  q?: string;
  regions?: string[];
  categories?: string[];
  symbols?: string[];
  direction?: string;
  severityMin?: number;
  from?: string;
  to?: string;
  timeWindow?: string;
  sort?: EventSortKey;
  limit?: number;
  cursor?: string;
};

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;

  if (/^\d+[hdw]$/.test(value)) {
    const amount = Number(value.slice(0, -1));
    const unit = value.slice(-1);
    const hours = unit === "h" ? amount : unit === "d" ? amount * 24 : amount * 24 * 7;
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseArrayParam(value: string | string[] | undefined): string[] {
  if (!value) return [];

  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildEventWhere(filters: EventFilterInput): Prisma.EventWhereInput {
  const and: Prisma.EventWhereInput[] = [];

  if (filters.severityMin && filters.severityMin > 0) {
    and.push({ severity: { gte: filters.severityMin } });
  }

  if (filters.regions && filters.regions.length > 0) {
    and.push({ region: { in: filters.regions } });
  }

  if (filters.categories && filters.categories.length > 0) {
    and.push({ category: { in: filters.categories } });
  }

  if (filters.symbols && filters.symbols.length > 0) {
    and.push({
      correlations: {
        some: {
          symbol: { in: filters.symbols.map((item) => item.toUpperCase()) },
        },
      },
    });
  }

  if (filters.direction && filters.direction !== "all") {
    if (filters.direction === "none") {
      and.push({ correlations: { none: {} } });
    } else if (filters.direction === "mixed") {
      and.push({
        AND: [
          { correlations: { some: { impactDirection: "up" } } },
          { correlations: { some: { impactDirection: "down" } } },
        ],
      });
    } else {
      and.push({
        correlations: {
          some: {
            impactDirection: filters.direction,
          },
        },
      });
    }
  }

  const from = parseDate(filters.from || filters.timeWindow);
  const to = parseDate(filters.to);
  if (from || to) {
    and.push({
      publishedAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }

  if (filters.q) {
    const query = filters.q.trim();
    const symbolQuery = query.toUpperCase();

    and.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
        { source: { contains: query, mode: "insensitive" } },
        { region: { contains: query, mode: "insensitive" } },
        { whyThisMatters: { contains: query, mode: "insensitive" } },
        { tags: { contains: query, mode: "insensitive" } },
        {
          correlations: {
            some: {
              symbol: symbolQuery,
            },
          },
        },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildEventOrderBy(sort: EventSortKey = "relevance"): Prisma.EventOrderByWithRelationInput[] {
  switch (sort) {
    case "severity":
      return [{ severity: "desc" }, { publishedAt: "desc" }];
    case "support":
      return [{ supportingSourcesCount: "desc" }, { relevanceScore: "desc" }, { publishedAt: "desc" }];
    case "newest":
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
    case "relevance":
    default:
      return [{ relevanceScore: "desc" }, { supportingSourcesCount: "desc" }, { severity: "desc" }, { publishedAt: "desc" }];
  }
}
