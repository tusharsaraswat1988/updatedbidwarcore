import {
  db,
  communicationJobsTable,
  communicationJobRecipientsTable,
  playersTable,
  tournamentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger.js";
import { createCommunicationJob } from "./job-service.js";
import { buildPlayerSoldMergeData } from "./player-sold-merge-data.js";
import { logCommunicationAction } from "./template-service.js";
import { renderMergeTemplate } from "./merge-variables.js";
import { getTemplateByKey } from "./template-service.js";
import { PLAYER_SOLD_SUBJECT } from "./player-sold-email-template.js";

const TEMPLATE_KEY = "player_sold";
const EVENT_TYPE = "PLAYER_SOLD";

function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.startsWith("eml:") || trimmed.startsWith("gid_")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function classifyEmail(email: string | null | undefined): "valid" | "missing" | "invalid" {
  if (!email || !email.trim()) return "missing";
  return isValidEmail(email) ? "valid" : "invalid";
}

function buildIdempotencyKey(playerId: number, teamId: number, amount: number): string {
  return `${EVENT_TYPE}:player:${playerId}:team:${teamId}:amount:${amount}:email`;
}

async function createFailedPlayerSoldEmailJob(params: {
  tournamentId: number;
  playerId: number;
  playerName: string | null;
  recipientEmail: string | null;
  errorMessage: string;
  idempotencyKey: string;
}): Promise<void> {
  const template = await getTemplateByKey(TEMPLATE_KEY);

  try {
    const [job] = await db
      .insert(communicationJobsTable)
      .values({
        channel: "email",
        templateId: template?.id ?? null,
        templateInternalKey: TEMPLATE_KEY,
        tournamentId: params.tournamentId,
        triggeredByEvent: EVENT_TYPE,
        entityType: "player",
        entityId: params.playerId,
        status: "failed",
        pendingReason: null,
        subject: template
          ? renderMergeTemplate(template.subject, {
              player_name: params.playerName ?? "Player",
              team_name: "",
            })
          : PLAYER_SOLD_SUBJECT,
        htmlBody: null,
        mergeData: {},
        idempotencyKey: params.idempotencyKey,
        sentBy: "system",
        errorMessage: params.errorMessage,
      })
      .returning({ id: communicationJobsTable.id });

    if (!job) return;

    await db.insert(communicationJobRecipientsTable).values({
      jobId: job.id,
      recipientName: params.playerName,
      recipientEmail: params.recipientEmail,
      recipientPhone: null,
      recipientRole: "player",
      isPrimary: true,
    });

    await logCommunicationAction({
      jobId: job.id,
      templateId: template?.id ?? null,
      action: "created",
      newStatus: "failed",
      recipientName: params.playerName,
      recipientEmail: params.recipientEmail,
      createdBy: "system",
      triggeredBy: EVENT_TYPE,
      metadata: { reason: params.errorMessage },
    });

    logger.info(
      {
        jobId: job.id,
        playerId: params.playerId,
        reason: params.errorMessage,
      },
      "Player sold email: logged as failed",
    );
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      logger.debug({ idempotencyKey: params.idempotencyKey }, "Player sold email failure log skipped — duplicate");
      return;
    }
    logger.error({ err, playerId: params.playerId }, "Failed to create player sold email failure log");
  }
}

/**
 * Enqueue premium player-sold email when all business conditions are met.
 * Never throws — auction flow must continue normally.
 */
export async function enqueuePlayerSoldEmail(params: {
  playerId: number;
  teamId: number;
  amount: number;
  tournamentId: number;
}): Promise<void> {
  const { playerId, teamId, amount, tournamentId } = params;
  const idempotencyKey = buildIdempotencyKey(playerId, teamId, amount);

  try {
    const [tournament] = await db
      .select({
        licenseStatus: tournamentsTable.licenseStatus,
        status: tournamentsTable.status,
        adminLocked: tournamentsTable.adminLocked,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);

    if (
      !tournament ||
      tournament.licenseStatus !== "active" ||
      tournament.status !== "active" ||
      tournament.adminLocked
    ) {
      logger.debug(
        {
          tournamentId,
          licenseStatus: tournament?.licenseStatus,
          status: tournament?.status,
          adminLocked: tournament?.adminLocked,
        },
        "Player sold email: skipped (tournament not eligible)",
      );
      return;
    }

    const [player] = await db
      .select({
        name: playersTable.name,
        email: playersTable.email,
      })
      .from(playersTable)
      .where(eq(playersTable.id, playerId))
      .limit(1);

    if (!player) {
      logger.warn({ playerId }, "Player sold email: player not found");
      return;
    }

    const emailState = classifyEmail(player.email);
    if (emailState === "missing") {
      await createFailedPlayerSoldEmailJob({
        tournamentId,
        playerId,
        playerName: player.name,
        recipientEmail: null,
        errorMessage: "Player email not available.",
        idempotencyKey,
      });
      return;
    }

    if (emailState === "invalid") {
      await createFailedPlayerSoldEmailJob({
        tournamentId,
        playerId,
        playerName: player.name,
        recipientEmail: player.email,
        errorMessage: "Invalid email address.",
        idempotencyKey,
      });
      return;
    }

    const mergeData = await buildPlayerSoldMergeData({
      playerId,
      teamId,
      amount,
      tournamentId,
    });

    await createCommunicationJob({
      channel: "email",
      templateInternalKey: TEMPLATE_KEY,
      tournamentId,
      triggeredByEvent: EVENT_TYPE,
      entityType: "player",
      entityId: playerId,
      recipientName: player.name,
      recipientEmail: player.email!.trim().toLowerCase(),
      recipientRole: "player",
      mergeData,
      idempotencyKey,
      sentBy: "system",
    });

    logger.info({ playerId, teamId, tournamentId }, "Player sold email: job created");
  } catch (err) {
    logger.error({ err, playerId, teamId, tournamentId }, "Player sold email: unexpected error");
  }
}

/** Fire-and-forget wrapper — never throws. */
export function enqueuePlayerSoldEmailAsync(params: {
  playerId: number;
  teamId: number;
  amount: number;
  tournamentId: number;
}): void {
  void enqueuePlayerSoldEmail(params);
}
