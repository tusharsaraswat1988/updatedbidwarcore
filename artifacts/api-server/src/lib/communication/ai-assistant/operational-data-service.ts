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
  scoringMatchesTable,
  badmintonMatchDetailsTable,
  auctionSessionsTable,
  membersTable,
  memberRolesTable,
} from "@workspace/db";
import { eq, and, or, inArray, desc, sql } from "drizzle-orm";
import { logger } from "../../logger";
import { formatAuctionAmount, normalizeAuctionUnit, type AuctionUnit } from "@workspace/auction/auction-unit";
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
        .select({ name: tournamentsTable.name, auctionUnit: tournamentsTable.auctionUnit })
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
}

export const operationalDataService = new OperationalDataService();
