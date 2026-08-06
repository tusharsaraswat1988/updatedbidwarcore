/**
 * Runtime bridge layer (temporary until Rule Engine).
 * NOT part of Product public API — do not expose adapter DTOs over HTTP.
 */

export type {
  BadmintonMatchFormatDto,
  CricketPlatformDefaultsDto,
  FootballPlatformDefaultsDto,
  RuntimeAdapter,
  RuntimeAdapterResult,
} from "./contracts/types.ts";

/** Transitional EPIC-02 adapters — deprecate → remove after Scoring cutover (not Rule Engine). */
export { BadmintonRuntimeAdapter } from "./adapters/badminton.ts";
export { CricketRuntimeAdapter } from "./adapters/cricket.ts";
export { FootballRuntimeAdapter } from "./adapters/football.ts";
