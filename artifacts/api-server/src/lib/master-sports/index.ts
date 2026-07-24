/**
 * Master-sports compatibility barrel.
 *
 * Domain ownership (do not grow this barrel):
 * - Player Registry reads / PTA: @workspace/player-registry
 * - Badminton branding rules: @workspace/sports-badminton/branding
 * - Auction → Registry sync: ./sync (Auction domain; relocate to @workspace/auction next)
 * - Badminton service integration: ./badminton (stays in api-server until sports-badminton owns services)
 */

export * from "./sync";
export * from "./sync-helpers";
export * from "./badminton";
export * from "./migrate-badminton";
export * from "./tournament-initials";
export * from "./tournament-profile";
export * from "./cricket-roster";
export * from "./cricket-stats";
export * from "./roster-assignments";
