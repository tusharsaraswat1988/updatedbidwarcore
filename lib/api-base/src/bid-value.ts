export type BidValueMode = "system" | "player";
export type BidValueSource = "system" | "player";

export interface BidValueTournamentConfig {
  bidValueMode?: string | null;
  minBid: number;
  bidValueOptions?: string | null;
}

export interface BidValuePlayerInput {
  basePrice?: number;
  selectedBidValue?: number;
}

export interface ResolvedPlayerBidFields {
  basePrice: number;
  selectedBidValue: number | null;
  bidValueSource: BidValueSource | null;
}

/** Parse organizer-defined bid value options from JSON text. Returns sorted ascending values. */
export function parseBidValueOptions(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const values = parsed
      .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
      .filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(values)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function serializeBidValueOptions(values: number[]): string {
  const cleaned = [...new Set(values.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
  return JSON.stringify(cleaned);
}

export function isPlayerBidValueMode(config: Pick<BidValueTournamentConfig, "bidValueMode">): boolean {
  return config.bidValueMode === "player";
}

export function bidValueSourceLabel(source: BidValueSource | null | undefined): string {
  return source === "player" ? "Player Selected" : "System Assigned";
}

/**
 * Resolve stored player bid fields from tournament config + input.
 * Player-selected mode replaces only the starting input (basePrice); category logic downstream is unchanged.
 */
export function resolvePlayerBidFields(
  tournament: BidValueTournamentConfig,
  input: BidValuePlayerInput,
): { ok: true; fields: ResolvedPlayerBidFields } | { ok: false; error: string; field?: string } {
  if (isPlayerBidValueMode(tournament)) {
    const options = parseBidValueOptions(tournament.bidValueOptions);
    if (options.length === 0) {
      return {
        ok: false,
        error: "Player-selected bid values are not configured for this tournament.",
        field: "selectedBidValue",
      };
    }
    const selected = input.selectedBidValue ?? input.basePrice;
    if (selected == null || !Number.isFinite(selected)) {
      return { ok: false, error: "Please select your bid value.", field: "selectedBidValue" };
    }
    if (!options.includes(selected)) {
      return { ok: false, error: "Selected bid value is not allowed.", field: "selectedBidValue" };
    }
    return {
      ok: true,
      fields: {
        basePrice: selected,
        selectedBidValue: selected,
        bidValueSource: "player",
      },
    };
  }

  const basePrice = input.basePrice ?? tournament.minBid ?? 100000;
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return { ok: false, error: "Base price must be a positive amount.", field: "basePrice" };
  }
  return {
    ok: true,
    fields: {
      basePrice,
      selectedBidValue: null,
      bidValueSource: "system",
    },
  };
}

/** Whether organizer may edit player bid value fields (before auction starts). */
export function canEditPlayerBidValue(tournamentStatus: string | null | undefined): boolean {
  return tournamentStatus === "setup";
}
