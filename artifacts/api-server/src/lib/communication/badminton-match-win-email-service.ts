import {
  db,
  badmintonPlayersTable,
  badmintonFixturesTable,
  badmintonCategoriesTable,
  globalPlayersTable,
  playerTeamAssignmentsTable,
  playersTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { BadmintonMatchState, BadmintonSideInfo } from "@workspace/badminton-core";
import { logger } from "../logger.js";
import { getPublicOrigin } from "../runtime-env.js";
import { createCommunicationJob } from "./job-service.js";
import { isValidEmail } from "./validation.js";
import {
  BADMINTON_MATCH_WIN_HTML,
  BADMINTON_MATCH_WIN_SUBJECT,
} from "./badminton-match-win-email-template.js";

const TEMPLATE_KEY = "badminton_match_win";
const EVENT_TYPE = "BADMINTON_MATCH_WIN";

type WinRecipient = {
  email: string;
  name: string;
  role: "player" | "team_owner";
  entityType: "badminton_player" | "team";
  entityId: number;
};

function appUrl(): string {
  return process.env.APP_URL?.trim() || getPublicOrigin();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildIdempotencyKey(matchId: number, email: string): string {
  return `${EVENT_TYPE}:match:${matchId}:email:${normalizeEmail(email)}`;
}

function formatScoreLine(state: BadmintonMatchState): string {
  const completed = (state.games ?? []).filter((g) => g.phase === "completed");
  if (completed.length === 0) return "";
  return completed.map((g) => `${g.leftScore}-${g.rightScore}`).join(", ");
}

function formatResultLabel(state: BadmintonMatchState): string {
  switch (state.matchStatus) {
    case "walkover":
      return "Walkover Win";
    case "retired":
      return "Win by Retirement";
    case "disqualified":
      return "Win by Disqualification";
    case "abandoned":
      return "Match Ended";
    default:
      return "Match Win";
  }
}

function buildBidwarLogoHtml(): string {
  const base = appUrl().replace(/\/$/, "");
  const src = escapeHtml(`${base}/bidwar-primary-logo.png`);
  return `<img src="${src}" width="140" height="48" alt="BidWar" style="display:block;border:0;outline:none;text-decoration:none;max-width:140px;height:auto;" />`;
}

function sideFranchiseName(side: BadmintonSideInfo): string {
  return (side.franchiseName || side.teamName || "").trim();
}

async function resolveCategoryName(
  tournamentId: number,
  matchId: number,
): Promise<string> {
  const [row] = await db
    .select({
      categoryName: badmintonCategoriesTable.name,
    })
    .from(badmintonFixturesTable)
    .innerJoin(
      badmintonCategoriesTable,
      and(
        eq(badmintonCategoriesTable.id, badmintonFixturesTable.categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .where(
      and(
        eq(badmintonFixturesTable.scoringMatchId, matchId),
        eq(badmintonFixturesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  return row?.categoryName?.trim() ?? "";
}

async function resolveTournamentContext(tournamentId: number): Promise<{
  tournamentName: string;
  organiserName: string;
  organiserEmail: string;
}> {
  const [tournament] = await db
    .select({
      name: tournamentsTable.name,
      organizerName: tournamentsTable.organizerName,
      organizerEmail: tournamentsTable.organizerEmail,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  return {
    tournamentName: tournament?.name?.trim() || "Badminton Tournament",
    organiserName: tournament?.organizerName?.trim() ?? "",
    organiserEmail: tournament?.organizerEmail?.trim() ?? "",
  };
}

async function resolveAuctionTeamIdsForPlayers(
  tournamentId: number,
  players: Array<{
    id: number;
    masterPlayerId: string | null;
  }>,
): Promise<Map<number, number>> {
  const playerToTeam = new Map<number, number>();
  const masterIds = players
    .map((p) => p.masterPlayerId)
    .filter((id): id is string => Boolean(id?.trim()));

  if (masterIds.length > 0) {
    const assignments = await db
      .select({
        playerId: playerTeamAssignmentsTable.playerId,
        auctionTeamId: playerTeamAssignmentsTable.auctionTeamId,
      })
      .from(playerTeamAssignmentsTable)
      .where(
        and(
          inArray(playerTeamAssignmentsTable.playerId, masterIds),
          eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
          eq(playerTeamAssignmentsTable.isActive, true),
        ),
      )
      .orderBy(desc(playerTeamAssignmentsTable.assignedAt));

    const masterToAuctionTeam = new Map<string, number>();
    for (const row of assignments) {
      if (row.auctionTeamId != null && !masterToAuctionTeam.has(row.playerId)) {
        masterToAuctionTeam.set(row.playerId, row.auctionTeamId);
      }
    }

    for (const player of players) {
      if (!player.masterPlayerId) continue;
      const teamId = masterToAuctionTeam.get(player.masterPlayerId);
      if (teamId != null) playerToTeam.set(player.id, teamId);
    }

    const unresolvedMasterIds = players
      .filter((p) => p.masterPlayerId && !playerToTeam.has(p.id))
      .map((p) => p.masterPlayerId!);

    if (unresolvedMasterIds.length > 0) {
      const globals = await db
        .select({
          id: globalPlayersTable.id,
          auctionPlayerId: globalPlayersTable.auctionPlayerId,
        })
        .from(globalPlayersTable)
        .where(inArray(globalPlayersTable.id, unresolvedMasterIds));

      const auctionPlayerIds = globals
        .map((g) => g.auctionPlayerId)
        .filter((id): id is number => id != null);

      if (auctionPlayerIds.length > 0) {
        const auctionPlayers = await db
          .select({
            id: playersTable.id,
            teamId: playersTable.teamId,
          })
          .from(playersTable)
          .where(
            and(
              inArray(playersTable.id, auctionPlayerIds),
              eq(playersTable.tournamentId, tournamentId),
            ),
          );

        const auctionToTeam = new Map(
          auctionPlayers
            .filter((p) => p.teamId != null)
            .map((p) => [p.id, p.teamId!]),
        );
        const masterToAuction = new Map(
          globals
            .filter((g) => g.auctionPlayerId != null)
            .map((g) => [g.id, g.auctionPlayerId!]),
        );

        for (const player of players) {
          if (!player.masterPlayerId || playerToTeam.has(player.id)) continue;
          const auctionId = masterToAuction.get(player.masterPlayerId);
          if (auctionId == null) continue;
          const teamId = auctionToTeam.get(auctionId);
          if (teamId != null) playerToTeam.set(player.id, teamId);
        }
      }
    }
  }

  return playerToTeam;
}

async function collectWinRecipients(params: {
  tournamentId: number;
  winnerSide: BadmintonSideInfo;
}): Promise<WinRecipient[]> {
  const { tournamentId, winnerSide } = params;
  const playerIds = [...new Set(winnerSide.playerIds ?? [])].filter((id) => id > 0);
  const recipients: WinRecipient[] = [];
  const seenEmails = new Set<string>();

  const addRecipient = (recipient: WinRecipient) => {
    const key = normalizeEmail(recipient.email);
    if (!isValidEmail(key) || seenEmails.has(key)) return;
    seenEmails.add(key);
    recipients.push({ ...recipient, email: key });
  };

  let players: Array<{
    id: number;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    masterPlayerId: string | null;
  }> = [];

  if (playerIds.length > 0) {
    players = await db
      .select({
        id: badmintonPlayersTable.id,
        firstName: badmintonPlayersTable.firstName,
        lastName: badmintonPlayersTable.lastName,
        displayName: badmintonPlayersTable.displayName,
        email: badmintonPlayersTable.email,
        masterPlayerId: badmintonPlayersTable.masterPlayerId,
      })
      .from(badmintonPlayersTable)
      .where(
        and(
          eq(badmintonPlayersTable.tournamentId, tournamentId),
          inArray(badmintonPlayersTable.id, playerIds),
        ),
      );

    for (const player of players) {
      if (!player.email) continue;
      const name =
        player.displayName?.trim() ||
        `${player.firstName} ${player.lastName}`.trim() ||
        "Player";
      addRecipient({
        email: player.email,
        name,
        role: "player",
        entityType: "badminton_player",
        entityId: player.id,
      });
    }

    // Fallback: global_players.email when badminton player email is missing
    const missingEmailPlayers = players.filter((p) => !p.email && p.masterPlayerId);
    if (missingEmailPlayers.length > 0) {
      const masterIds = missingEmailPlayers.map((p) => p.masterPlayerId!);
      const globals = await db
        .select({
          id: globalPlayersTable.id,
          email: globalPlayersTable.email,
          displayName: globalPlayersTable.displayName,
          canonicalName: globalPlayersTable.canonicalName,
        })
        .from(globalPlayersTable)
        .where(inArray(globalPlayersTable.id, masterIds));

      const byMaster = new Map(globals.map((g) => [g.id, g]));
      for (const player of missingEmailPlayers) {
        const global = byMaster.get(player.masterPlayerId!);
        if (!global?.email) continue;
        const name =
          player.displayName?.trim() ||
          global.displayName?.trim() ||
          global.canonicalName?.trim() ||
          `${player.firstName} ${player.lastName}`.trim() ||
          "Player";
        addRecipient({
          email: global.email,
          name,
          role: "player",
          entityType: "badminton_player",
          entityId: player.id,
        });
      }
    }
  }

  const teamIds = new Set<number>();
  const playerToTeam = await resolveAuctionTeamIdsForPlayers(tournamentId, players);
  for (const teamId of playerToTeam.values()) teamIds.add(teamId);

  const franchiseName = sideFranchiseName(winnerSide);
  if (franchiseName) {
    const [franchiseTeam] = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(
        and(
          eq(teamsTable.tournamentId, tournamentId),
          eq(teamsTable.name, franchiseName),
        ),
      )
      .limit(1);
    if (franchiseTeam) teamIds.add(franchiseTeam.id);
  }

  if (teamIds.size > 0) {
    const teams = await db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        ownerName: teamsTable.ownerName,
        ownerEmail: teamsTable.ownerEmail,
      })
      .from(teamsTable)
      .where(
        and(
          eq(teamsTable.tournamentId, tournamentId),
          inArray(teamsTable.id, [...teamIds]),
        ),
      );

    for (const team of teams) {
      if (!team.ownerEmail) continue;
      addRecipient({
        email: team.ownerEmail,
        name: team.ownerName?.trim() || team.name || "Team Owner",
        role: "team_owner",
        entityType: "team",
        entityId: team.id,
      });
    }
  }

  return recipients;
}

function buildMergeData(params: {
  recipientName: string;
  state: BadmintonMatchState;
  winnerSide: BadmintonSideInfo;
  opponentSide: BadmintonSideInfo;
  tournamentName: string;
  categoryName: string;
  organiserName: string;
  organiserEmail: string;
}): Record<string, unknown> {
  const scoreLine = formatScoreLine(params.state);
  const franchiseName = sideFranchiseName(params.winnerSide);

  return {
    recipient_name: params.recipientName,
    player_name: params.recipientName,
    owner_name: params.recipientName,
    winner_label: params.winnerSide.label || "Winners",
    opponent_label: params.opponentSide.label || "Opponents",
    tournament_name: params.tournamentName,
    category_name: params.categoryName,
    score_line: scoreLine,
    games_score: `${params.state.gamesLeft}-${params.state.gamesRight}`,
    result_label: formatResultLabel(params.state),
    franchise_name: franchiseName,
    team_name: franchiseName,
    sport_name: "Badminton",
    organiser_name: params.organiserName,
    organiser_email: params.organiserEmail,
    bidwar_logo: buildBidwarLogoHtml(),
    app_url: appUrl(),
    brand_name: "BidWar",
    powered_by_text: "Powered by BidWar · Support BidWar",
    current_year: String(new Date().getFullYear()),
  };
}

/**
 * Enqueue congratulations emails for badminton match winners (players + team owners).
 * Never throws — scoring flow must continue normally.
 */
export async function enqueueBadmintonMatchWinEmails(params: {
  matchId: number;
  tournamentId: number;
  state: BadmintonMatchState;
}): Promise<void> {
  const { matchId, tournamentId, state } = params;

  try {
    if (state.winnerSide !== "left" && state.winnerSide !== "right") {
      logger.debug({ matchId }, "Badminton match win email: skipped (no winnerSide)");
      return;
    }

    const winnerSide = state.winnerSide === "left" ? state.leftSide : state.rightSide;
    const opponentSide = state.winnerSide === "left" ? state.rightSide : state.leftSide;

    const [recipients, tournamentCtx, categoryName] = await Promise.all([
      collectWinRecipients({ tournamentId, winnerSide }),
      resolveTournamentContext(tournamentId),
      resolveCategoryName(tournamentId, matchId),
    ]);

    if (recipients.length === 0) {
      logger.info(
        { matchId, tournamentId },
        "Badminton match win email: no registered emails for winners",
      );
      return;
    }

    for (const recipient of recipients) {
      const mergeData = buildMergeData({
        recipientName: recipient.name,
        state,
        winnerSide,
        opponentSide,
        tournamentName: tournamentCtx.tournamentName,
        categoryName,
        organiserName: tournamentCtx.organiserName,
        organiserEmail: tournamentCtx.organiserEmail,
      });

      const jobId = await createCommunicationJob({
        channel: "email",
        templateInternalKey: TEMPLATE_KEY,
        tournamentId,
        triggeredByEvent: EVENT_TYPE,
        entityType: recipient.entityType,
        entityId: recipient.entityId,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientRole: recipient.role,
        mergeData,
        idempotencyKey: buildIdempotencyKey(matchId, recipient.email),
        sentBy: "system",
      });

      if (jobId) {
        logger.info(
          {
            jobId,
            matchId,
            tournamentId,
            email: recipient.email,
            role: recipient.role,
          },
          "Badminton match win email: job created",
        );
      }
    }
  } catch (err) {
    logger.error(
      { err, matchId, tournamentId },
      "Badminton match win email: unexpected error",
    );
  }
}

/** Fire-and-forget wrapper — never throws. */
export function enqueueBadmintonMatchWinEmailsAsync(params: {
  matchId: number;
  tournamentId: number;
  state: BadmintonMatchState;
}): void {
  void enqueueBadmintonMatchWinEmails(params);
}

/** Exported for tests / preview fallbacks. */
export const BADMINTON_MATCH_WIN_TEMPLATE = {
  subject: BADMINTON_MATCH_WIN_SUBJECT,
  html: BADMINTON_MATCH_WIN_HTML,
  templateKey: TEMPLATE_KEY,
  eventType: EVENT_TYPE,
};
