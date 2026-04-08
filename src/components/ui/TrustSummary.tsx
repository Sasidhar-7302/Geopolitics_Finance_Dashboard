import clsx from "clsx";
import { summarizeStoryTrust } from "../../lib/trust";
import type { EventReliability } from "../../lib/reliability";

type Props = {
  supportingSourcesCount?: number | null;
  sourceReliability?: number | null;
  intelligenceQuality?: number | null;
  publishedAt?: string | Date | null;
  compact?: boolean;
  className?: string;
  reliability?: EventReliability | null;
};

export default function TrustSummary({
  supportingSourcesCount,
  sourceReliability,
  intelligenceQuality,
  publishedAt,
  compact = false,
  className,
  reliability,
}: Props) {
  const trust = reliability
    ? {
        level: reliability.level,
        label: reliability.label,
        supportLabel: reliability.corroborationLabel,
        sourceLabel: reliability.sourceQualityLabel,
        freshnessLabel: reliability.freshnessLabel,
      }
    : summarizeStoryTrust({
        supportingSourcesCount,
        sourceReliability,
        intelligenceQuality,
        publishedAt,
      });

  const toneClass =
    trust.level === "high"
      ? "border-emerald/20 bg-emerald/10 text-emerald"
      : trust.level === "solid"
      ? "border-cyan/20 bg-cyan/10 text-cyan"
      : "border-amber-400/20 bg-amber-400/10 text-amber-300";

  return (
    <div className={clsx("flex flex-wrap gap-1.5 text-[10px]", className)}>
      <span className={clsx("rounded-full border px-2 py-1 font-semibold", toneClass)}>
        {trust.label}
      </span>
      <span className="rounded-full border border-white/[0.06] bg-black/45 px-2 py-1 text-zinc-400">
        {trust.supportLabel}
      </span>
      {!compact && (
        <span className="rounded-full border border-white/[0.06] bg-black/45 px-2 py-1 text-zinc-400">
          {trust.sourceLabel}
        </span>
      )}
      <span className="rounded-full border border-white/[0.06] bg-black/45 px-2 py-1 text-zinc-500">
        {trust.freshnessLabel}
      </span>
      {reliability ? (
        <span className="rounded-full border border-white/[0.06] bg-black/45 px-2 py-1 text-zinc-500">
          {reliability.feedHealthLabel}
        </span>
      ) : null}
    </div>
  );
}
