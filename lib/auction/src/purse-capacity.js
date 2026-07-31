/** Effective auction purse capacity = original team purse + active boosters. */
export function computeEffectiveCapacity(originalPurse, boosterTotal) {
    return originalPurse + boosterTotal;
}
export function computePurseRemaining(effectiveCapacity, purseUsed) {
    return effectiveCapacity - purseUsed;
}
export function assertCapacityNotBelowUsed(effectiveCapacity, purseUsed) {
    if (effectiveCapacity < purseUsed) {
        return {
            ok: false,
            error: `Capacity cannot fall below purse used (₹${purseUsed.toLocaleString("en-IN")})`,
        };
    }
    return { ok: true };
}
