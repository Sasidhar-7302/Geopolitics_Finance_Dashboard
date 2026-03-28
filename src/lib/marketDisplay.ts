type Direction = string | null | undefined;

function asFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function toSignedMagnitude(direction: Direction, magnitude: number | null | undefined) {
  const amount = Math.abs(asFiniteNumber(magnitude) ?? 0);
  return direction === "down" ? -amount : amount;
}

export function resolveCorrelationDisplay(params: {
  liveChange?: number | null;
  impactDirection?: Direction;
  impactMagnitude?: number | null;
}) {
  const liveChange = asFiniteNumber(params.liveChange);
  if (typeof liveChange === "number") {
    return {
      change: liveChange,
      source: "quote" as const,
    };
  }

  return {
    change: toSignedMagnitude(params.impactDirection, params.impactMagnitude),
    source: "modeled" as const,
  };
}

export function resolveCorrelationMove(params: {
  liveChange?: number | null;
  impactDirection?: Direction;
  impactMagnitude?: number | null;
}) {
  return resolveCorrelationDisplay(params).change;
}

export function resolvePatternMove(direction: Direction, avgImpactPct: number | null | undefined) {
  return toSignedMagnitude(direction, avgImpactPct);
}
