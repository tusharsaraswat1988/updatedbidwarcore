/** Effective auction purse capacity = original team purse + active boosters. */
export function computeEffectiveCapacity(originalPurse: number, boosterTotal: number): number {
  return originalPurse + boosterTotal;
}

export function computePurseRemaining(effectiveCapacity: number, purseUsed: number): number {
  return effectiveCapacity - purseUsed;
}

export function assertCapacityNotBelowUsed(
  effectiveCapacity: number,
  purseUsed: number,
): { ok: true } | { ok: false; error: string } {
  if (effectiveCapacity < purseUsed) {
    return {
      ok: false,
      error: `Capacity cannot fall below purse used (₹${purseUsed.toLocaleString("en-IN")})`,
    };
  }
  return { ok: true };
}
