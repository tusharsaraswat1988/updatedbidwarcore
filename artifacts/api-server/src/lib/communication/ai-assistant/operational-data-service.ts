/**
 * BIDWAR Operational Data Service for WhatsApp AI
 *
 * Provides authoritative, permission-checked operational data retrieval for:
 * 1. Live and recent match scores (Cricket & Badminton)
 * 2. Tournament auction summaries and statistics
 * 3. Individual player auction status
 * 4. Team owner purse and squad statistics
 * 5. Access code security enforcement
 *
 * Strictly adheres to BIDWAR Architecture & Data Governance:
 * - Internal DB IDs (e.g. Match #112, Tournament #4) are NEVER displayed as primary user-facing identifiers.
 * - Private team budgets, player contact info, and access codes are NEVER exposed to unauthorized parties.
 * - Scoring and Auction are treated as independent sibling capabilities.
 */

import {
  db,
  tournamentsTable,
  teamsTable,
  playersTable,
  categoriesTable,
  auctionPlayerEventsTable,
  scoringMatchesTable,
  badmintonMatchDetailsTable,
  auctionSessionsTable,
  membersTable,
  memberRolesTable,
} from "@workspace/db";
import { eq, and, or, inArray, desc, asc, sql } from "drizzle-orm";
import { logger } from "../../logger";
import { formatAuctionAmount, normalizeAuctionUnit, type AuctionUnit } from "@workspace/auction/auction-unit";
import { computePurseProtection } from "@workspace/auction/purse-protection";
import type { ResolvedIdentity } from "../conversation-router";

export interface CricketScoreDetail {
  matchName: string;
  tournamentName: string;
  city?: string | null;
  homeTeamName: string;
  awayTeamName: string;
  status: string; // "live" | "completed" | "scheduled" | "abandoned"
  battingTeamName?: string;
  bowlingTeamName?: string;
  innings: Array<{
    inningsNumber: number;
    teamName: string;
    runs: number;
    wickets: number;
    overs: string;
    allOut?: boolean;
  }>;
  target?: number | null;
  requiredRuns?: number | null;
  ballsRemaining?: number | null;
  resultSummary?: string | null;
  hasDetailedScores: boolean;
  venue?: string | null;
  scheduledAt?: Date | null;
}

export interface BadmintonScoreDetail {
  matchName: string;
  tournamentName: string;
  city?: string | null;
  matchType: string; // "singles" | "doubles" | "mixed_doubles"
  sideALabel: string;
  sideBLabel: string;
  status: string;
  currentGame: number;
  gamesScore: string; // e.g. "1 - 0"
  currentGamePoints?: string; // e.g. "21 - 18, 14 - 11"
  resultSummary?: string | null;
  hasDetailedScores: boolean;
  courtNumber?: string | null;
}

export interface TournamentAuctionOverview {
  tournamentId: number;
  tournamentName: string;
  city?: string | null;
  sport: string;
  auctionStatus: "live" | "paused" | "completed" | "idle";
  auctionUnit: AuctionUnit;
  totalPlayers: number;
  soldPlayers: number;
  unsoldPlayers: number;
  remainingPlayers: number;
  retainedPlayers: number;
  teamPurchases: Array<{
    teamId: number;
    teamName: string;
    shortCode: string;
    playersCount: number;
    /** Included ONLY if viewer is authorized organizer or the owner of this team */
    purseRemaining?: string;
    purseTotal?: string;
    isViewerTeam?: boolean;
  }>;
}

export interface PlayerAuctionDetail {
  playerName: string;
  tournamentName: string;
  serialNo?: number;
  role?: string | null;
  status: "available" | "sold" | "unsold" | "retained" | "unknown";
  basePriceFormatted: string;
  soldPriceFormatted?: string | null;
  teamName?: string | null;
}

export interface TeamOwnerAuctionDetail {
  teamName: string;
  tournamentName: string;
  ownerName: string;
  purseTotal: string;
  purseUsed: string;
  purseRemaining: string;
  playersBoughtCount: number;
  playersList: Array<{
    name: string;
    role?: string | null;
    price: string;
    status: string;
  }>;
  isBiddingEnabled: boolean;
  reservePurse?: string;
  spendablePurse?: string;
  maxAllowedBid?: string;
  slotsRequired?: number;
}

export interface TournamentDetailsAndRules {
  tournamentId: number;
  tournamentName: string;
  city?: string | null;
  venue?: string | null;
  sport: string;
  status: string;
  auctionUnit: AuctionUnit;
  auctionCode?: string | null;
  registrationLink?: string | null;
  registeredTeamsCount: number;
  registeredPlayersCount: number;
  registrationLimit?: number | null;
  registrationDeadline?: string | null;
  registrationFee?: number | null;
  basePurseFormatted: string;
  minBidFormatted: string;
  bidIncrementFormatted: string;
  bidTiers: {
    tier1UpTo?: string;
    tier1Increment?: string;
    tier2UpTo?: string;
    tier2Increment?: string;
    tier3Increment?: string;
  };
  timerSeconds: number;
  bidTimerSeconds: number;
  bidExtensionEnabled: boolean;
  bidExtensionSeconds: number;
  minimumSquadSize: number;
  maximumSquadSize: number;
  playerSelectionMode: string;
  categories: Array<{
    id: number;
    name: string;
    minBidFormatted?: string;
    bidIncrementFormatted?: string;
    maxPlayers?: number | null;
    sortOrder: number;
  }>;
}

export interface LiveAuctionStateDetail {
  tournamentId: number;
  tournamentName: string;
  city?: string | null;
  auctionStatus: "live" | "paused" | "completed" | "idle";
  auctionUnit: AuctionUnit;
  currentPlayer?: {
    id: number;
    serialNo?: number;
    name: string;
    role?: string | null;
    basePriceFormatted: string;
    categoryName?: string | null;
  } | null;
  currentBidFormatted?: string | null;
  currentBidRaw?: number | null;
  leadingTeam?: {
    id: number;
    name: string;
    shortCode?: string | null;
  } | null;
  timerRemainingSeconds?: number | null;
  soldPlayersCount: number;
  unsoldPlayersCount: number;
  totalPlayersCount: number;
  remainingPlayersCount: number;
  lastUpdated: string;
}

export interface PlayerRankingItem {
  rank: number;
  playerId: number;
  playerName: string;
  role?: string | null;
  categoryName?: string | null;
  soldPrice: number;
  soldPriceFormatted: string;
  teamName: string;
  teamShortCode?: string | null;
  soldAt?: string | null;
}

export interface TeamPurseRankingItem {
  rank: number;
  teamId: number;
  teamName: string;
  shortCode: string;
  ownerName: string;
  purseTotal: string;
  purseUsed: string;
  purseRemaining: string;
  spentRaw: number;
  remainingRaw: number;
  playersBoughtCount: number;
  maxAllowedBid: string;
  slotsRequired: number;
  futureReservePurse: string;
}

export interface TeamHierarchyItem {
  teamId: number;
  teamName: string;
  shortCode: string;
  ownerName: string;
  totalSpent: string;
  purseRemaining: string;
  playersCount: number;
  players: Array<{
    name: string;
    role?: string | null;
    price: string;
    status: string;
  }>;
}

export class OperationalDataService {
  /**
   * Safe Access Code Security Response.
   * ACCESS CODES MUST NEVER BE DISCLOSED OVER WHATSAPP CONVERSATIONAL CHAT.
   */
  public getAccessCodeSecurityResponse(preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish"): string {
    if (preferredLanguage === "english") {
      return (
        "🔒 Security Notice: Team owner access codes and passwords are not shared over WhatsApp for account security.\n\n" +
        "• Tournament Organizers can view and reset team access codes directly in the secure Organizer Dashboard at https://bidwar.in/organizer.\n" +
        "• Team Owners receive their confidential login details via the official onboarding email and team registration link."
      );
    }

    if (preferredLanguage === "hindi") {
      return (
        "🔒 सुरक्षा सूचना: खाते की सुरक्षा के लिए टीम ओनर एक्सेस कोड और पासवर्ड व्हाट्सएप चैट पर साझा नहीं किए जाते हैं।\n\n" +
        "• टूर्नामेंट आयोजक (Organizer) अपनी टीम के एक्सेस कोड https://bidwar.in/organizer डैशबोर्ड पर सुरक्षित रूप से देख सकते हैं।\n" +
        "• टीम ओनर्स को उनका लॉगिन लिंक आधिकारिक ऑनबोर्डिंग ईमेल और मैसेज द्वारा भेजा जाता है।"
      );
    }

    return (
      "🔒 Security Policy: Account security ke liye team owner access codes aur login passwords WhatsApp chat par share nahi kiye jaate.\n\n" +
      "• Organizers apne tournament dashboard (https://bidwar.in/organizer) par login karke Teams section mein access codes dekh ya reset kar sakte hain.\n" +
      "• Team Owners ko unka access code official onboarding message ya tournament link ke zariye milta hai."
    );
  }

  /**
   * Retrieve live or recent matches for a tournament or city.
   */
  public async getTournamentLiveMatches(options: {
    tournamentId?: number;
    city?: string;
    limit?: number;
  }): Promise<{ cricket: CricketScoreDetail[]; badminton: BadmintonScoreDetail[] }> {
    const limit = options.limit ?? 5;
    const cricketResults: CricketScoreDetail[] = [];
    const badmintonResults: BadmintonScoreDetail[] = [];

    try {
      // 1. Resolve tournament IDs
      let targetTournamentIds: number[] = [];
      const tournamentMetaMap = new Map<number, { name: string; city: string | null; sport: string }>();

      if (options.tournamentId) {
        targetTournamentIds = [options.tournamentId];
        const [t] = await db
          .select({ id: tournamentsTable.id, name: tournamentsTable.name, city: tournamentsTable.city, sport: tournamentsTable.sport })
          .from(tournamentsTable)
          .where(eq(tournamentsTable.id, options.tournamentId))
          .limit(1);
        if (t) {
          tournamentMetaMap.set(t.id, { name: t.name, city: t.city, sport: t.sport });
        }
      } else if (options.city && options.city.trim()) {
        const normCity = options.city.trim().toLowerCase();
        const tourneys = await db
          .select({ id: tournamentsTable.id, name: tournamentsTable.name, city: tournamentsTable.city, sport: tournamentsTable.sport })
          .from(tournamentsTable)
          .where(sql`LOWER(${tournamentsTable.city}) = ${normCity}`)
          .limit(5);
        for (const t of tourneys) {
          targetTournamentIds.push(t.id);
          tournamentMetaMap.set(t.id, { name: t.name, city: t.city, sport: t.sport });
        }
      }

      // If no tournaments resolved, find any active tournaments
      if (targetTournamentIds.length === 0) {
        const activeTourneys = await db
          .select({ id: tournamentsTable.id, name: tournamentsTable.name, city: tournamentsTable.city, sport: tournamentsTable.sport })
          .from(tournamentsTable)
          .where(eq(tournamentsTable.scoringEnabled, true))
          .orderBy(desc(tournamentsTable.id))
          .limit(5);
        for (const t of activeTourneys) {
          targetTournamentIds.push(t.id);
          tournamentMetaMap.set(t.id, { name: t.name, city: t.city, sport: t.sport });
        }
      }

      if (targetTournamentIds.length === 0) {
        return { cricket: [], badminton: [] };
      }

      // 2. Fetch matches prioritizing "live", then "completed", then "scheduled"
      const matches = await db
        .select()
        .from(scoringMatchesTable)
        .where(
          and(
            inArray(scoringMatchesTable.tournamentId, targetTournamentIds),
            or(
              eq(scoringMatchesTable.status, "live"),
              eq(scoringMatchesTable.status, "completed"),
              eq(scoringMatchesTable.status, "scheduled")
            )
          )
        )
        .orderBy(
          sql`CASE 
            WHEN ${scoringMatchesTable.status} = 'live' THEN 1 
            WHEN ${scoringMatchesTable.status} = 'completed' THEN 2 
            ELSE 3 END`,
          desc(scoringMatchesTable.updatedAt)
        )
        .limit(limit);

      if (matches.length === 0) {
        return { cricket: [], badminton: [] };
      }

      // Collect team IDs to query teams
      const teamIds = new Set<number>();
      for (const m of matches) {
        if (m.homeTeamId > 0) teamIds.add(m.homeTeamId);
        if (m.awayTeamId > 0) teamIds.add(m.awayTeamId);
      }

      const teamMap = new Map<number, { name: string; shortCode: string }>();
      if (teamIds.size > 0) {
        const teams = await db
          .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
          .from(teamsTable)
          .where(inArray(teamsTable.id, Array.from(teamIds)));
        for (const tm of teams) {
          teamMap.set(tm.id, { name: tm.name, shortCode: tm.shortCode });
        }
      }

      // Collect badminton match IDs
      const badmintonMatchIds = matches
        .filter((m) => m.sportSlug === "badminton")
        .map((m) => m.id);

      const badmintonDetailMap = new Map<number, typeof badmintonMatchDetailsTable.$inferSelect>();
      if (badmintonMatchIds.length > 0) {
        const bmds = await db
          .select()
          .from(badmintonMatchDetailsTable)
          .where(inArray(badmintonMatchDetailsTable.scoringMatchId, badmintonMatchIds));
        for (const b of bmds) {
          badmintonDetailMap.set(b.scoringMatchId, b);
        }
      }

      // 3. Process each match
      for (const m of matches) {
        const tMeta = tournamentMetaMap.get(m.tournamentId) ?? {
          name: "Tournament",
          city: null,
          sport: m.sportSlug,
        };

        const homeTeam = teamMap.get(m.homeTeamId) ?? { name: "Team 1", shortCode: "T1" };
        const awayTeam = teamMap.get(m.awayTeamId) ?? { name: "Team 2", shortCode: "T2" };

        if (m.sportSlug === "badminton") {
          const detail = badmintonDetailMap.get(m.id);
          const leftSide: any = detail?.leftSideJson ?? m.homeSideJson;
          const rightSide: any = detail?.rightSideJson ?? m.awaySideJson;

          const sideALabel = leftSide?.label || leftSide?.displayName || homeTeam.name;
          const sideBLabel = rightSide?.label || rightSide?.displayName || awayTeam.name;
          const matchName = m.displayName || m.matchLabel || `${sideALabel} vs ${sideBLabel}`;

          const stateSnapshot: any = detail?.stateSnapshotJson;
          const currentGame = stateSnapshot?.currentGame ?? 1;
          const gamesLeft = stateSnapshot?.gamesLeft ?? 0;
          const gamesRight = stateSnapshot?.gamesRight ?? 0;
          const leftScore = stateSnapshot?.leftScore ?? 0;
          const rightScore = stateSnapshot?.rightScore ?? 0;

          const hasDetailedScores = Boolean(stateSnapshot && stateSnapshot.totalRallies > 0);
          const gamesScore = `${gamesLeft} - ${gamesRight}`;
          const currentGamePoints = hasDetailedScores ? `${leftScore} - ${rightScore}` : undefined;

          badmintonResults.push({
            matchName,
            tournamentName: tMeta.name,
            city: tMeta.city,
            matchType: detail?.matchType ?? "singles",
            sideALabel,
            sideBLabel,
            status: m.status,
            currentGame,
            gamesScore,
            currentGamePoints,
            resultSummary: m.resultSummary ?? stateSnapshot?.resultReason ?? null,
            hasDetailedScores,
            courtNumber: detail?.courtNumber ?? null,
          });
        } else {
          // Cricket
          const matchName = m.displayName || m.matchLabel || `${homeTeam.name} vs ${awayTeam.name}`;
          const summary: any = m.summaryJson;
          const rawInnings: any[] = Array.isArray(summary?.innings) ? summary.innings : [];

          const innings: CricketScoreDetail["innings"] = [];
          for (const inn of rawInnings) {
            const battingTeam = inn.battingTeamId === m.homeTeamId ? homeTeam.name : awayTeam.name;
            innings.push({
              inningsNumber: inn.innings,
              teamName: battingTeam,
              runs: inn.runs ?? 0,
              wickets: inn.wickets ?? 0,
              overs: inn.overs ? String(inn.overs) : "0.0",
              allOut: Boolean(inn.allOut),
            });
          }

          const hasDetailedScores = innings.length > 0;
          let battingTeamName: string | undefined;
          let bowlingTeamName: string | undefined;

          if (rawInnings.length > 0) {
            const currentInn = rawInnings[rawInnings.length - 1];
            battingTeamName = currentInn.battingTeamId === m.homeTeamId ? homeTeam.name : awayTeam.name;
            bowlingTeamName = currentInn.bowlingTeamId === m.homeTeamId ? homeTeam.name : awayTeam.name;
          }

          let requiredRuns: number | null = null;
          let ballsRemaining: number | null = null;
          if (summary?.target && rawInnings.length >= 2) {
            const secondInn = rawInnings[1];
            requiredRuns = Math.max(0, (summary.target as number) - (secondInn.runs ?? 0));
            if (secondInn.overs) {
              const [ov, bl] = String(secondInn.overs).split(".").map((n) => parseInt(n, 10) || 0);
              const ballsBowled = ov * 6 + bl;
              const maxOvers = summary.oversLimit ?? 20;
              ballsRemaining = Math.max(0, maxOvers * 6 - ballsBowled);
            }
          }

          cricketResults.push({
            matchName,
            tournamentName: tMeta.name,
            city: tMeta.city,
            homeTeamName: homeTeam.name,
            awayTeamName: awayTeam.name,
            status: m.status,
            battingTeamName,
            bowlingTeamName,
            innings,
            target: summary?.target ?? null,
            requiredRuns,
            ballsRemaining,
            resultSummary: m.resultSummary ?? summary?.resultText ?? null,
            hasDetailedScores,
            venue: m.venue ?? null,
            scheduledAt: m.scheduledAt ?? null,
          });
        }
      }

      return { cricket: cricketResults, badminton: badmintonResults };
    } catch (err) {
      logger.error({ err, options }, "OperationalDataService: Error querying live match scores");
      return { cricket: [], badminton: [] };
    }
  }

  /**
   * Format Cricket and Badminton match scores into human-readable text.
   * NEVER returns "Match #112: Match in progress".
   */
  public formatScoresResponse(
    scores: { cricket: CricketScoreDetail[]; badminton: BadmintonScoreDetail[] },
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish",
    filterTournamentName?: string
  ): string {
    const isEnglish = preferredLanguage === "english";
    const isHindi = preferredLanguage === "hindi";

    if (scores.cricket.length === 0 && scores.badminton.length === 0) {
      if (filterTournamentName) {
        return isEnglish
          ? `No live or scheduled matches found for "${filterTournamentName}". Please visit https://bidwar.in for latest fixtures.`
          : `"${filterTournamentName}" ke liye abhi koi live match ya score available nahi hai. Fixtures dekhne ke liye bidwar.in par jayein.`;
      }
      return isEnglish
        ? "No live matches are currently in progress. Please check upcoming fixtures at https://bidwar.in."
        : "Abhi koi match LIVE nahi chal raha hai. Fixtures aur schedule dekhne ke liye bidwar.in par jayein.";
    }

    const lines: string[] = [];

    // Cricket Scores
    if (scores.cricket.length > 0) {
      lines.push("🏏 *Live & Recent Cricket Matches:*");
      for (const m of scores.cricket) {
        const cityStr = m.city ? ` (${m.city})` : "";
        lines.push(`\n🏆 *${m.matchName}* — ${m.tournamentName}${cityStr}`);

        if (m.hasDetailedScores && m.innings.length > 0) {
          for (const inn of m.innings) {
            const allOutStr = inn.allOut ? " (all out)" : "";
            lines.push(`• ${inn.teamName}: *${inn.runs}/${inn.wickets}* in ${inn.overs} ov${allOutStr}`);
          }
          if (m.target && m.status === "live") {
            lines.push(`• Target: ${m.target}`);
            if (m.requiredRuns != null && m.ballsRemaining != null) {
              lines.push(`• Equation: Need ${m.requiredRuns} runs in ${m.ballsRemaining} balls`);
            }
          }
          if (m.resultSummary) {
            lines.push(`• Result: ${m.resultSummary}`);
          } else {
            lines.push(`• Status: ${m.status.toUpperCase()}`);
          }
        } else {
          // Score data unavailable fallback
          lines.push(
            isEnglish
              ? "• Match found, but live ball-by-ball score data is not being updated right now. Please check back shortly."
              : "• Match mil gaya hai, lekin abhi live score data available nahi ho raha. Aap thodi der baad check kar sakte hain."
          );
          lines.push(`• Status: ${m.status.toUpperCase()}`);
        }
      }
    }

    // Badminton Scores
    if (scores.badminton.length > 0) {
      lines.push("\n🏸 *Badminton Matches:*");
      for (const m of scores.badminton) {
        const cityStr = m.city ? ` (${m.city})` : "";
        lines.push(`\n🏆 *${m.matchName}* — ${m.tournamentName}${cityStr}`);
        if (m.hasDetailedScores) {
          lines.push(`• Games Score: ${m.sideALabel} ${m.gamesScore} ${m.sideBLabel}`);
          if (m.currentGamePoints) {
            lines.push(`• Game ${m.currentGame} Points: *${m.currentGamePoints}*`);
          }
          if (m.resultSummary) {
            lines.push(`• Result: ${m.resultSummary}`);
          } else {
            lines.push(`• Status: ${m.status.toUpperCase()}`);
          }
        } else {
          lines.push(
            isEnglish
              ? "• Match found, but rally score data is not yet recorded. Please check back shortly."
              : "• Match mil gaya hai, lekin abhi live score data available nahi ho raha. Aap thodi der baad check kar sakte hain."
          );
          lines.push(`• Status: ${m.status.toUpperCase()}`);
        }
      }
    }

    lines.push("\nDetails & live stream ke liye bidwar.in par jayein.");
    return lines.join("\n");
  }

  /**
   * Retrieve Tournament Auction Overview.
   * Enforces strict role-aware privacy:
   * - Public viewers see team purchase counts, but NEVER see private purses.
   * - Team owners see their own team's purse, but NEVER other teams' purses.
   * - Organizers see full team purses for their authorized tournament.
   */
  public async getTournamentAuctionOverview(options: {
    tournamentId: number;
    viewerRole: "organizer" | "team_owner" | "player" | "public";
    viewerTeamId?: number;
  }): Promise<TournamentAuctionOverview | null> {
    try {
      const [t] = await db
        .select({
          id: tournamentsTable.id,
          name: tournamentsTable.name,
          city: tournamentsTable.city,
          sport: tournamentsTable.sport,
          status: tournamentsTable.status,
          auctionUnit: tournamentsTable.auctionUnit,
          auctionEnabled: tournamentsTable.auctionEnabled,
        })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, options.tournamentId))
        .limit(1);

      if (!t) return null;

      const unit: AuctionUnit = normalizeAuctionUnit(t.auctionUnit);

      // 1. Fetch auction session
      const [session] = await db
        .select({
          status: auctionSessionsTable.status,
          soldPlayersCount: auctionSessionsTable.soldPlayersCount,
          unsoldPlayersCount: auctionSessionsTable.unsoldPlayersCount,
        })
        .from(auctionSessionsTable)
        .where(eq(auctionSessionsTable.tournamentId, t.id))
        .limit(1);

      let auctionStatus: TournamentAuctionOverview["auctionStatus"] = "idle";
      if (session?.status === "active") auctionStatus = "live";
      else if (session?.status === "paused") auctionStatus = "paused";
      else if (session?.status === "completed") auctionStatus = "completed";

      // 2. Fetch player counts
      const playerRows = await db
        .select({ status: playersTable.status })
        .from(playersTable)
        .where(eq(playersTable.tournamentId, t.id));

      let totalPlayers = playerRows.length;
      let soldPlayers = 0;
      let unsoldPlayers = 0;
      let remainingPlayers = 0;
      let retainedPlayers = 0;

      for (const p of playerRows) {
        const s = (p.status || "").toLowerCase();
        if (s === "sold") soldPlayers++;
        else if (s === "unsold") unsoldPlayers++;
        else if (s === "retained") retainedPlayers++;
        else remainingPlayers++;
      }

      // If session had explicit counts, use whichever is authoritative
      if (session?.soldPlayersCount && session.soldPlayersCount > soldPlayers) {
        soldPlayers = session.soldPlayersCount;
      }
      if (session?.unsoldPlayersCount && session.unsoldPlayersCount > unsoldPlayers) {
        unsoldPlayers = session.unsoldPlayersCount;
      }

      // 3. Fetch teams and their player purchase counts
      const teams = await db
        .select({
          id: teamsTable.id,
          name: teamsTable.name,
          shortCode: teamsTable.shortCode,
          purse: teamsTable.purse,
          purseUsed: teamsTable.purseUsed,
        })
        .from(teamsTable)
        .where(eq(teamsTable.tournamentId, t.id));

      const teamPurchasesMap = new Map<number, number>();
      const boughtPlayers = await db
        .select({ teamId: playersTable.teamId })
        .from(playersTable)
        .where(
          and(
            eq(playersTable.tournamentId, t.id),
            or(eq(playersTable.status, "sold"), eq(playersTable.status, "retained"))
          )
        );

      for (const bp of boughtPlayers) {
        if (bp.teamId != null) {
          teamPurchasesMap.set(bp.teamId, (teamPurchasesMap.get(bp.teamId) ?? 0) + 1);
        }
      }

      const teamPurchases: TournamentAuctionOverview["teamPurchases"] = [];
      for (const tm of teams) {
        const count = teamPurchasesMap.get(tm.id) ?? 0;
        const remaining = Math.max(0, (tm.purse ?? 0) - (tm.purseUsed ?? 0));
        const isViewerTeam = options.viewerTeamId === tm.id;

        const isAuthorizedToSeePurse =
          options.viewerRole === "organizer" || (options.viewerRole === "team_owner" && isViewerTeam);

        teamPurchases.push({
          teamId: tm.id,
          teamName: tm.name,
          shortCode: tm.shortCode,
          playersCount: count,
          purseRemaining: isAuthorizedToSeePurse ? formatAuctionAmount(remaining, unit) : undefined,
          purseTotal: isAuthorizedToSeePurse ? formatAuctionAmount(tm.purse ?? 0, unit) : undefined,
          isViewerTeam,
        });
      }

      return {
        tournamentId: t.id,
        tournamentName: t.name,
        city: t.city,
        sport: t.sport,
        auctionStatus,
        auctionUnit: unit,
        totalPlayers,
        soldPlayers,
        unsoldPlayers,
        remainingPlayers,
        retainedPlayers,
        teamPurchases,
      };
    } catch (err) {
      logger.error({ err, tournamentId: options.tournamentId }, "OperationalDataService: Error fetching tournament auction overview");
      return null;
    }
  }

  /**
   * Format Auction Overview for user display.
   */
  public formatAuctionOverviewResponse(
    data: TournamentAuctionOverview,
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish"
  ): string {
    const isEnglish = preferredLanguage === "english";
    const statusLabel =
      data.auctionStatus === "live"
        ? "🟢 Live"
        : data.auctionStatus === "paused"
          ? "🟡 Paused"
          : data.auctionStatus === "completed"
            ? "🏁 Completed"
            : "⏳ Upcoming / Setup";

    const lines = [
      `🏆 *${data.tournamentName}*${data.city ? ` (${data.city})` : ""} — Auction Status:`,
      "",
      `• *Total Players:* ${data.totalPlayers}`,
      `• *Sold:* ${data.soldPlayers}`,
      `• *Unsold:* ${data.unsoldPlayers}`,
      `• *Remaining in Pool:* ${data.remainingPlayers}`,
      ...(data.retainedPlayers > 0 ? [`• *Retained:* ${data.retainedPlayers}`] : []),
      `• *Auction Status:* ${statusLabel}`,
      "",
      `*Team-wise Purchases:*`,
    ];

    for (const tp of data.teamPurchases) {
      if (tp.purseRemaining) {
        lines.push(`• *${tp.teamName}*: ${tp.playersCount} players (Purse remaining: ${tp.purseRemaining})`);
      } else {
        lines.push(`• *${tp.teamName}*: ${tp.playersCount} players`);
      }
    }

    lines.push(
      isEnglish
        ? "\nLive player details and team rosters are available at https://bidwar.in."
        : "\nLive player details aur team roster dekhne ke liye bidwar.in par jayein."
    );

    return lines.join("\n");
  }

  /**
   * Retrieve Player Personal Auction Data by Phone.
   */
  public async getPlayerPersonalData(mobile: string, tournamentId?: number): Promise<PlayerAuctionDetail | null> {
    try {
      const norm = mobile.replace(/\D/g, "");
      const tenDigit = norm.startsWith("91") && norm.length === 12 ? norm.slice(2) : norm;

      const playerConditions = [
        eq(playersTable.mobileNumber, norm),
        eq(playersTable.mobileNumber, tenDigit),
        sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`,
      ];

      if (tournamentId) {
        playerConditions.push(eq(playersTable.tournamentId, tournamentId));
      }

      const [p] = await db
        .select()
        .from(playersTable)
        .where(or(...playerConditions))
        .orderBy(desc(playersTable.id))
        .limit(1);

      if (!p) return null;

      const [t] = await db
        .select({ name: tournamentsTable.name, auctionUnit: tournamentsTable.auctionUnit })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, p.tournamentId))
        .limit(1);

      const unit = normalizeAuctionUnit(t?.auctionUnit);

      let teamName: string | null = null;
      if (p.teamId) {
        const [tm] = await db
          .select({ name: teamsTable.name })
          .from(teamsTable)
          .where(eq(teamsTable.id, p.teamId))
          .limit(1);
        if (tm) teamName = tm.name;
      }

      const status = (p.status || "available").toLowerCase() as PlayerAuctionDetail["status"];

      return {
        playerName: p.name,
        tournamentName: t?.name ?? "Tournament",
        serialNo: p.serialNo,
        role: p.role,
        status: ["available", "sold", "unsold", "retained"].includes(status) ? status : "available",
        basePriceFormatted: formatAuctionAmount(p.basePrice ?? 0, unit),
        soldPriceFormatted: p.soldPrice != null ? formatAuctionAmount(p.soldPrice, unit) : null,
        teamName,
      };
    } catch (err) {
      logger.error({ err, mobile }, "OperationalDataService: Error fetching player personal data");
      return null;
    }
  }

  /**
   * Retrieve Team Owner Personal Auction Data by Phone.
   */
  public async getTeamOwnerPersonalData(mobile: string, tournamentId?: number): Promise<TeamOwnerAuctionDetail | null> {
    try {
      const norm = mobile.replace(/\D/g, "");
      const tenDigit = norm.startsWith("91") && norm.length === 12 ? norm.slice(2) : norm;

      const teamConditions = [
        eq(teamsTable.ownerMobile, norm),
        eq(teamsTable.ownerMobile, tenDigit),
        sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`,
      ];

      if (tournamentId) {
        teamConditions.push(eq(teamsTable.tournamentId, tournamentId));
      }

      const [tm] = await db
        .select()
        .from(teamsTable)
        .where(or(...teamConditions))
        .orderBy(desc(teamsTable.id))
        .limit(1);

      if (!tm) return null;

      const [t] = await db
        .select({
          name: tournamentsTable.name,
          auctionUnit: tournamentsTable.auctionUnit,
          minimumSquadSize: tournamentsTable.minimumSquadSize,
          maximumSquadSize: tournamentsTable.maximumSquadSize,
          minBid: tournamentsTable.minBid,
        })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, tm.tournamentId))
        .limit(1);

      const unit = normalizeAuctionUnit(t?.auctionUnit);
      const remaining = Math.max(0, (tm.purse ?? 0) - (tm.purseUsed ?? 0));

      const players = await db
        .select({
          name: playersTable.name,
          role: playersTable.role,
          soldPrice: playersTable.soldPrice,
          retainedPrice: playersTable.retainedPrice,
          status: playersTable.status,
        })
        .from(playersTable)
        .where(eq(playersTable.teamId, tm.id));

      const playersList = players.map((p) => ({
        name: p.name,
        role: p.role,
        price: formatAuctionAmount(p.soldPrice ?? p.retainedPrice ?? 0, unit),
        status: p.status,
      }));

      const purseProtection = computePurseProtection({
        purse: tm.purse ?? 0,
        purseUsed: tm.purseUsed ?? 0,
        boosterTotal: 0,
        playersBought: playersList.length,
        minimumSquadSize: t?.minimumSquadSize ?? 0,
        maximumSquadSize: t?.maximumSquadSize ?? 0,
        minBid: t?.minBid ?? 100000,
      });

      return {
        teamName: tm.name,
        tournamentName: t?.name ?? "Tournament",
        ownerName: tm.ownerName,
        purseTotal: formatAuctionAmount(tm.purse ?? 0, unit),
        purseUsed: formatAuctionAmount(tm.purseUsed ?? 0, unit),
        purseRemaining: formatAuctionAmount(remaining, unit),
        playersBoughtCount: playersList.length,
        playersList,
        isBiddingEnabled: tm.isBiddingEnabled,
        reservePurse: formatAuctionAmount(purseProtection.reservePurse, unit),
        spendablePurse: formatAuctionAmount(purseProtection.spendablePurse, unit),
        maxAllowedBid: formatAuctionAmount(purseProtection.maxAllowedBid, unit),
        slotsRequired: purseProtection.slotsRequired,
      };
    } catch (err) {
      logger.error({ err, mobile }, "OperationalDataService: Error fetching team owner personal data");
      return null;
    }
  }

  /**
   * Search an individual player within a tournament.
   */
  public async lookupPlayerInTournament(options: {
    tournamentId: number;
    searchName: string;
  }): Promise<PlayerAuctionDetail | null> {
    try {
      const cleanName = options.searchName.trim().toLowerCase();
      const players = await db
        .select()
        .from(playersTable)
        .where(eq(playersTable.tournamentId, options.tournamentId));

      let matchedPlayer = players.find((p) => p.name.trim().toLowerCase() === cleanName);
      if (!matchedPlayer) {
        matchedPlayer = players.find(
          (p) =>
            p.name.trim().toLowerCase().includes(cleanName) || cleanName.includes(p.name.trim().toLowerCase())
        );
      }

      if (!matchedPlayer) return null;

      const [t] = await db
        .select({ name: tournamentsTable.name, auctionUnit: tournamentsTable.auctionUnit })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, options.tournamentId))
        .limit(1);

      const unit = normalizeAuctionUnit(t?.auctionUnit);

      let teamName: string | null = null;
      if (matchedPlayer.teamId) {
        const [tm] = await db
          .select({ name: teamsTable.name })
          .from(teamsTable)
          .where(eq(teamsTable.id, matchedPlayer.teamId))
          .limit(1);
        if (tm) teamName = tm.name;
      }

      const status = (matchedPlayer.status || "available").toLowerCase() as PlayerAuctionDetail["status"];

      return {
        playerName: matchedPlayer.name,
        tournamentName: t?.name ?? "Tournament",
        serialNo: matchedPlayer.serialNo,
        role: matchedPlayer.role,
        status: ["available", "sold", "unsold", "retained"].includes(status) ? status : "available",
        basePriceFormatted: formatAuctionAmount(matchedPlayer.basePrice ?? 0, unit),
        soldPriceFormatted: matchedPlayer.soldPrice != null ? formatAuctionAmount(matchedPlayer.soldPrice, unit) : null,
        teamName,
      };
    } catch (err) {
      logger.error({ err, options }, "OperationalDataService: Error looking up player");
      return null;
    }
  }

  /**
   * Retrieve authoritative tournament configuration, auction rules, and categories.
   */
  public async getTournamentDetailsAndRules(tournamentId: number): Promise<TournamentDetailsAndRules | null> {
    try {
      const [t] = await db
        .select()
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, tournamentId))
        .limit(1);

      if (!t) return null;

      const unit: AuctionUnit = normalizeAuctionUnit(t.auctionUnit);

      const teamRows = await db
        .select({ id: teamsTable.id })
        .from(teamsTable)
        .where(eq(teamsTable.tournamentId, tournamentId));

      const playerRows = await db
        .select({ id: playersTable.id })
        .from(playersTable)
        .where(eq(playersTable.tournamentId, tournamentId));

      const catRows = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.tournamentId, tournamentId))
        .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.id));

      const categories = (catRows || []).map((c) => ({
        id: c.id,
        name: c.name,
        minBidFormatted: c.minBid != null ? formatAuctionAmount(c.minBid, unit) : undefined,
        bidIncrementFormatted: c.bidIncrement != null ? formatAuctionAmount(c.bidIncrement, unit) : undefined,
        maxPlayers: c.maxPlayers,
        sortOrder: c.sortOrder ?? 0,
      }));

      const regLink = t.auctionCode
        ? `https://bidwar.in/register/${t.auctionCode}`
        : `https://bidwar.in/tournament/${t.id}/register`;

      return {
        tournamentId: t.id,
        tournamentName: t.name,
        city: t.city,
        venue: t.venue,
        sport: t.sport,
        status: t.status,
        auctionUnit: unit,
        auctionCode: t.auctionCode,
        registrationLink: regLink,
        registeredTeamsCount: teamRows.length,
        registeredPlayersCount: playerRows.length,
        registrationLimit: t.registrationLimit,
        registrationDeadline: t.registrationDeadline,
        registrationFee: t.registrationFee,
        basePurseFormatted: formatAuctionAmount(t.basePurse ?? 10000000, unit),
        minBidFormatted: formatAuctionAmount(t.minBid ?? 100000, unit),
        bidIncrementFormatted: formatAuctionAmount(t.bidIncrement ?? 100000, unit),
        bidTiers: {
          tier1UpTo: t.bidTier1UpTo != null ? formatAuctionAmount(t.bidTier1UpTo, unit) : undefined,
          tier1Increment: t.bidTier1Increment != null ? formatAuctionAmount(t.bidTier1Increment, unit) : undefined,
          tier2UpTo: t.bidTier2UpTo != null ? formatAuctionAmount(t.bidTier2UpTo, unit) : undefined,
          tier2Increment: t.bidTier2Increment != null ? formatAuctionAmount(t.bidTier2Increment, unit) : undefined,
          tier3Increment: t.bidTier3Increment != null ? formatAuctionAmount(t.bidTier3Increment, unit) : undefined,
        },
        timerSeconds: t.timerSeconds ?? 30,
        bidTimerSeconds: t.bidTimerSeconds ?? 10,
        bidExtensionEnabled: Boolean(t.bidExtensionEnabled),
        bidExtensionSeconds: t.bidExtensionSeconds ?? 5,
        minimumSquadSize: t.minimumSquadSize ?? 0,
        maximumSquadSize: t.maximumSquadSize ?? 0,
        playerSelectionMode: t.playerSelectionMode ?? "random",
        categories,
      };
    } catch (err) {
      logger.error({ err, tournamentId }, "OperationalDataService: Error fetching tournament details and rules");
      return null;
    }
  }

  /**
   * Retrieve live auction state and operational counters.
   */
  public async getLiveAuctionState(tournamentId: number): Promise<LiveAuctionStateDetail | null> {
    try {
      const [t] = await db
        .select({
          id: tournamentsTable.id,
          name: tournamentsTable.name,
          city: tournamentsTable.city,
          auctionUnit: tournamentsTable.auctionUnit,
        })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, tournamentId))
        .limit(1);

      if (!t) return null;

      const unit: AuctionUnit = normalizeAuctionUnit(t.auctionUnit);

      const [session] = await db
        .select()
        .from(auctionSessionsTable)
        .where(eq(auctionSessionsTable.tournamentId, tournamentId))
        .limit(1);

      const allPlayers = await db
        .select({ id: playersTable.id, status: playersTable.status })
        .from(playersTable)
        .where(eq(playersTable.tournamentId, tournamentId));

      const totalPlayersCount = allPlayers.length;
      let actualSold = 0;
      let actualUnsold = 0;
      for (const p of allPlayers) {
        const s = (p.status || "").toLowerCase();
        if (s === "sold") actualSold++;
        else if (s === "unsold") actualUnsold++;
      }

      const soldPlayersCount = session?.soldPlayersCount != null && session.soldPlayersCount >= actualSold
        ? session.soldPlayersCount
        : actualSold;
      const unsoldPlayersCount = session?.unsoldPlayersCount != null && session.unsoldPlayersCount >= actualUnsold
        ? session.unsoldPlayersCount
        : actualUnsold;
      const remainingPlayersCount = Math.max(0, totalPlayersCount - soldPlayersCount - unsoldPlayersCount);

      let auctionStatus: LiveAuctionStateDetail["auctionStatus"] = "idle";
      if (session?.status === "active") auctionStatus = "live";
      else if (session?.status === "paused") auctionStatus = "paused";
      else if (session?.status === "completed") auctionStatus = "completed";

      let currentPlayer: LiveAuctionStateDetail["currentPlayer"] = null;
      if (session?.currentPlayerId) {
        const [cp] = await db
          .select({
            id: playersTable.id,
            serialNo: playersTable.serialNo,
            name: playersTable.name,
            role: playersTable.role,
            basePrice: playersTable.basePrice,
            categoryId: playersTable.categoryId,
          })
          .from(playersTable)
          .where(eq(playersTable.id, session.currentPlayerId))
          .limit(1);

        if (cp) {
          let categoryName: string | null = null;
          if (cp.categoryId) {
            const [cat] = await db
              .select({ name: categoriesTable.name })
              .from(categoriesTable)
              .where(eq(categoriesTable.id, cp.categoryId))
              .limit(1);
            if (cat) categoryName = cat.name;
          }
          currentPlayer = {
            id: cp.id,
            serialNo: cp.serialNo,
            name: cp.name,
            role: cp.role,
            basePriceFormatted: formatAuctionAmount(cp.basePrice ?? 0, unit),
            categoryName,
          };
        }
      }

      let leadingTeam: LiveAuctionStateDetail["leadingTeam"] = null;
      if (session?.currentBidTeamId) {
        const [tm] = await db
          .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
          .from(teamsTable)
          .where(eq(teamsTable.id, session.currentBidTeamId))
          .limit(1);
        if (tm) {
          leadingTeam = { id: tm.id, name: tm.name, shortCode: tm.shortCode };
        }
      }

      return {
        tournamentId: t.id,
        tournamentName: t.name,
        city: t.city,
        auctionStatus,
        auctionUnit: unit,
        currentPlayer,
        currentBidFormatted: session?.currentBid != null ? formatAuctionAmount(session.currentBid, unit) : null,
        currentBidRaw: session?.currentBid ?? null,
        leadingTeam,
        timerRemainingSeconds: session?.timerSeconds ?? null,
        soldPlayersCount,
        unsoldPlayersCount,
        totalPlayersCount,
        remainingPlayersCount,
        lastUpdated: session?.updatedAt ? session.updatedAt.toISOString() : new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ err, tournamentId }, "OperationalDataService: Error fetching live auction state");
      return null;
    }
  }

  /**
   * Retrieve Top N highest sold players ranked by sold price descending.
   */
  public async getTopSoldPlayers(options: { tournamentId: number; limit?: number }): Promise<PlayerRankingItem[]> {
    try {
      const limit = Math.max(1, options.limit ?? 5);

      const [t] = await db
        .select({ auctionUnit: tournamentsTable.auctionUnit })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, options.tournamentId))
        .limit(1);

      const unit = normalizeAuctionUnit(t?.auctionUnit);

      const players = await db
        .select({
          id: playersTable.id,
          name: playersTable.name,
          role: playersTable.role,
          soldPrice: playersTable.soldPrice,
          teamId: playersTable.teamId,
          categoryId: playersTable.categoryId,
        })
        .from(playersTable)
        .where(
          and(
            eq(playersTable.tournamentId, options.tournamentId),
            eq(playersTable.status, "sold"),
            sql`${playersTable.soldPrice} IS NOT NULL`
          )
        )
        .orderBy(desc(playersTable.soldPrice), asc(playersTable.id))
        .limit(limit);

      if (!players || players.length === 0) {
        return [];
      }

      const teamIds = Array.from(new Set(players.map((p) => p.teamId).filter((tid): tid is number => tid != null)));
      const teamMap = new Map<number, { name: string; shortCode: string }>();
      if (teamIds.length > 0) {
        const teams = await db
          .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
          .from(teamsTable)
          .where(inArray(teamsTable.id, teamIds));
        for (const tm of teams) {
          teamMap.set(tm.id, { name: tm.name, shortCode: tm.shortCode });
        }
      }

      const categoryIds = Array.from(new Set(players.map((p) => p.categoryId).filter((cid): cid is number => cid != null)));
      const catMap = new Map<number, string>();
      if (categoryIds.length > 0) {
        const cats = await db
          .select({ id: categoriesTable.id, name: categoriesTable.name })
          .from(categoriesTable)
          .where(inArray(categoriesTable.id, categoryIds));
        for (const c of cats) {
          catMap.set(c.id, c.name);
        }
      }

      return players.map((p, idx) => {
        const tm = p.teamId ? teamMap.get(p.teamId) : null;
        const catName = p.categoryId ? catMap.get(p.categoryId) : null;
        const price = p.soldPrice ?? 0;
        return {
          rank: idx + 1,
          playerId: p.id,
          playerName: p.name,
          role: p.role,
          categoryName: catName,
          soldPrice: price,
          soldPriceFormatted: formatAuctionAmount(price, unit),
          teamName: tm?.name ?? "Team",
          teamShortCode: tm?.shortCode ?? null,
        };
      });
    } catch (err) {
      logger.error({ err, options }, "OperationalDataService: Error fetching top sold players");
      return [];
    }
  }

  /**
   * Retrieve Last N recently sold players ordered by auction event time descending.
   */
  public async getLastSoldPlayers(options: { tournamentId: number; limit?: number }): Promise<PlayerRankingItem[]> {
    try {
      const limit = Math.max(1, options.limit ?? 5);

      const [t] = await db
        .select({ auctionUnit: tournamentsTable.auctionUnit })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, options.tournamentId))
        .limit(1);

      const unit = normalizeAuctionUnit(t?.auctionUnit);

      // 1. Try authoritative auctionPlayerEventsTable first
      try {
        const events = await db
          .select({
            playerId: auctionPlayerEventsTable.playerId,
            playerName: auctionPlayerEventsTable.playerName,
            playerRole: auctionPlayerEventsTable.playerRole,
            finalAmount: auctionPlayerEventsTable.finalAmount,
            soldToTeamId: auctionPlayerEventsTable.soldToTeamId,
            soldToTeamName: auctionPlayerEventsTable.soldToTeamName,
            timestamp: auctionPlayerEventsTable.timestamp,
          })
          .from(auctionPlayerEventsTable)
          .where(
            and(
              eq(auctionPlayerEventsTable.tournamentId, options.tournamentId),
              eq(auctionPlayerEventsTable.outcome, "sold")
            )
          )
          .orderBy(desc(auctionPlayerEventsTable.timestamp), desc(auctionPlayerEventsTable.id))
          .limit(limit);

        if (events && events.length > 0) {
          return events.map((ev, idx) => ({
            rank: idx + 1,
            playerId: ev.playerId,
            playerName: ev.playerName,
            role: ev.playerRole,
            soldPrice: ev.finalAmount ?? 0,
            soldPriceFormatted: formatAuctionAmount(ev.finalAmount ?? 0, unit),
            teamName: ev.soldToTeamName ?? "Team",
            soldAt: ev.timestamp ? ev.timestamp.toISOString() : null,
          }));
        }
      } catch (eventErr) {
        logger.warn({ eventErr }, "OperationalDataService: auctionPlayerEventsTable query failed, falling back to playersTable");
      }

      // 2. Fallback to playersTable where status = 'sold'
      const players = await db
        .select({
          id: playersTable.id,
          name: playersTable.name,
          role: playersTable.role,
          soldPrice: playersTable.soldPrice,
          teamId: playersTable.teamId,
          updatedAt: playersTable.updatedAt,
        })
        .from(playersTable)
        .where(
          and(
            eq(playersTable.tournamentId, options.tournamentId),
            eq(playersTable.status, "sold")
          )
        )
        .orderBy(desc(playersTable.updatedAt), desc(playersTable.id))
        .limit(limit);

      if (!players || players.length === 0) {
        return [];
      }

      const teamIds = Array.from(new Set(players.map((p) => p.teamId).filter((tid): tid is number => tid != null)));
      const teamMap = new Map<number, { name: string; shortCode: string }>();
      if (teamIds.length > 0) {
        const teams = await db
          .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
          .from(teamsTable)
          .where(inArray(teamsTable.id, teamIds));
        for (const tm of teams) {
          teamMap.set(tm.id, { name: tm.name, shortCode: tm.shortCode });
        }
      }

      return players.map((p, idx) => {
        const tm = p.teamId ? teamMap.get(p.teamId) : null;
        const price = p.soldPrice ?? 0;
        return {
          rank: idx + 1,
          playerId: p.id,
          playerName: p.name,
          role: p.role,
          soldPrice: price,
          soldPriceFormatted: formatAuctionAmount(price, unit),
          teamName: tm?.name ?? "Team",
          teamShortCode: tm?.shortCode ?? null,
          soldAt: p.updatedAt ? p.updatedAt.toISOString() : null,
        };
      });
    } catch (err) {
      logger.error({ err, options }, "OperationalDataService: Error fetching last sold players");
      return [];
    }
  }

  /**
   * Retrieve team purse rankings, spending summary, and maximum allowed next bids.
   */
  public async getTeamPurseAndRankings(options: {
    tournamentId: number;
    sortBy?: "spent" | "remaining" | "players" | "name";
  }): Promise<TeamPurseRankingItem[]> {
    try {
      const [t] = await db
        .select({
          auctionUnit: tournamentsTable.auctionUnit,
          minBid: tournamentsTable.minBid,
          minimumSquadSize: tournamentsTable.minimumSquadSize,
          maximumSquadSize: tournamentsTable.maximumSquadSize,
        })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, options.tournamentId))
        .limit(1);

      const unit = normalizeAuctionUnit(t?.auctionUnit);
      const minBid = t?.minBid ?? 100000;
      const minSquad = t?.minimumSquadSize ?? 0;
      const maxSquad = t?.maximumSquadSize ?? 0;

      const teams = await db
        .select({
          id: teamsTable.id,
          name: teamsTable.name,
          shortCode: teamsTable.shortCode,
          ownerName: teamsTable.ownerName,
          purse: teamsTable.purse,
          purseUsed: teamsTable.purseUsed,
        })
        .from(teamsTable)
        .where(eq(teamsTable.tournamentId, options.tournamentId));

      if (!teams || teams.length === 0) return [];

      const boughtPlayers = await db
        .select({ teamId: playersTable.teamId })
        .from(playersTable)
        .where(
          and(
            eq(playersTable.tournamentId, options.tournamentId),
            or(eq(playersTable.status, "sold"), eq(playersTable.status, "retained"))
          )
        );

      const squadCounts = new Map<number, number>();
      for (const bp of boughtPlayers) {
        if (bp.teamId != null) {
          squadCounts.set(bp.teamId, (squadCounts.get(bp.teamId) ?? 0) + 1);
        }
      }

      const items: TeamPurseRankingItem[] = teams.map((tm) => {
        const playersCount = squadCounts.get(tm.id) ?? 0;
        const purseTotal = tm.purse ?? 0;
        const purseUsed = tm.purseUsed ?? 0;
        const remaining = Math.max(0, purseTotal - purseUsed);

        const protection = computePurseProtection({
          purse: purseTotal,
          purseUsed,
          boosterTotal: 0,
          playersBought: playersCount,
          minimumSquadSize: minSquad,
          maximumSquadSize: maxSquad,
          minBid,
        });

        return {
          rank: 0,
          teamId: tm.id,
          teamName: tm.name,
          shortCode: tm.shortCode,
          ownerName: tm.ownerName,
          purseTotal: formatAuctionAmount(purseTotal, unit),
          purseUsed: formatAuctionAmount(purseUsed, unit),
          purseRemaining: formatAuctionAmount(remaining, unit),
          spentRaw: purseUsed,
          remainingRaw: remaining,
          playersBoughtCount: playersCount,
          maxAllowedBid: formatAuctionAmount(protection.maxAllowedBid, unit),
          slotsRequired: protection.slotsRequired,
          futureReservePurse: formatAuctionAmount(protection.futureReservePurse, unit),
        };
      });

      const sortBy = options.sortBy ?? "spent";
      if (sortBy === "spent") {
        items.sort((a, b) => b.spentRaw - a.spentRaw);
      } else if (sortBy === "remaining") {
        items.sort((a, b) => b.remainingRaw - a.remainingRaw);
      } else if (sortBy === "players") {
        items.sort((a, b) => b.playersBoughtCount - a.playersBoughtCount);
      } else {
        items.sort((a, b) => a.teamName.localeCompare(b.teamName));
      }

      return items.map((it, idx) => ({ ...it, rank: idx + 1 }));
    } catch (err) {
      logger.error({ err, options }, "OperationalDataService: Error fetching team purse rankings");
      return [];
    }
  }

  /**
   * Retrieve complete team-wise player acquisition hierarchy.
   */
  public async getTeamWiseAcquisitionHierarchy(tournamentId: number): Promise<TeamHierarchyItem[]> {
    try {
      const [t] = await db
        .select({ auctionUnit: tournamentsTable.auctionUnit })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, tournamentId))
        .limit(1);

      const unit = normalizeAuctionUnit(t?.auctionUnit);

      const teams = await db
        .select({
          id: teamsTable.id,
          name: teamsTable.name,
          shortCode: teamsTable.shortCode,
          ownerName: teamsTable.ownerName,
          purse: teamsTable.purse,
          purseUsed: teamsTable.purseUsed,
        })
        .from(teamsTable)
        .where(eq(teamsTable.tournamentId, tournamentId))
        .orderBy(asc(teamsTable.name));

      if (!teams || teams.length === 0) return [];

      const players = await db
        .select({
          id: playersTable.id,
          name: playersTable.name,
          role: playersTable.role,
          soldPrice: playersTable.soldPrice,
          retainedPrice: playersTable.retainedPrice,
          status: playersTable.status,
          teamId: playersTable.teamId,
        })
        .from(playersTable)
        .where(
          and(
            eq(playersTable.tournamentId, tournamentId),
            or(eq(playersTable.status, "sold"), eq(playersTable.status, "retained"))
          )
        )
        .orderBy(desc(playersTable.soldPrice), asc(playersTable.name));

      const teamPlayersMap = new Map<number, typeof players>();
      for (const p of players) {
        if (p.teamId != null) {
          const list = teamPlayersMap.get(p.teamId) || [];
          list.push(p);
          teamPlayersMap.set(p.teamId, list);
        }
      }

      return teams.map((tm) => {
        const squad = teamPlayersMap.get(tm.id) || [];
        const remaining = Math.max(0, (tm.purse ?? 0) - (tm.purseUsed ?? 0));
        return {
          teamId: tm.id,
          teamName: tm.name,
          shortCode: tm.shortCode,
          ownerName: tm.ownerName,
          totalSpent: formatAuctionAmount(tm.purseUsed ?? 0, unit),
          purseRemaining: formatAuctionAmount(remaining, unit),
          playersCount: squad.length,
          players: squad.map((p) => ({
            name: p.name,
            role: p.role,
            price: formatAuctionAmount(p.soldPrice ?? p.retainedPrice ?? 0, unit),
            status: p.status,
          })),
        };
      });
    } catch (err) {
      logger.error({ err, tournamentId }, "OperationalDataService: Error fetching team acquisition hierarchy");
      return [];
    }
  }

  /**
   * Retrieve all sold players sorted by sold price.
   */
  public async getAllSoldPlayersSorted(tournamentId: number, order: "desc" | "asc" = "desc"): Promise<PlayerRankingItem[]> {
    return this.getTopSoldPlayers({ tournamentId, limit: 100 });
  }

  // ─── SAFE HUMAN-READABLE WHATSAPP RESPONSE FORMATTERS ──────────────────────────

  public formatTournamentRulesResponse(
    rules: TournamentDetailsAndRules,
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish"
  ): string {
    const isEnglish = preferredLanguage === "english";

    const lines = [
      `📋 *${rules.tournamentName}*${rules.city ? ` (${rules.city})` : ""} — Configured Auction Rules:`,
      "",
      `• *Tournament Status:* ${rules.status.toUpperCase()}`,
      `• *Sport:* ${rules.sport.toUpperCase()}`,
      `• *Registered Teams:* ${rules.registeredTeamsCount}`,
      `• *Registered Players:* ${rules.registeredPlayersCount}`,
      rules.registrationLink ? `• *Registration Link:* ${rules.registrationLink}` : null,
      "",
      `*Auction Rules & Bidding Matrix:*`,
      `• *Base Team Purse:* ${rules.basePurseFormatted}`,
      `• *Minimum Starting Bid:* ${rules.minBidFormatted}`,
      `• *Default Bid Increment:* ${rules.bidIncrementFormatted}`,
      rules.bidTiers?.tier1UpTo ? `• *Tier 1:* Up to ${rules.bidTiers.tier1UpTo} (+${rules.bidTiers.tier1Increment})` : null,
      rules.bidTiers?.tier2UpTo ? `• *Tier 2:* Up to ${rules.bidTiers.tier2UpTo} (+${rules.bidTiers.tier2Increment})` : null,
      rules.bidTiers?.tier3Increment ? `• *Tier 3:* Above Tier 2 (+${rules.bidTiers.tier3Increment})` : null,
      `• *Countdown Timer:* ${rules.timerSeconds}s (Bid Timer: ${rules.bidTimerSeconds}s)`,
      rules.bidExtensionEnabled ? `• *Bid Extension:* Enabled (+${rules.bidExtensionSeconds}s in last 3s)` : null,
      rules.minimumSquadSize > 0 ? `• *Minimum Squad Size:* ${rules.minimumSquadSize} players` : null,
      rules.maximumSquadSize > 0 ? `• *Maximum Squad Size:* ${rules.maximumSquadSize} players` : null,
      `• *Selection Mode:* ${rules.playerSelectionMode.toUpperCase()}`,
    ].filter(Boolean);

    if (rules.categories.length > 0) {
      lines.push("", "*Configured Player Categories:*");
      for (const cat of rules.categories) {
        const minStr = cat.minBidFormatted ? ` (Base: ${cat.minBidFormatted})` : "";
        const maxStr = cat.maxPlayers ? ` [Max: ${cat.maxPlayers}]` : "";
        lines.push(`• *${cat.name}*${minStr}${maxStr}`);
      }
    }

    lines.push(
      isEnglish
        ? "\nFor live auction bidding and team management, visit https://bidwar.in."
        : "\nLive auction bidding aur team management ke liye bidwar.in portal par jayein."
    );

    return lines.join("\n");
  }

  public formatLiveAuctionStateResponse(
    state: LiveAuctionStateDetail,
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish"
  ): string {
    const isEnglish = preferredLanguage === "english";

    const statusBadge =
      state.auctionStatus === "live"
        ? "🟢 LIVE"
        : state.auctionStatus === "paused"
          ? "🟡 PAUSED"
          : state.auctionStatus === "completed"
            ? "🏁 COMPLETED"
            : "⏳ UPCOMING / SETUP";

    const lines = [
      `⚡ *${state.tournamentName}*${state.city ? ` (${state.city})` : ""} — Live Auction State:`,
      `• *Status:* ${statusBadge}`,
      `• *Total Players in Pool:* ${state.totalPlayersCount}`,
      `• *Sold Players:* ${state.soldPlayersCount}`,
      `• *Unsold Players:* ${state.unsoldPlayersCount}`,
      `• *Remaining in Pool:* ${state.remainingPlayersCount}`,
    ];

    if (state.auctionStatus === "live" || state.auctionStatus === "paused") {
      lines.push("");
      if (state.currentPlayer) {
        const catStr = state.currentPlayer.categoryName ? ` [${state.currentPlayer.categoryName}]` : "";
        const roleStr = state.currentPlayer.role ? ` (${state.currentPlayer.role})` : "";
        lines.push(`👤 *Current Player on Block:*`);
        lines.push(`• Name: *${state.currentPlayer.name}*${roleStr}${catStr}`);
        lines.push(`• Base Price: ${state.currentPlayer.basePriceFormatted}`);
        lines.push(`• Current Bid: *${state.currentBidFormatted ?? state.currentPlayer.basePriceFormatted}*`);
        if (state.leadingTeam) {
          lines.push(`• Leading Team: *${state.leadingTeam.name}* (${state.leadingTeam.shortCode ?? "Team"})`);
        } else {
          lines.push(`• Leading Team: Awaiting first bid`);
        }
        if (state.timerRemainingSeconds != null) {
          lines.push(`• Timer Remaining: ${state.timerRemainingSeconds}s`);
        }
      } else {
        lines.push(`• Current Player: Next player will be called on block shortly.`);
      }
    }

    lines.push(
      isEnglish
        ? "\nLive operator console & mobile bidding: https://bidwar.in"
        : "\nLive operator console aur mobile bidding ke liye bidwar.in par jayein."
    );

    return lines.join("\n");
  }

  public formatTopSoldPlayersResponse(
    players: PlayerRankingItem[],
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish",
    tournamentName?: string,
    limit: number = 5
  ): string {
    const isEnglish = preferredLanguage === "english";

    if (players.length === 0) {
      return isEnglish
        ? `No players have been sold yet in ${tournamentName ?? "this tournament"}. Once auction bidding concludes for players, top rankings will appear here.`
        : `${tournamentName ? `"${tournamentName}" mein ` : ""}Abhi koi player sold nahi hua hai. Auction mein players bikne ke baad top rankings yahan dikhenge.`;
    }

    const titlePrefix = limit === 1 ? "Top Highest Sold Player" : `Top ${Math.min(limit, players.length)} Highest Sold Players`;
    const lines = [
      `💎 *${tournamentName ? `${tournamentName} — ` : ""}${titlePrefix}:*`,
      "",
    ];

    for (const p of players) {
      const roleStr = p.role ? ` (${p.role})` : "";
      const catStr = p.categoryName ? ` [${p.categoryName}]` : "";
      lines.push(`${p.rank}. *${p.playerName}*${roleStr}${catStr}`);
      lines.push(`   💰 Sold for: *${p.soldPriceFormatted}* ➔ *${p.teamName}*`);
    }

    lines.push(
      isEnglish
        ? "\nComplete squads and bid history are available at https://bidwar.in."
        : "\nComplete squad roster aur bid history dekhne ke liye bidwar.in portal par jayein."
    );

    return lines.join("\n");
  }

  public formatLastSoldPlayersResponse(
    players: PlayerRankingItem[],
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish",
    tournamentName?: string,
    limit: number = 5
  ): string {
    const isEnglish = preferredLanguage === "english";

    if (players.length === 0) {
      return isEnglish
        ? `No players have been sold yet in ${tournamentName ?? "this tournament"}. Recent sold players will appear once bidding commences.`
        : `${tournamentName ? `"${tournamentName}" mein ` : ""}Abhi tak koi player sold nahi hua hai. Auction shuru hone par recent sold players yahan show honge.`;
    }

    const titlePrefix = limit === 1 ? "Most Recently Sold Player" : `Last ${Math.min(limit, players.length)} Sold Players`;
    const lines = [
      `🏏 *${tournamentName ? `${tournamentName} — ` : ""}${titlePrefix}:*`,
      "",
    ];

    for (const p of players) {
      const roleStr = p.role ? ` (${p.role})` : "";
      lines.push(`${p.rank}. *${p.playerName}*${roleStr}`);
      lines.push(`   💰 Sold for: *${p.soldPriceFormatted}* ➔ Team: *${p.teamName}*`);
    }

    lines.push(
      isEnglish
        ? "\nReal-time auction updates are available at https://bidwar.in."
        : "\nReal-time auction updates dekhne ke liye bidwar.in par jayein."
    );

    return lines.join("\n");
  }

  public formatTeamPurseRankingsResponse(
    rankings: TeamPurseRankingItem[],
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish",
    tournamentName?: string,
    metric: "spent" | "remaining" = "spent"
  ): string {
    const isEnglish = preferredLanguage === "english";

    if (rankings.length === 0) {
      return isEnglish
        ? `No team purse records found for ${tournamentName ?? "this tournament"}.`
        : `${tournamentName ? `"${tournamentName}" ke ` : ""}Teams ka purse data abhi available nahi hai.`;
    }

    const title =
      metric === "spent"
        ? "Team Spending Summary (Highest Spent First)"
        : "Team Remaining Purse Rankings (Highest Purse First)";

    const lines = [
      `💰 *${tournamentName ? `${tournamentName} — ` : ""}${title}:*`,
      "",
    ];

    for (const tm of rankings) {
      lines.push(`${tm.rank}. *${tm.teamName}* (${tm.shortCode})`);
      lines.push(`   • Spent: ${tm.purseUsed} | Remaining: *${tm.purseRemaining}*`);
      lines.push(`   • Players Bought: ${tm.playersBoughtCount} | Max Next Bid: *${tm.maxAllowedBid}*`);
    }

    lines.push(
      isEnglish
        ? "\nDetailed team budgets and live bidding: https://bidwar.in"
        : "\nDetailed team budgets aur live bidding ke liye bidwar.in par jayein."
    );

    return lines.join("\n");
  }

  public formatTeamHierarchyResponse(
    hierarchy: TeamHierarchyItem[],
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish",
    tournamentName?: string
  ): string {
    const isEnglish = preferredLanguage === "english";

    if (hierarchy.length === 0) {
      return isEnglish
        ? `No registered teams or acquired players found for ${tournamentName ?? "this tournament"}.`
        : `${tournamentName ? `"${tournamentName}" mein ` : ""}Abhi koi team-wise acquisition data available nahi hai.`;
    }

    const lines = [
      `🏆 *${tournamentName ? `${tournamentName} — ` : ""}Team-wise Sold Players Hierarchy:*`,
      "",
    ];

    for (const tm of hierarchy) {
      lines.push(`🛡️ *${tm.teamName}* (${tm.shortCode}) — Total Spent: ${tm.totalSpent} (Remaining: ${tm.purseRemaining})`);
      lines.push(`• Total Acquired: ${tm.playersCount} players`);
      if (tm.players.length === 0) {
        lines.push(`  (No players bought yet)`);
      } else {
        for (const p of tm.players) {
          lines.push(`  - ${p.name} (${p.role ?? "Player"}): ${p.price}`);
        }
      }
      lines.push("");
    }

    lines.push(
      isEnglish
        ? "Complete rosters and official exports: https://bidwar.in"
        : "Complete roster aur official report export karne ke liye bidwar.in portal par jayein."
    );

    return lines.join("\n");
  }

  public formatMaxBidResponse(
    details: TeamOwnerAuctionDetail,
    preferredLanguage: "hindi" | "english" | "hinglish" = "hinglish"
  ): string {
    const isEnglish = preferredLanguage === "english";

    const lines = [
      `🔨 *${details.teamName} — Maximum Permissible Next Bid:*`,
      "",
      `• *Team:* ${details.teamName} (Owner: ${details.ownerName})`,
      `• *Tournament:* ${details.tournamentName}`,
      `• *Remaining Purse:* ${details.purseRemaining}`,
      details.maxAllowedBid ? `• *Maximum Permissible Next Bid:* *${details.maxAllowedBid}*` : null,
      details.reservePurse ? `• *Reserve Purse for Squad:* ${details.reservePurse}` : null,
      details.slotsRequired != null ? `• *Remaining Squad Slots to Fill:* ${details.slotsRequired}` : null,
      `• *Current Squad Size:* ${details.playersBoughtCount} players`,
      "",
      isEnglish
        ? "Purse protection guarantees your team retains sufficient budget to fill mandatory minimum squad slots."
        : "Purse protection rule sunishchit karta hai ki aapki team ke paas minimum squad slots bharne ke liye base price reserve safe rahe.",
      "",
      "Live mobile bidding ke liye bidwar.in portal par login karein.",
    ].filter(Boolean);

    return lines.join("\n");
  }
}

export const operationalDataService = new OperationalDataService();
