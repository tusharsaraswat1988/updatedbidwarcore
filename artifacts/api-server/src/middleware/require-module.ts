import type { Response } from "express";
import {
  isAuctionEnabled,
  isScoringEnabled,
  isScoringSupportedSport,
  InvalidTournamentModuleStateError,
  type TournamentModuleFlags,
} from "@workspace/platform-core";

export type TournamentWithSport = TournamentModuleFlags & {
  sport?: string | null;
  name?: string | null;
  id?: number | null;
};

export class ModuleAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: number = 403,
    public readonly code: string = "MODULE_DISABLED",
  ) {
    super(message);
    this.name = "ModuleAuthorizationError";
  }
}

/** Canonical sport string normalizer */
export function normalizeSport(sport: unknown): string {
  const s = String(sport ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "table tennis": "table_tennis",
    tabletennis: "table_tennis",
    soccer: "football",
    "field hockey": "hockey",
  };
  return aliases[s] ?? s.replace(/[\s-]+/g, "_");
}

/**
 * Checks if the auction module is authorized for this tournament.
 * Returns true only if the tournament exists and auctionEnabled is true (and state is valid).
 * Returns false if tournament is missing, auctionEnabled is false, or state is invalid (false+false).
 */
export function isAuctionModuleAllowed(
  tournament: TournamentModuleFlags | null | undefined,
): boolean {
  if (!tournament) return false;
  if (tournament.auctionEnabled === false && tournament.scoringEnabled === false) {
    return false;
  }
  return isAuctionEnabled(tournament);
}

/**
 * Checks if the scoring module is authorized for this tournament.
 * Returns true only if the tournament exists and scoringEnabled is true (and state is valid).
 * Returns false if tournament is missing, scoringEnabled is false, or state is invalid (false+false).
 */
export function isScoringModuleAllowed(
  tournament: TournamentModuleFlags | null | undefined,
): boolean {
  if (!tournament) return false;
  if (tournament.auctionEnabled === false && tournament.scoringEnabled === false) {
    return false;
  }
  return isScoringEnabled(tournament);
}

/**
 * Checks if a sport scoring module is authorized for this tournament.
 * Requires: scoringEnabled === true, tournament.sport matches expectedSport, and sport is supported for scoring.
 */
export function isSportModuleAllowed(
  tournament: TournamentWithSport | null | undefined,
  expectedSport: string,
): boolean {
  if (!isScoringModuleAllowed(tournament)) return false;
  if (!tournament?.sport) return false;
  if (!isScoringSupportedSport(tournament.sport)) return false;
  return normalizeSport(tournament.sport) === normalizeSport(expectedSport);
}

/**
 * Asserts that the tournament exists and has auction module enabled.
 * Throws InvalidTournamentModuleStateError (status 400) if false+false.
 * Throws ModuleAuthorizationError (status 403, code: "AUCTION_DISABLED") if auctionEnabled is false.
 * Throws ModuleAuthorizationError (status 404, code: "TOURNAMENT_NOT_FOUND") if tournament is null/undefined.
 */
export function assertAuctionModule(
  tournament: TournamentModuleFlags | null | undefined,
): void {
  if (!tournament) {
    throw new ModuleAuthorizationError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
  }
  if (tournament.auctionEnabled === false && tournament.scoringEnabled === false) {
    throw new InvalidTournamentModuleStateError();
  }
  if (!isAuctionEnabled(tournament)) {
    throw new ModuleAuthorizationError(
      "Auction module is not enabled for this tournament",
      403,
      "AUCTION_DISABLED",
    );
  }
}

/**
 * Asserts that the tournament exists and has sports scoring module enabled.
 * Throws InvalidTournamentModuleStateError (status 400) if false+false.
 * Throws ModuleAuthorizationError (status 403, code: "SCORING_DISABLED") if scoringEnabled is false.
 * Throws ModuleAuthorizationError (status 404, code: "TOURNAMENT_NOT_FOUND") if tournament is null/undefined.
 */
export function assertScoringModule(
  tournament: TournamentModuleFlags | null | undefined,
): void {
  if (!tournament) {
    throw new ModuleAuthorizationError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
  }
  if (tournament.auctionEnabled === false && tournament.scoringEnabled === false) {
    throw new InvalidTournamentModuleStateError();
  }
  if (!isScoringEnabled(tournament)) {
    throw new ModuleAuthorizationError(
      "Sports scoring module is not enabled for this tournament",
      403,
      "SCORING_DISABLED",
    );
  }
}

/**
 * Asserts that the tournament exists, has sports scoring enabled, and matches the expected sport.
 * Throws InvalidTournamentModuleStateError (status 400) if false+false.
 * Throws ModuleAuthorizationError (status 403, code: "SCORING_DISABLED") if scoringEnabled is false.
 * Throws ModuleAuthorizationError (status 400, code: "UNSUPPORTED_SPORT") if sport is not supported for scoring.
 * Throws ModuleAuthorizationError (status 403, code: "SPORT_MISMATCH") if sport does not match expectedSport.
 * Throws ModuleAuthorizationError (status 404, code: "TOURNAMENT_NOT_FOUND") if tournament is null/undefined.
 */
export function assertSportModule(
  tournament: TournamentWithSport | null | undefined,
  expectedSport: string,
): void {
  assertScoringModule(tournament);

  const rawSport = tournament?.sport;
  if (!rawSport || !isScoringSupportedSport(rawSport)) {
    throw new ModuleAuthorizationError(
      `Sport '${rawSport ?? "unspecified"}' is not supported for live sports scoring`,
      400,
      "UNSUPPORTED_SPORT",
    );
  }

  const normTournamentSport = normalizeSport(rawSport);
  const normExpectedSport = normalizeSport(expectedSport);

  if (normTournamentSport !== normExpectedSport) {
    throw new ModuleAuthorizationError(
      `Tournament sport '${rawSport}' does not match required sport '${expectedSport}'`,
      403,
      "SPORT_MISMATCH",
    );
  }
}

/**
 * Express guard for auction module routes.
 * Writes standard HTTP response on failure and returns false.
 * Returns true when allowed.
 */
export function requireAuctionModule(
  res: Response,
  tournament: TournamentModuleFlags | null | undefined,
): boolean {
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found", code: "TOURNAMENT_NOT_FOUND" });
    return false;
  }
  if (tournament.auctionEnabled === false && tournament.scoringEnabled === false) {
    res.status(400).json({
      error: "A tournament must have at least one enabled product module (auction or scoring).",
      code: "INVALID_MODULE_STATE",
    });
    return false;
  }
  if (!isAuctionEnabled(tournament)) {
    res.status(403).json({
      error: "Auction module is not enabled for this tournament",
      code: "AUCTION_DISABLED",
    });
    return false;
  }
  return true;
}

/**
 * Express guard for scoring module routes.
 * Writes standard HTTP response on failure and returns false.
 * Returns true when allowed.
 */
export function requireScoringModule(
  res: Response,
  tournament: TournamentModuleFlags | null | undefined,
): boolean {
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found", code: "TOURNAMENT_NOT_FOUND" });
    return false;
  }
  if (tournament.auctionEnabled === false && tournament.scoringEnabled === false) {
    res.status(400).json({
      error: "A tournament must have at least one enabled product module (auction or scoring).",
      code: "INVALID_MODULE_STATE",
    });
    return false;
  }
  if (!isScoringEnabled(tournament)) {
    res.status(403).json({
      error: "Sports scoring module is not enabled for this tournament",
      code: "SCORING_DISABLED",
    });
    return false;
  }
  return true;
}

/**
 * Express guard for sport-specific scoring module routes (e.g. cricket, badminton).
 * Writes standard HTTP response on failure and returns false.
 * Returns true when allowed.
 */
export function requireSportModule(
  res: Response,
  tournament: TournamentWithSport | null | undefined,
  expectedSport: string,
): boolean {
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found", code: "TOURNAMENT_NOT_FOUND" });
    return false;
  }
  if (tournament.auctionEnabled === false && tournament.scoringEnabled === false) {
    res.status(400).json({
      error: "A tournament must have at least one enabled product module (auction or scoring).",
      code: "INVALID_MODULE_STATE",
    });
    return false;
  }
  if (!isScoringEnabled(tournament)) {
    res.status(403).json({
      error: "Sports scoring module is not enabled for this tournament",
      code: "SCORING_DISABLED",
    });
    return false;
  }

  const rawSport = tournament.sport;
  if (!rawSport || !isScoringSupportedSport(rawSport)) {
    res.status(400).json({
      error: `Sport '${rawSport ?? "unspecified"}' is not supported for live sports scoring`,
      code: "UNSUPPORTED_SPORT",
    });
    return false;
  }

  const normTournamentSport = normalizeSport(rawSport);
  const normExpectedSport = normalizeSport(expectedSport);

  if (normTournamentSport !== normExpectedSport) {
    res.status(403).json({
      error: `Tournament sport '${rawSport}' does not match required sport '${expectedSport}'`,
      code: "SPORT_MISMATCH",
    });
    return false;
  }

  return true;
}
