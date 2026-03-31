import clsx from "clsx";
import { summarizeStoryTrust } from "../../lib/trust";

type Props = {
  supportingSourcesCount?: number | null;
  sourceReliability?: number | null;
  intelligenceQuality?: number | null;
  publishedAt?: string | Date | null;
  compact?: boolean;
  className?: string;
};

export default function TrustSummary({
  supportingSourcesCount,
  sourceReliability,
  intelligenceQuality,
  publishedAt,
  compact = false,
  className,
}: Props) {
  const trust = summarizeStoryTrust({
    supportingSourcesCount,
    sourceReliability,
    intelligenceQuality,
    publishedAt,
  });

  const toneClass =
    trust.level === "high"
      ? "border-emerald/20 bg-emerald/10 text-emerald"
      : trust.level === "solid"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
      : "border-white/[0.06] bg-white/[0.03] text-zinc-400";

  return (
    <div className={clsx("flex flex-wrap gap-1.5 text-[10px]", className)}>
      <span className={clsx("rounded-full border px-2 py-1 font-semibold", toneClass)}>
        {trust.label}
      </span>
      <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-zinc-400">
        {trust.supportLabel}
      </span>
      {!compact && (
        <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-zinc-400">
          {trust.sourceLabel}
        </span>
      )}
      <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-zinc-500">
        {trust.freshnessLabel}
      </span>
    </div>
  );
}
