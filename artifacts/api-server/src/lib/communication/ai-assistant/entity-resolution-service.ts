/**
 * BIDWAR Entity Resolution Service
 *
 * Implements intelligent, multi-stage entity resolution for tournaments and matches
 * referenced in natural language (Hindi, English, Hinglish, transliterated, misspelled).
 *
 * Adheres strictly to Section 4 of the specification:
 * 1. Exact matching first
 * 2. Normalized matching & spelling correction (e.g. "scor" -> "score", "Primier Leeg" -> "Premier League")
 * 3. Fuzzy matching when needed (Levenshtein / Token similarity)
 * 4. User authorization context affinity boost
 * 5. If 1 strong unambiguous candidate -> resolve
 * 6. If multiple candidates or fuzzy match -> ask user to confirm
 * 7. If no candidate found -> ask for tournament name or city
 * 8. Never assume a match solely based on weak similarity
 */

import { db, tournamentsTable, scoringMatchesTable, teamsTable } from "@workspace/db";
import { eq, or, and, sql, inArray } from "drizzle-orm";
import { logger } from "../../logger";

export interface CandidateTournament {
  id: number;
  name: string;
  city?: string | null;
  sport: string;
  status: string;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  score: number;
  matchType: "exact" | "normalized" | "fuzzy" | "city_match" | "authorized_context";
}

export type EntityResolutionResult =
  | {
      status: "resolved";
      tournament: CandidateTournament;
      matchId?: number;
    }
  | {
      status: "needs_confirmation";
      candidate: CandidateTournament;
      otherCandidates?: CandidateTournament[];
      confirmationMessage: string;
    }
  | {
      status: "ambiguous_multiple";
      candidates: CandidateTournament[];
      clarificationMessage: string;
    }
  | {
      status: "not_found";
      clarificationMessage: string;
    };

// Common spelling corrections and abbreviations in Indian sports context
const SPELLING_NORMALIZATION_MAP: Record<string, string> = {
  scor: "score",
  skor: "score",
  skore: "score",
  primier: "premier",
  premiere: "premier",
  premiar: "premier",
  premeer: "premier",
  leeg: "league",
  legue: "league",
  leag: "league",
  ligue: "league",
  tornament: "tournament",
  turnament: "tournament",
  torment: "tournament",
  tournamnt: "tournament",
  bpl: "bidwar premier league",
  ipl: "premier league",
  akshan: "auction",
  okshan: "auction",
  aution: "auction",
  acton: "auction",
  plyar: "player",
  khiladi: "player",
  tim: "team",
  tem: "team",
};

const STOP_WORDS = new Set([
  "mein", "me", "ka", "ki", "ke", "ko", "se", "aur", "bhi", "hai", "hain", "kya", "batao",
  "dikhao", "chal", "raha", "rahe", "rahi", "hoga", "score", "scores", "match", "matches",
  "tournament", "live", "update", "kripya", "please", "the", "in", "of", "for", "at", "show",
  "tell", "what", "is", "are", "wale", "wali", "wala", "kaunsa", "kaunsi", "kitna", "kitne"
]);

export class EntityResolutionService {
  /**
   * Normalize user query text by correcting common spelling variants.
   */
  public normalizeQueryText(rawText: string): string {
    const tokens = rawText
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const normalizedTokens = tokens.map((t) => SPELLING_NORMALIZATION_MAP[t] || t);
    return normalizedTokens.join(" ");
  }

  /**
   * Extract meaningful keywords/tokens excluding stop words.
   */
  public extractKeywords(text: string): string[] {
    const normalized = this.normalizeQueryText(text);
    return normalized
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  }

  /**
   * Calculate Levenshtein distance between two strings.
   */
  public levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    const lenA = a.length;
    const lenB = b.length;

    for (let i = 0; i <= lenA; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= lenB; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= lenA; i++) {
      for (let j = 1; j <= lenB; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[lenA][lenB];
  }

  /**
   * Compute string similarity ratio (0 to 1).
   */
  public similarityRatio(s1: string, s2: string): number {
    const longer = s1.length >= s2.length ? s1 : s2;
    const shorter = s1.length < s2.length ? s1 : s2;
    if (longer.length === 0) return 1.0;
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Resolve tournament from query text with intelligent multi-stage matching.
   */
  public async resolveTournament(options: {
    queryText: string;
    authorizedTournamentIds?: number[];
    confirmedTournamentId?: number;
    intentType?: string;
  }): Promise<EntityResolutionResult> {
    const { queryText, authorizedTournamentIds = [], confirmedTournamentId } = options;
    const cleanRaw = queryText.trim();
    const normalizedQuery = this.normalizeQueryText(cleanRaw);
    const keywords = this.extractKeywords(cleanRaw);

    // 1. Fetch all candidate tournaments from DB
    const allTournaments = await db
      .select({
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        city: tournamentsTable.city,
        sport: tournamentsTable.sport,
        status: tournamentsTable.status,
        auctionEnabled: tournamentsTable.auctionEnabled,
        scoringEnabled: tournamentsTable.scoringEnabled,
      })
      .from(tournamentsTable)
      .limit(50);

    if (allTournaments.length === 0) {
      return {
        status: "not_found",
        clarificationMessage: "Kaunse tournament ka score chahiye? Tournament ka naam ya city bata dein.",
      };
    }

    // Fast-path: If user has a confirmed tournament in session and didn't mention another city/name
    if (confirmedTournamentId) {
      const confirmedT = allTournaments.find((t) => t.id === confirmedTournamentId);
      if (confirmedT) {
        // Check if user explicitly mentioned a different city or tournament
        const mentionsDifferentCity = allTournaments.some(
          (t) =>
            t.city &&
            t.city.toLowerCase() !== (confirmedT.city || "").toLowerCase() &&
            keywords.some((k) => k === t.city!.toLowerCase())
        );

        if (!mentionsDifferentCity) {
          return {
            status: "resolved",
            tournament: {
              ...confirmedT,
              score: 1.0,
              matchType: "authorized_context",
            },
          };
        }
      }
    }

    // 2. Score each tournament candidate
    const scoredCandidates: CandidateTournament[] = [];

    for (const t of allTournaments) {
      const tNameNorm = this.normalizeQueryText(t.name);
      const tCityNorm = t.city ? this.normalizeQueryText(t.city) : "";
      let score = 0;
      let matchType: CandidateTournament["matchType"] = "fuzzy";

      // 2a. Exact or Substring match on tournament name
      if (normalizedQuery.includes(tNameNorm)) {
        score = 1.0;
        matchType = "exact";
      } else if (tNameNorm.includes(normalizedQuery) && normalizedQuery.length >= 4) {
        score = 0.95;
        matchType = "normalized";
      }

      // 2b. City match bonus
      const cityMatched = tCityNorm && keywords.some((k) => k === tCityNorm || tCityNorm.includes(k));
      if (cityMatched) {
        score = Math.max(score, 0.75);
        if (matchType !== "exact") matchType = "city_match";
      }

      // 2c. Token overlap score
      const tTokens = this.extractKeywords(t.name);
      let matchedTokens = 0;
      for (const kw of keywords) {
        if (tTokens.some((tt) => tt === kw || tt.includes(kw) || kw.includes(tt))) {
          matchedTokens++;
        }
      }

      if (keywords.length > 0 && matchedTokens > 0) {
        const tokenOverlapRatio = matchedTokens / Math.max(keywords.length, tTokens.length);
        const tokenScore = 0.4 + tokenOverlapRatio * 0.5;
        if (cityMatched) {
          score = Math.max(score, tokenScore + 0.25);
        } else {
          score = Math.max(score, tokenScore);
        }
        if (matchType === "fuzzy" && tokenScore > 0.6) {
          matchType = "normalized";
        }
      }

      // 2d. Fuzzy Levenshtein match for misspelled words
      for (const kw of keywords) {
        for (const tt of tTokens) {
          const sim = this.similarityRatio(kw, tt);
          if (sim >= 0.75) {
            score = Math.max(score, sim * 0.85);
            matchType = "fuzzy";
          }
        }
        if (tCityNorm) {
          const citySim = this.similarityRatio(kw, tCityNorm);
          if (citySim >= 0.8) {
            score = Math.max(score, citySim * 0.8);
            matchType = "fuzzy";
          }
        }
      }

      // 2e. Affinity boost for sender's authorized tournaments
      if (authorizedTournamentIds.includes(t.id)) {
        score += 0.2;
      }

      if (score >= 0.5) {
        scoredCandidates.push({
          ...t,
          score: Math.min(score, 1.0),
          matchType,
        });
      }
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 3. Evaluate results based on specification criteria
    if (scoredCandidates.length === 0) {
      return {
        status: "not_found",
        clarificationMessage: "Kaunse tournament ka score chahiye? Tournament ka naam ya city bata dein.",
      };
    }

    const topCandidate = scoredCandidates[0];
    const secondCandidate = scoredCandidates[1];

    // High confidence unambiguous match:
    // Either score >= 0.9, or topCandidate is substantially higher than secondCandidate
    const isUnambiguous =
      topCandidate.score >= 0.9 ||
      (!secondCandidate && topCandidate.score >= 0.75) ||
      (secondCandidate && topCandidate.score - secondCandidate.score >= 0.25);

    if (isUnambiguous) {
      // If it was a fuzzy misspelling (e.g. "Primier Leeg" or "scor"), ask gentle confirmation as required by spec
      if (topCandidate.matchType === "fuzzy" || topCandidate.score < 0.9) {
        const cityPart = topCandidate.city ? ` (${topCandidate.city})` : "";
        return {
          status: "needs_confirmation",
          candidate: topCandidate,
          confirmationMessage: `Kya aap ${topCandidate.city ? `${topCandidate.city} ke ` : ""}${topCandidate.name} ki baat kar rahe hain?`,
        };
      }

      return {
        status: "resolved",
        tournament: topCandidate,
      };
    }

    // Multiple candidates with close scores (e.g. Kanpur BPL vs Lucknow BPL)
    if (secondCandidate && Math.abs(topCandidate.score - secondCandidate.score) < 0.25) {
      // Check if one has city specified in query
      const cityKw = keywords.find((k) =>
        allTournaments.some((t) => t.city && t.city.toLowerCase() === k)
      );

      if (cityKw) {
        const cityMatch = scoredCandidates.find(
          (c) => c.city && c.city.toLowerCase() === cityKw
        );
        if (cityMatch) {
          return {
            status: "needs_confirmation",
            candidate: cityMatch,
            confirmationMessage: `${cityMatch.city} wale ${cityMatch.name} ki baat kar rahe hain, sahi?`,
          };
        }
      }

      // Clarify between top candidate options
      const candidateList = scoredCandidates
        .slice(0, 3)
        .map((c) => `• ${c.name}${c.city ? ` (${c.city})` : ""}`)
        .join("\n");

      return {
        status: "ambiguous_multiple",
        candidates: scoredCandidates.slice(0, 3),
        clarificationMessage: `Aap kis tournament ki baat kar rahe hain?\n\n${candidateList}\n\nKripya city ya tournament ka poora naam batayein.`,
      };
    }

    // Default to confirmation prompt for single moderate candidate
    return {
      status: "needs_confirmation",
      candidate: topCandidate,
      confirmationMessage: `Kya aap ${topCandidate.city ? `${topCandidate.city} ke ` : ""}${topCandidate.name} ki baat kar rahe hain?`,
    };
  }

  /**
   * Resolve specific match within a confirmed tournament (e.g. "Tigers ka match", "dusre match ka").
   */
  public async resolveMatchInTournament(options: {
    tournamentId: number;
    queryText: string;
    excludeMatchId?: number;
  }): Promise<number | undefined> {
    const { tournamentId, queryText, excludeMatchId } = options;
    const keywords = this.extractKeywords(queryText);

    try {
      const matches = await db
        .select({
          id: scoringMatchesTable.id,
          homeTeamId: scoringMatchesTable.homeTeamId,
          awayTeamId: scoringMatchesTable.awayTeamId,
          matchLabel: scoringMatchesTable.matchLabel,
          displayName: scoringMatchesTable.displayName,
          status: scoringMatchesTable.status,
        })
        .from(scoringMatchesTable)
        .where(eq(scoringMatchesTable.tournamentId, tournamentId))
        .orderBy(
          sql`CASE WHEN ${scoringMatchesTable.status} = 'live' THEN 1 ELSE 2 END`,
          scoringMatchesTable.id
        );

      if (matches.length === 0) return undefined;

      // Filter excluded match if user asked "dusre match ka" (other/next match)
      const availableMatches = excludeMatchId ? matches.filter((m) => m.id !== excludeMatchId) : matches;
      if (availableMatches.length === 0) return matches[0]?.id;

      // Check if user mentioned a specific team name
      const teamIds = new Set<number>();
      for (const m of availableMatches) {
        if (m.homeTeamId > 0) teamIds.add(m.homeTeamId);
        if (m.awayTeamId > 0) teamIds.add(m.awayTeamId);
      }

      if (teamIds.size > 0) {
        const teams = await db
          .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
          .from(teamsTable)
          .where(inArray(teamsTable.id, Array.from(teamIds)));

        for (const tm of teams) {
          const tmName = tm.name.toLowerCase();
          const tmShort = tm.shortCode.toLowerCase();
          if (keywords.some((k) => tmName.includes(k) || k === tmShort)) {
            const matchedM = availableMatches.find((m) => m.homeTeamId === tm.id || m.awayTeamId === tm.id);
            if (matchedM) return matchedM.id;
          }
        }
      }

      // Default: Return live match, or first available match
      const liveM = availableMatches.find((m) => m.status === "live");
      return liveM ? liveM.id : availableMatches[0]?.id;
    } catch (err) {
      logger.error({ err, tournamentId }, "EntityResolutionService: Error resolving match in tournament");
      return undefined;
    }
  }
}

export const entityResolutionService = new EntityResolutionService();
