function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type StoryTrustLevel = "high" | "solid" | "developing";

export function summarizeStoryTrust(params: {
  supportingSourcesCount?: number | null;
  sourceReliability?: number | null;
  intelligenceQuality?: number | null;
  publishedAt?: string | Date | null;
}) {
  const supportCount = Math.max(1, params.supportingSourcesCount ?? 1);
  const sourceReliability = clamp(params.sourceReliability ?? 0.75, 0, 1);
  const intelligenceQuality = clamp(params.intelligenceQuality ?? 0.5, 0, 1);
  const supportScore = clamp(0.35 + Math.min(0.65, (supportCount - 1) * 0.24), 0, 1);
  const overallScore = Number(
    clamp(
      intelligenceQuality * 0.5 + sourceReliability * 0.25 + supportScore * 0.25,
      0,
      1
    ).toFixed(2)
  );

  const level: StoryTrustLevel =
    overallScore >= 0.78 && supportCount >= 2
      ? "high"
      : overallScore >= 0.6 || (supportCount >= 2 && overallScore >= 0.54)
      ? "solid"
      : "developing";

  const label =
    level === "high"
      ? "High-confidence signal"
      : level === "solid"
      ? "Confirmed signal"
      : "Developing signal";

  const supportLabel =
    supportCount >= 3
      ? `${supportCount} confirming sources`
      : supportCount === 2
      ? "2 confirming sources"
      : "Single-source developing story";

  const sourceLabel =
    sourceReliability >= 0.9
      ? "Top-tier source mix"
      : sourceReliability >= 0.82
      ? "Reliable source mix"
      : "Mixed source quality";

  let freshnessLabel = "Recent context";
  if (params.publishedAt) {
    const publishedAt = params.publishedAt instanceof Date
      ? params.publishedAt.getTime()
      : new Date(params.publishedAt).getTime();

    if (!Number.isNaN(publishedAt)) {
      const ageHours = Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60));
      freshnessLabel =
        ageHours <= 6
          ? "Fresh signal"
          : ageHours <= 24
          ? "Last 24h"
          : ageHours <= 72
          ? "Last 72h"
          : "Older context";
    }
  }

  return {
    level,
    label,
    supportLabel,
    sourceLabel,
    freshnessLabel,
    overallScore,
    intelligenceQuality,
  };
}
