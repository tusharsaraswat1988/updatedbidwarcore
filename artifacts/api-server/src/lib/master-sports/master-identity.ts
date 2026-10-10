/** True when this master id is not already another player in the same tournament. */
export function masterIdentityAvailable(
  masterId: string,
  claimedMasterIds?: ReadonlySet<string>,
): boolean {
  return !claimedMasterIds?.has(masterId);
}
