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
import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import type { BadmintonMatchState, BadmintonSideInfo } from "@workspace/badminton-core";
import { logger } from "../logger.js";
import { getPublicOrigin } from "../runtime-env.js";
import { createCommunicationJob } from "./job-service.js";
import { isValidEmail } from "./validation.js";
import {
  BADMINTON_MATCH_WIN_HTML,
  BADMINTON_MATCH_WIN_SUBJECT,
} from "./badminton-match-win-email-template.js";
import {
  BADMINTON_MATCH_WIN_OWNER_HTML,
  BADMINTON_MATCH_WIN_OWNER_SUBJECT,
} from "./badminton-match-win-owner-email-template.js";

const PLAYER_TEMPLATE_KEY = "badminton_match_win";
const OWNER_TEMPLATE_KEY = "badminton_match_win_owner";
const PLAYER_EVENT_TYPE = "BADMINTON_MATCH_WIN";
const OWNER_EVENT_TYPE = "BADMINTON_MATCH_WIN_OWNER";

type WinRecipient = {
  email: string;
  name: string;
  role: "player" | "team_owner";
  entityType: "badminton_player" | "team";
  entityId: number;
  teamName?: string;
};

type BadmintonPlayerRow = {
  id: number;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  mobile: string | null;
  masterPlayerId: string | null;
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

function pickValidEmail(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return null;
  const normalized = normalizeEmail(email);
  return isValidEmail(normalized) ? normalized : null;
}

function buildIdempotencyKey(
  matchId: number,
  role: WinRecipient["role"],
  email: string,
): string {
  const eventType = role === "team_owner" ? OWNER_EVENT_TYPE : PLAYER_EVENT_TYPE;
  return `${eventType}:match:${matchId}:email:${normalizeEmail(email)}`;
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

function playerDisplayName(player: BadmintonPlayerRow, fallback?: string | null): string {
  return (
    player.displayName?.trim() ||
    fallback?.trim() ||
    `${player.firstName} ${player.lastName}`.trim() ||
    "Player"
  );
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
  organizerId: number | null;
}> {
  const [tournament] = await db
    .select({
      name: tournamentsTable.name,
      organizerName: tournamentsTable.organizerName,
      organizerEmail: tournamentsTable.organizerEmail,
      organizerId: tournamentsTable.organizerId,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  return {
    tournamentName: tournament?.name?.trim() || "Badminton Tournament",
    organiserName: tournament?.organizerName?.trim() ?? "",
    organiserEmail: tournament?.organizerEmail?.trim() ?? "",
    organizerId: tournament?.organizerId ?? null,
  };
}

/**
 * Auction / cross-tournament email fallback for a badminton player.
 * Order: global email → linked auctionPlayerId → players.globalPlayerId → mobile match.
 */
async function resolvePlayerEmailFromAuction(
  player: BadmintonPlayerRow,
): Promise<{ email: string; nameHint?: string } | null> {
  const masterId = player.masterPlayerId?.trim() || null;
  const mobile = player.mobile?.trim() || null;

  if (masterId) {
    const [global] = await db
      .select({
        email: globalPlayersTable.email,
        displayName: globalPlayersTable.displayName,
        canonicalName: globalPlayersTable.canonicalName,
        auctionPlayerId: globalPlayersTable.auctionPlayerId,
      })
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.id, masterId))
      .limit(1);

    const globalEmail = pickValidEmail(global?.email);
    if (globalEmail) {
      return {
        email: globalEmail,
        nameHint: global?.displayName || global?.canonicalName || undefined,
      };
    }

    if (global?.auctionPlayerId) {
      const [auctionById] = await db
        .select({
          email: playersTable.email,
          name: playersTable.name,
        })
        .from(playersTable)
        .where(eq(playersTable.id, global.auctionPlayerId))
        .limit(1);
      const email = pickValidEmail(auctionById?.email);
      if (email) {
        return { email, nameHint: auctionById?.name || undefined };
      }
    }

    const linkedAuctionPlayers = await db
      .select({
        email: playersTable.email,
        name: playersTable.name,
      })
      .from(playersTable)
      .where(
        and(
          eq(playersTable.globalPlayerId, masterId),
          isNotNull(playersTable.email),
          ne(playersTable.email, ""),
        ),
      )
      .orderBy(desc(playersTable.updatedAt))
      .limit(10);

    for (const row of linkedAuctionPlayers) {
      const email = pickValidEmail(row.email);
      if (email) return { email, nameHint: row.name || undefined };
    }
  }

  if (mobile) {
    const mobileMatches = await db
      .select({
        email: playersTable.email,
        name: playersTable.name,
      })
      .from(playersTable)
      .where(
        and(
          eq(playersTable.mobileNumber, mobile),
          isNotNull(playersTable.email),
          ne(playersTable.email, ""),
        ),
      )
      .orderBy(desc(playersTable.updatedAt))
      .limit(10);

    for (const row of mobileMatches) {
      const email = pickValidEmail(row.email);
      if (email) return { email, nameHint: row.name || undefined };
    }
  }

  return null;
}

async function resolveAuctionTeamIdsForPlayers(
  tournamentId: number,
  players: BadmintonPlayerRow[],
): Promise<Set<number>> {
  const teamIds = new Set<number>();
  const masterIds = players
    .map((p) => p.masterPlayerId)
    .filter((id): id is string => Boolean(id?.trim()));

  if (masterIds.length === 0) return teamIds;

  // Prefer current tournament assignments, then any other auction tournament.
  const assignments = await db
    .select({
      playerId: playerTeamAssignmentsTable.playerId,
      auctionTeamId: playerTeamAssignmentsTable.auctionTeamId,
      tournamentId: playerTeamAssignmentsTable.tournamentId,
      assignedAt: playerTeamAssignmentsTable.assignedAt,
    })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        inArray(playerTeamAssignmentsTable.playerId, masterIds),
        eq(playerTeamAssignmentsTable.isActive, true),
        isNotNull(playerTeamAssignmentsTable.auctionTeamId),
      ),
    )
    .orderBy(desc(playerTeamAssignmentsTable.assignedAt));

  const seenMasters = new Set<string>();
  for (const row of assignments) {
    if (row.tournamentId === tournamentId && row.auctionTeamId != null) {
      teamIds.add(row.auctionTeamId);
      seenMasters.add(row.playerId);
    }
  }
  for (const row of assignments) {
    if (seenMasters.has(row.playerId) || row.auctionTeamId == null) continue;
    teamIds.add(row.auctionTeamId);
    seenMasters.add(row.playerId);
  }

  const unresolvedMasterIds = masterIds.filter((id) => !seenMasters.has(id));
  if (unresolvedMasterIds.length === 0) return teamIds;

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

  if (auctionPlayerIds.length === 0) return teamIds;

  const auctionPlayers = await db
    .select({
      id: playersTable.id,
      teamId: playersTable.teamId,
      tournamentId: playersTable.tournamentId,
    })
    .from(playersTable)
    .where(
      and(
        inArray(playersTable.id, auctionPlayerIds),
        isNotNull(playersTable.teamId),
      ),
    );

  // Prefer same tournament team, else any linked auction team.
  const byAuctionId = new Map(auctionPlayers.map((p) => [p.id, p]));
  for (const global of globals) {
    if (global.auctionPlayerId == null) continue;
    const auction = byAuctionId.get(global.auctionPlayerId);
    if (auction?.teamId != null) teamIds.add(auction.teamId);
  }

  return teamIds;
}

async function resolveOwnerRecipients(params: {
  tournamentId: number;
  organizerId: number | null;
  winnerSide: BadmintonSideInfo;
  players: BadmintonPlayerRow[];
}): Promise<WinRecipient[]> {
  const { tournamentId, organizerId, winnerSide, players } = params;
  const recipients: WinRecipient[] = [];
  const seenEmails = new Set<string>();

  const addOwner = (input: {
    email: string | null | undefined;
    name: string;
    teamId: number;
    teamName: string;
  }) => {
    const email = pickValidEmail(input.email);
    if (!email || seenEmails.has(email)) return;
    seenEmails.add(email);
    recipients.push({
      email,
      name: input.name,
      role: "team_owner",
      entityType: "team",
      entityId: input.teamId,
      teamName: input.teamName,
    });
  };

  const teamIds = await resolveAuctionTeamIdsForPlayers(tournamentId, players);
  const franchiseName = sideFranchiseName(winnerSide);

  // Direct team lookup by IDs + franchise name in current tournament.
  const directTeams: Array<{
    id: number;
    name: string;
    ownerName: string;
    ownerEmail: string | null;
    masterTeamId: string | null;
  }> = [];

  if (teamIds.size > 0) {
    const rows = await db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        ownerName: teamsTable.ownerName,
        ownerEmail: teamsTable.ownerEmail,
        masterTeamId: teamsTable.masterTeamId,
      })
      .from(teamsTable)
      .where(inArray(teamsTable.id, [...teamIds]));
    directTeams.push(...rows);
  }

  if (franchiseName) {
    const byName = await db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        ownerName: teamsTable.ownerName,
        ownerEmail: teamsTable.ownerEmail,
        masterTeamId: teamsTable.masterTeamId,
      })
      .from(teamsTable)
      .where(
        and(
          eq(teamsTable.tournamentId, tournamentId),
          eq(teamsTable.name, franchiseName),
        ),
      );
    for (const row of byName) {
      if (!directTeams.some((t) => t.id === row.id)) directTeams.push(row);
    }
  }

  for (const team of directTeams) {
    addOwner({
      email: team.ownerEmail,
      name: team.ownerName?.trim() || team.name || "Team Owner",
      teamId: team.id,
      teamName: team.name,
    });
  }

  // Auction fallback: same masterTeamId elsewhere with owner email.
  const masterTeamIds = [
    ...new Set(
      directTeams
        .filter((t) => !pickValidEmail(t.ownerEmail) && t.masterTeamId)
        .map((t) => t.masterTeamId!),
    ),
  ];
  if (masterTeamIds.length > 0) {
    const masterMatches = await db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        ownerName: teamsTable.ownerName,
        ownerEmail: teamsTable.ownerEmail,
      })
      .from(teamsTable)
      .where(
        and(
          inArray(teamsTable.masterTeamId, masterTeamIds),
          isNotNull(teamsTable.ownerEmail),
          ne(teamsTable.ownerEmail, ""),
        ),
      )
      .orderBy(desc(teamsTable.updatedAt))
      .limit(30);

    for (const team of masterMatches) {
      addOwner({
        email: team.ownerEmail,
        name: team.ownerName?.trim() || team.name || "Team Owner",
        teamId: team.id,
        teamName: team.name || franchiseName || "Franchise",
      });
    }
  }

  // Auction fallback: same franchise name under same organiser across tournaments.
  if (franchiseName && organizerId != null && recipients.length === 0) {
    const orgTeams = await db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        ownerName: teamsTable.ownerName,
        ownerEmail: teamsTable.ownerEmail,
      })
      .from(teamsTable)
      .innerJoin(tournamentsTable, eq(tournamentsTable.id, teamsTable.tournamentId))
      .where(
        and(
          eq(tournamentsTable.organizerId, organizerId),
          eq(teamsTable.name, franchiseName),
          isNotNull(teamsTable.ownerEmail),
          ne(teamsTable.ownerEmail, ""),
        ),
      )
      .orderBy(desc(teamsTable.updatedAt))
      .limit(10);

    for (const team of orgTeams) {
      addOwner({
        email: team.ownerEmail,
        name: team.ownerName?.trim() || team.name || "Team Owner",
        teamId: team.id,
        teamName: team.name || franchiseName,
      });
    }
  }

  return recipients;
}

async function collectWinRecipients(params: {
  tournamentId: number;
  organizerId: number | null;
  winnerSide: BadmintonSideInfo;
}): Promise<WinRecipient[]> {
  const { tournamentId, organizerId, winnerSide } = params;
  const playerIds = [...new Set(winnerSide.playerIds ?? [])].filter((id) => id > 0);
  const recipients: WinRecipient[] = [];
  const seenPlayerEmails = new Set<string>();

  let players: BadmintonPlayerRow[] = [];

  if (playerIds.length > 0) {
    players = await db
      .select({
        id: badmintonPlayersTable.id,
        firstName: badmintonPlayersTable.firstName,
        lastName: badmintonPlayersTable.lastName,
        displayName: badmintonPlayersTable.displayName,
        email: badmintonPlayersTable.email,
        mobile: badmintonPlayersTable.mobile,
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
      let email = pickValidEmail(player.email);
      let nameHint: string | null = null;

      if (!email) {
        const auctionHit = await resolvePlayerEmailFromAuction(player);
        if (auctionHit) {
          email = auctionHit.email;
          nameHint = auctionHit.nameHint ?? null;
        }
      }

      if (!email || seenPlayerEmails.has(email)) continue;
      seenPlayerEmails.add(email);

      recipients.push({
        email,
        name: playerDisplayName(player, nameHint),
        role: "player",
        entityType: "badminton_player",
        entityId: player.id,
      });
    }
  }

  const owners = await resolveOwnerRecipients({
    tournamentId,
    organizerId,
    winnerSide,
    players,
  });
  recipients.push(...owners);

  return recipients;
}

function buildMergeData(params: {
  recipient: WinRecipient;
  state: BadmintonMatchState;
  winnerSide: BadmintonSideInfo;
  opponentSide: BadmintonSideInfo;
  tournamentName: string;
  categoryName: string;
  organiserName: string;
  organiserEmail: string;
}): Record<string, unknown> {
  const scoreLine = formatScoreLine(params.state);
  const franchiseName =
    params.recipient.teamName?.trim() ||
    sideFranchiseName(params.winnerSide) ||
    params.winnerSide.label ||
    "Franchise";

  return {
    recipient_name: params.recipient.name,
    player_name: params.recipient.name,
    owner_name: params.recipient.name,
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
 *
 * Email lookup:
 * 1) badminton player / team profile email
 * 2) auction / global fallbacks
 * 3) skip if still missing
 *
 * Players and owners get different Communication Center templates.
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

    const tournamentCtx = await resolveTournamentContext(tournamentId);
    const [recipients, categoryName] = await Promise.all([
      collectWinRecipients({
        tournamentId,
        organizerId: tournamentCtx.organizerId,
        winnerSide,
      }),
      resolveCategoryName(tournamentId, matchId),
    ]);

    if (recipients.length === 0) {
      logger.info(
        { matchId, tournamentId },
        "Badminton match win email: no registered emails for winners (badminton + auction)",
      );
      return;
    }

    for (const recipient of recipients) {
      const isOwner = recipient.role === "team_owner";
      const mergeData = buildMergeData({
        recipient,
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
        templateInternalKey: isOwner ? OWNER_TEMPLATE_KEY : PLAYER_TEMPLATE_KEY,
        tournamentId,
        triggeredByEvent: isOwner ? OWNER_EVENT_TYPE : PLAYER_EVENT_TYPE,
        entityType: recipient.entityType,
        entityId: recipient.entityId,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientRole: recipient.role,
        mergeData,
        idempotencyKey: buildIdempotencyKey(matchId, recipient.role, recipient.email),
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
            template: isOwner ? OWNER_TEMPLATE_KEY : PLAYER_TEMPLATE_KEY,
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
  templateKey: PLAYER_TEMPLATE_KEY,
  eventType: PLAYER_EVENT_TYPE,
};

export const BADMINTON_MATCH_WIN_OWNER_TEMPLATE = {
  subject: BADMINTON_MATCH_WIN_OWNER_SUBJECT,
  html: BADMINTON_MATCH_WIN_OWNER_HTML,
  templateKey: OWNER_TEMPLATE_KEY,
  eventType: OWNER_EVENT_TYPE,
};
