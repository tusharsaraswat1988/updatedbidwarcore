/**
 * @workspace/player-registry — Platform Player Registry domain.
 *
 * Franchise assignments (PTA), cricket opaque-id resolution, player identity helpers.
 * Auction → Registry sync adapters live in @workspace/auction (Auction writes; this package reads).
 */

export * from "./cricket-franchise-registry";
export * from "./roster-assignments";
export * from "./sync-helpers";
export * from "./player-gender";
export * from "./player-tag-label";
export * from "./jersey-size";
export { isPlayerSpecsV2Enabled } from "./player-specs-v2";
export { isPlayerSportProfilesEnabled } from "./player-sport-profiles";
export * from "./player-spec-export";
