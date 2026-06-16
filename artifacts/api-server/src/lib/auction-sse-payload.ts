import type { TeamPurseSnapshot } from "./team-purse-snapshot";

export type BuiltAuctionState = Record<string, unknown> & {
  fortuneWheelActive?: boolean;
  wheelSpinning?: boolean;
  wheelItems?: unknown[];
  wheelWinner?: string | null;
  licenseStatus?: string;
  trialTeamIds?: number[] | null;
  deferredPlayerIds?: number[] | null;
  teamPurses?: TeamPurseSnapshot[];
};

/** Strip infrequently-needed fields from SSE wire payload to reduce bandwidth. */
export function compactAuctionStateForSse(state: BuiltAuctionState): BuiltAuctionState {
  const compact: BuiltAuctionState = { ...state };

  if (!state.fortuneWheelActive && !state.wheelSpinning) {
    delete compact.wheelItems;
    if (!state.wheelWinner) delete compact.wheelWinner;
  }

  if (state.licenseStatus === "active") {
    delete compact.trialTeamIds;
  }

  return compact;
}
