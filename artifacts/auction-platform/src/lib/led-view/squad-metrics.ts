export type SquadMetrics = {
  minimumSquadSize: number;
  maximumSquadSize: number;
  squadCap: number;
  slotsRemaining: number;
  isSquadFull: boolean;
};

/**
 * Resolve squad progress for LED / broadcast displays.
 * When maximum squad size is unset (0), fall back to minimum squad size
 * so teams show e.g. 2/8 instead of incorrectly capping at players bought.
 */
export function resolveSquadMetrics(
  playersBought: number,
  minimumSquadSize: number,
  maximumSquadSize: number,
): SquadMetrics {
  const min = minimumSquadSize > 0 ? minimumSquadSize : 0;
  const max = maximumSquadSize > 0 ? maximumSquadSize : 0;

  const squadCap = max > 0 ? max : min > 0 ? min : Math.max(playersBought, 1);

  const slotsRemaining =
    max > 0
      ? Math.max(0, max - playersBought)
      : min > 0
        ? Math.max(0, min - playersBought)
        : 0;

  const isSquadFull = max > 0 && playersBought >= max;

  return {
    minimumSquadSize: min,
    maximumSquadSize: max,
    squadCap,
    slotsRemaining,
    isSquadFull,
  };
}
