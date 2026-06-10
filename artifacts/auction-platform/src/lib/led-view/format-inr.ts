export function formatINR(n: number): string {
  if (n >= 1_00_00_000) {
    const cr = n / 1_00_00_000;
    return `₹${cr.toFixed(cr >= 10 ? 1 : 2)} CR`;
  }
  if (n >= 1_00_000) {
    const lakh = n / 1_00_000;
    return `₹${lakh.toFixed(lakh >= 10 ? 1 : 2)} L`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatINRFull(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function nextIncrement(
  currentBid: number,
  tiers: { upTo: number; step: number }[],
  baseStep = 0,
  observedStep = 0,
): number {
  if (observedStep > 0) return observedStep;
  if (baseStep > 0) return baseStep;
  const tierStep =
    tiers.find((t) => currentBid < t.upTo)?.step ?? tiers[tiers.length - 1]?.step ?? 0;
  return tierStep > 0 ? tierStep : 10_000;
}
