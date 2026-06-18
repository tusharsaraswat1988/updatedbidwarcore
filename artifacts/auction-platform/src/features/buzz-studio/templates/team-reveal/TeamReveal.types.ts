/**
 * Buzz Studio — Team Reveal Template Types
 *
 * This template uses TeamRevealContract directly as its data shape.
 * No duplicate interface — the contract IS the input.
 *
 * TeamRevealContract fields used by this template:
 *   teamName           string?   — display name; monogram fallback if absent
 *   teamLogoUrl        string?   — TeamSlot shows monogram if absent
 *   sport              SportType — required, drives SportBadge
 *   captainName        string?   — optional; hides captain row if absent
 *   captainImageUrl    string?   — optional; AvatarSlot shows monogram if absent
 *   playerCount        number?   — optional squad size stat
 *   totalSpend         number?   — optional total budget stat (raw number)
 *   totalSpendDisplay  string?   — overrides totalSpend formatting when present
 *   currency           string?   — default "INR"
 *   branding           BuzzBranding? — future branding overrides
 *   metadata           ContractMetadata? — future audit / cache metadata
 */

export type { TeamRevealContract } from "../../contracts/TeamReveal.contract";
