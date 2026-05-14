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
};

export type PlayerLite = {
  id: number;
  name: string;
  city?: string | null;
  role?: string | null;
  photoUrl?: string | null;
  basePrice: number;
  soldPrice?: number | null;
  status: string;
  teamId?: number | null;
  categoryId?: number | null;
};

export type CategoryLite = { id: number; name: string };

export type DisplayPlayerFilter = {
  status: string;
  categoryId?: number | null;
  teamId?: number | null;
} | null;
