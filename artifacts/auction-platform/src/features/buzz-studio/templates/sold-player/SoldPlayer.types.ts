/**
 * Buzz Studio — Sold Player Template Types
 *
 * This template uses SoldPlayerContract directly as its data shape.
 * No duplicate interface — the contract IS the input.
 *
 * SoldPlayerContract fields used by this template:
 *   playerName        string    — required, monogram fallback source
 *   playerImageUrl    string?   — optional, PlayerSlot shows monogram if absent
 *   teamName          string?   — optional, TeamSlot shows monogram if absent
 *   teamLogoUrl       string?   — optional
 *   sport             SportType — required, drives SportBadge
 *   soldPrice         number    — required, formatted by SoldPlayer.utils
 *   soldPriceDisplay  string?   — overrides soldPrice formatting when present
 *   currency          string?   — default "INR"
 *   bidCount          number?   — optional, shows "N Bids" if present
 *   designation       string?   — optional role label (e.g. "Batsman")
 *   branding          BuzzBranding? — future branding overrides
 *   metadata          ContractMetadata? — future audit / cache metadata
 */

export type { SoldPlayerContract } from "../../contracts/SoldPlayer.contract";
