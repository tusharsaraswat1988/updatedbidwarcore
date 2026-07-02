/**
 * Shared types for the LED display broadcast.
 * All overlay/card components consume these — they are kept narrow on
 * purpose so memoized leaves get stable shallow-equal props.
 */

export type WheelItem = { label: string; color: string };

export type SoldRecord = {
  playerName: string;
  photoUrl: string | null | undefined;
  amount: number;
  teamName: string;
  teamColor: string;
  teamShortCode?: string;
  teamLogoUrl?: string | null;
};

export type SoldPhase = "stamp" | "card" | null;

export type UnsoldRecord = {
  playerName: string;
  photoUrl: string | null | undefined;
};

export type PurseRow = {
  teamId: number;
  teamName: string;
  shortCode: string;
  ownerName?: string;
  color: string | null | undefined;
  logoUrl?: string | null;
  purse: number;
  purseUsed: number;
  purseRemaining: number;
  playersBought: number;
  retainedCount?: number;
  reservePurse?: number;
  spendablePurse?: number;
  slotsRequired?: number;
  minimumSquadSize?: number;
  maximumSquadSize?: number;
  lowestBasePrice?: number;
  topPlayerName?: string | null;
  topPlayerAmount?: number | null;
};

export type PlayerLite = {
  id: number;
  name: string;
  serialNo?: number | null;
  city?: string | null;
  role?: string | null;
  photoUrl?: string | null;
  basePrice: number;
  soldPrice?: number | null;
  retainedPrice?: number | null;
  status: string;
  teamId?: number | null;
  categoryId?: number | null;
  playerTag?: string | null;
  playerTagTeamId?: number | null;
  isNonPlayingMember?: boolean;
};

export type CategoryLite = { id: number; name: string };

export type DisplayPlayerFilter = {
  status: string;
  categoryId?: number | null;
  teamId?: number | null;
} | null;
