/**
 * Buzz Studio — Monogram Generator
 *
 * Derives short initials from team names and player names.
 * Used as avatar/logo fallbacks when no image is available.
 *
 * No external dependencies. No image rendering.
 * Pure string transformation only.
 */

import type { MonogramResult } from "./asset-types";

/* ─── Stop-words stripped before extracting initials ─────────────────────── */

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "and", "or", "in", "at", "by", "to",
  "for", "on", "with", "fc", "sc", "ac", "bc", "cc", "xi",
]);

/* ─── Public API ─────────────────────────────────────────────────────────── */

/**
 * Generate initials from a team name.
 *
 * Strategy:
 *  1. Split on whitespace.
 *  2. Remove stop-words.
 *  3. Take the first letter of each meaningful word.
 *  4. Return first two initials, uppercased.
 *  5. If only one word remains → use its first two characters.
 *  6. If input is empty → return "?".
 *
 * @example
 * teamMonogram("Varanasi Warriors")   // → { initials: "VW", source: "Varanasi Warriors" }
 * teamMonogram("Mumbai Indians")      // → { initials: "MI", source: "Mumbai Indians" }
 * teamMonogram("FC Barcelona")        // → { initials: "BA", source: "FC Barcelona" }
 * teamMonogram("Royal Challengers Bangalore") // → { initials: "RC", source: "…" }
 */
export function teamMonogram(name: string): MonogramResult {
  return buildMonogram(name, "team");
}

/**
 * Generate initials from a player's full name.
 *
 * Strategy:
 *  1. Split on whitespace.
 *  2. Use first word (first name) and last word (surname) only.
 *  3. Take first character of each.
 *  4. If single word → first two characters.
 *  5. If empty → "?".
 *
 * @example
 * playerMonogram("Rahul Sharma")      // → { initials: "RS", source: "Rahul Sharma" }
 * playerMonogram("Virat Kohli")       // → { initials: "VK", source: "Virat Kohli" }
 * playerMonogram("MS Dhoni")          // → { initials: "MD", source: "MS Dhoni" }
 * playerMonogram("Sachin")            // → { initials: "SA", source: "Sachin" }
 */
export function playerMonogram(name: string): MonogramResult {
  return buildMonogram(name, "player");
}

/**
 * Convenience: auto-detect mode from AssetKind.
 */
export function monogramFor(
  name: string,
  kind: "player" | "team" | "tournament"
): MonogramResult {
  if (kind === "player") return playerMonogram(name);
  return teamMonogram(name);
}

/* ─── Internal helpers ───────────────────────────────────────────────────── */

type MonogramMode = "team" | "player";

function buildMonogram(raw: string, mode: MonogramMode): MonogramResult {
  const source = raw.trim();

  if (!source) {
    return { initials: "?", source };
  }

  const words = tokenize(source);

  if (words.length === 0) {
    return { initials: "?", source };
  }

  let initials: string;

  if (mode === "player") {
    initials = extractPlayerInitials(words);
  } else {
    initials = extractTeamInitials(words);
  }

  return { initials, source };
}

/** Split on whitespace, remove empty tokens. */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** For teams: strip stop-words, take first letter of each remaining word. */
function extractTeamInitials(words: string[]): string {
  const meaningful = words.filter(
    (w) => !STOP_WORDS.has(w.toLowerCase())
  );

  if (meaningful.length === 0) {
    return twoCharFallback(words[0]);
  }

  if (meaningful.length === 1) {
    return twoCharFallback(meaningful[0]);
  }

  return (meaningful[0][0] + meaningful[1][0]).toUpperCase();
}

/** For players: first name initial + last name initial. */
function extractPlayerInitials(words: string[]): string {
  if (words.length === 1) {
    return twoCharFallback(words[0]);
  }

  const first = words[0];
  const last = words[words.length - 1];

  return (first[0] + last[0]).toUpperCase();
}

/**
 * Fallback when only one word is available.
 * Returns the first two alphanumeric characters uppercased.
 * Falls back to a single character if the word is 1 char long.
 */
function twoCharFallback(word: string): string {
  const alphanumeric = word.replace(/[^a-zA-Z0-9]/g, "");
  if (alphanumeric.length === 0) return "?";
  return alphanumeric.slice(0, 2).toUpperCase();
}
