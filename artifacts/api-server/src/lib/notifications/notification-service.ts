import { randomUUID } from "crypto";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import { db, notificationLogsTable, organizersTable, brandingSettingsTable } from "@workspace/db";
import { brandingService } from "../branding-service.js";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { buildPublicUrl, getPublicOrigin } from "../runtime-env";
import { sendEmail } from "./providers/email-provider";
import { sendNotificationSms } from "./providers/sms-provider";
import { sendNotificationWhatsApp } from "./providers/whatsapp-provider";
import { hasEmailTemplate, renderEmailTemplate } from "./templates/registry";
import type {
  NotificationChannel,
  NotificationEventType,
  NotificationPayloadMap,
  NotificationStatus,
  ProviderSendResult,
  SendNotificationOptions,
} from "./types";

function getAppUrl(): string {
  return process.env.APP_URL?.trim() || getPublicOrigin();
}

function isValidEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.startsWith("eml:") || trimmed.startsWith("gid_")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function isValidMobile(mobile: string | null | undefined): mobile is string {
  if (!mobile) return false;
  const trimmed = mobile.trim();
  if (!trimmed || trimmed.startsWith("eml:") || trimmed.startsWith("gid_")) return false;
  return /\d{7,}/.test(trimmed.replace(/\D/g, ""));
}

/** Channels configured per event type. Extend as new events are wired. */
const EVENT_CHANNEL_MAP: Partial<Record<NotificationEventType, NotificationChannel[]>> = {
  ORGANISER_REGISTERED: ["email"],
  TOURNAMENT_CREATED: ["email"],
  PLAYER_REGISTERED: ["email"],
  TEAM_OWNER_REGISTERED: ["email"],
};

function buildDedupKey(
  eventType: NotificationEventType,
  channel: NotificationChannel,
  entityKey: string,
): string {
  return `${eventType}:${entityKey}:${channel}`;
}

function buildEntityKey(
  eventType: NotificationEventType,
  payload: NotificationPayloadMap[NotificationEventType],
): string {
  if (eventType === "ORGANISER_REGISTERED") {
    const p = payload as NotificationPayloadMap["ORGANISER_REGISTERED"];
    return `organizer:${p.organizerId}`;
  }
  if (eventType === "TOURNAMENT_CREATED") {
    const p = payload as NotificationPayloadMap["TOURNAMENT_CREATED"];
    return `tournament:${p.tournamentId}`;
  }
  if (eventType === "PLAYER_REGISTERED") {
    const p = payload as NotificationPayloadMap["PLAYER_REGISTERED"];
    return `player:${p.playerId}`;
  }
  if (eventType === "TEAM_OWNER_REGISTERED") {
    const p = payload as NotificationPayloadMap["TEAM_OWNER_REGISTERED"];
    return `team:${p.teamId}`;
  }
  return `event:${randomUUID()}`;
}

type RecipientInfo = {
  name: string | null;
  email: string | null;
  mobile: string | null;
  tournamentId: number | null;
  organizerId: number | null;
  templateParams: Record<string, unknown>;
  smsBody?: string;
  whatsappBody?: string;
};

function resolveRecipients(
  eventType: NotificationEventType,
  payload: NotificationPayloadMap[NotificationEventType],
): RecipientInfo | null {
  const appUrl = getAppUrl();

  if (eventType === "ORGANISER_REGISTERED") {
    const p = payload as NotificationPayloadMap["ORGANISER_REGISTERED"];
    return {
      name: p.name,
      email: p.email,
      mobile: p.mobile,
      tournamentId: null,
      organizerId: p.organizerId,
      templateParams: { name: p.name, appUrl },
    };
  }

  if (eventType === "TOURNAMENT_CREATED") {
    const p = payload as NotificationPayloadMap["TOURNAMENT_CREATED"];
    return {
      name: p.organizerName,
      email: p.organizerEmail,
      mobile: p.organizerMobile,
      tournamentId: p.tournamentId,
      organizerId: p.organizerId,
      templateParams: {
        tournamentName: p.tournamentName,
        sport: p.sport,
        auctionCode: p.auctionCode,
        auctionDate: p.auctionDate,
        auctionTime: p.auctionTime,
        venue: p.venue,
        organizerName: p.organizerName,
        tournamentId: p.tournamentId,
        appUrl,
      },
    };
  }

  if (eventType === "PLAYER_REGISTERED") {
    const p = payload as NotificationPayloadMap["PLAYER_REGISTERED"];
    return {
      name: p.playerName,
      email: p.email,
      mobile: null,
      tournamentId: p.tournamentId,
      organizerId: null,
      templateParams: {
        playerName: p.playerName,
        photoUrl: p.photoUrl,
        tournamentName: p.tournamentName,
        tournamentLogoUrl: p.tournamentLogoUrl,
        paymentPending: p.paymentPending,
        appUrl,
        bidwarLogoUrl: p.bidwarLogoUrl ?? null,
        brandName: p.brandName ?? "BidWar",
        poweredByText: p.poweredByText ?? "Powered by BidWar",
      },
    };
  }

  if (eventType === "TEAM_OWNER_REGISTERED") {
    const p = payload as NotificationPayloadMap["TEAM_OWNER_REGISTERED"];
    const ownerJoinUrl = buildPublicUrl(ownerJoinPath(p.tournamentId, p.teamId));
    return {
      name: p.ownerName,
      email: p.email,
      mobile: null,
      tournamentId: p.tournamentId,
      organizerId: null,
      templateParams: {
        ownerName: p.ownerName,
        teamName: p.teamName,
        ownerPhotoUrl: p.ownerPhotoUrl,
        tournamentName: p.tournamentName,
        tournamentLogoUrl: p.tournamentLogoUrl,
        ownerJoinUrl,
        appUrl,
        bidwarLogoUrl: p.bidwarLogoUrl ?? null,
        brandName: p.brandName ?? "BidWar",
        poweredByText: p.poweredByText ?? "Powered by BidWar",
      },
    };
  }

  return null;
}

async function deliverOnChannel(
  channel: NotificationChannel,
  eventType: NotificationEventType,
  recipient: RecipientInfo,
): Promise<{ result: ProviderSendResult; subject?: string }> {
  if (channel === "email") {
    if (!isValidEmail(recipient.email)) {
      return { result: { success: false, error: "No valid recipient email" } };
    }
    if (!hasEmailTemplate(eventType)) {
      return { result: { success: false, error: `No email template for ${eventType}` } };
    }
    const rendered = renderEmailTemplate(eventType, recipient.templateParams);
    if (!rendered) {
      return { result: { success: false, error: "Email template render failed" } };
    }
    const result = await sendEmail({
      to: recipient.email,
      subject: rendered.subject,
      html: rendered.html,
    });
    return { result, subject: rendered.subject };
  }

  if (channel === "sms") {
    if (!isValidMobile(recipient.mobile) || !recipient.smsBody) {
      return { result: { success: false, error: "No valid recipient mobile or SMS body" } };
    }
    return { result: await sendNotificationSms(recipient.mobile, recipient.smsBody) };
  }

  if (channel === "whatsapp") {
    if (!isValidMobile(recipient.mobile) || !recipient.whatsappBody) {
      return { result: { success: false, error: "No valid recipient mobile or WhatsApp body" } };
    }
    return { result: await sendNotificationWhatsApp(recipient.mobile, recipient.whatsappBody) };
  }

  return { result: { success: false, error: `Unknown channel: ${channel}` } };
}

async function createLogEntry(params: {
  eventType: NotificationEventType;
  channel: NotificationChannel;
  dedupKey: string;
  recipient: RecipientInfo;
  status: NotificationStatus;
  subject?: string;
  providerResponse?: string;
  errorMessage?: string;
  sentAt?: Date;
}): Promise<number | null> {
  try {
    const [row] = await db
      .insert(notificationLogsTable)
      .values({
        eventType: params.eventType,
        channel: params.channel,
        recipientName: params.recipient.name,
        recipientEmail: params.recipient.email,
        recipientMobile: params.recipient.mobile,
        tournamentId: params.recipient.tournamentId,
        organizerId: params.recipient.organizerId,
        dedupKey: params.dedupKey,
        status: params.status,
        subject: params.subject ?? null,
        providerResponse: params.providerResponse ?? null,
        errorMessage: params.errorMessage ?? null,
        sentAt: params.sentAt ?? null,
      })
      .returning({ id: notificationLogsTable.id });
    return row?.id ?? null;
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      return null;
    }
    throw err;
  }
}

async function updateLogEntry(
  logId: number,
  updates: {
    status: NotificationStatus;
    providerResponse?: string | null;
    errorMessage?: string | null;
    subject?: string | null;
    sentAt?: Date | null;
  },
): Promise<void> {
  const setValues: Record<string, unknown> = { status: updates.status };
  if (updates.providerResponse !== undefined) setValues.providerResponse = updates.providerResponse;
  if (updates.errorMessage !== undefined) setValues.errorMessage = updates.errorMessage;
  if (updates.subject !== undefined) setValues.subject = updates.subject;
  if (updates.sentAt !== undefined) setValues.sentAt = updates.sentAt;

  await db
    .update(notificationLogsTable)
    .set(setValues)
    .where(eq(notificationLogsTable.id, logId));
}

async function sendOnChannel(
  eventType: NotificationEventType,
  channel: NotificationChannel,
  payload: NotificationPayloadMap[NotificationEventType],
  options: SendNotificationOptions = {},
): Promise<void> {
  const channels = EVENT_CHANNEL_MAP[eventType];
  if (!channels?.includes(channel)) return;

  const recipient = resolveRecipients(eventType, payload);
  if (!recipient) {
    logger.warn({ eventType }, "No recipient resolver for notification event");
    return;
  }

  const entityKey = buildEntityKey(eventType, payload);
  const dedupKey = options.skipDedup
    ? `resend:${options.resendOfLogId ?? "manual"}:${randomUUID()}`
    : buildDedupKey(eventType, channel, entityKey);

  let logId: number | null = null;

  if (!options.skipDedup) {
    logId = await createLogEntry({
      eventType,
      channel,
      dedupKey,
      recipient,
      status: "pending",
    });

    if (logId === null) {
      logger.info({ eventType, channel, dedupKey }, "Notification skipped — duplicate dedup key");
      return;
    }
  } else {
    logId = await createLogEntry({
      eventType,
      channel,
      dedupKey,
      recipient,
      status: "pending",
    });
  }

  if (!logId) return;

  try {
    const { result, subject } = await deliverOnChannel(channel, eventType, recipient);

    if (result.success) {
      await updateLogEntry(logId, {
        status: "sent",
        subject,
        providerResponse: JSON.stringify({
          messageId: result.messageId,
          stub: result.stub ?? false,
          raw: result.raw,
        }),
        sentAt: new Date(),
      });
      logger.info({ eventType, channel, logId, messageId: result.messageId }, "Notification sent");
    } else {
      await updateLogEntry(logId, {
        status: "failed",
        subject,
        errorMessage: result.error ?? "Send failed",
        providerResponse: result.raw ? JSON.stringify(result.raw) : null,
      });
      logger.warn({ eventType, channel, logId, error: result.error }, "Notification failed");
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown notification error";
    await updateLogEntry(logId, {
      status: "failed",
      errorMessage,
    }).catch(() => {});
    logger.error({ eventType, channel, logId, err }, "Notification delivery exception");
  }
}

async function enrichPlayerRegisteredPayload(
  payload: NotificationPayloadMap["PLAYER_REGISTERED"],
): Promise<NotificationPayloadMap["PLAYER_REGISTERED"]> {
  const [branding] = await db
    .select({
      brandName: brandingSettingsTable.brandName,
      poweredByText: brandingSettingsTable.poweredByText,
    })
    .from(brandingSettingsTable)
    .limit(1);

  const logoUrl = await brandingService.resolveEmailLogoAssetUrl();

  return {
    ...payload,
    bidwarLogoUrl: logoUrl,
    brandName: branding?.brandName ?? "BidWar",
    poweredByText: branding?.poweredByText ?? "Powered by BidWar",
  };
}

async function enrichTeamOwnerRegisteredPayload(
  payload: NotificationPayloadMap["TEAM_OWNER_REGISTERED"],
): Promise<NotificationPayloadMap["TEAM_OWNER_REGISTERED"]> {
  const [branding] = await db
    .select({
      brandName: brandingSettingsTable.brandName,
      poweredByText: brandingSettingsTable.poweredByText,
    })
    .from(brandingSettingsTable)
    .limit(1);

  const logoUrl = await brandingService.resolveEmailLogoAssetUrl();

  return {
    ...payload,
    bidwarLogoUrl: logoUrl,
    brandName: branding?.brandName ?? "BidWar",
    poweredByText: branding?.poweredByText ?? "Powered by BidWar",
  };
}

async function enrichTournamentCreatedPayload(
  payload: NotificationPayloadMap["TOURNAMENT_CREATED"],
): Promise<NotificationPayloadMap["TOURNAMENT_CREATED"]> {
  if (isValidEmail(payload.organizerEmail) || !payload.organizerId) {
    return payload;
  }

  const [organizer] = await db
    .select()
    .from(organizersTable)
    .where(eq(organizersTable.id, payload.organizerId))
    .limit(1);

  if (!organizer) return payload;

  return {
    ...payload,
    organizerName: payload.organizerName ?? organizer.name,
    organizerEmail: payload.organizerEmail ?? organizer.email,
    organizerMobile: payload.organizerMobile ?? organizer.mobile,
  };
}

/**
 * Dispatch a notification event on all configured channels.
 * Never throws — failures are logged and persisted.
 */
export async function dispatchNotification<E extends NotificationEventType>(
  eventType: E,
  payload: NotificationPayloadMap[E],
  options: SendNotificationOptions = {},
): Promise<void> {
  const channels = EVENT_CHANNEL_MAP[eventType];
  if (!channels?.length) {
    logger.debug({ eventType }, "No channels configured for notification event");
    return;
  }

  let resolvedPayload = payload;
  if (eventType === "TOURNAMENT_CREATED") {
    resolvedPayload = (await enrichTournamentCreatedPayload(
      payload as NotificationPayloadMap["TOURNAMENT_CREATED"],
    )) as NotificationPayloadMap[E];
  }
  if (eventType === "PLAYER_REGISTERED") {
    resolvedPayload = (await enrichPlayerRegisteredPayload(
      payload as NotificationPayloadMap["PLAYER_REGISTERED"],
    )) as NotificationPayloadMap[E];
  }
  if (eventType === "TEAM_OWNER_REGISTERED") {
    resolvedPayload = (await enrichTeamOwnerRegisteredPayload(
      payload as NotificationPayloadMap["TEAM_OWNER_REGISTERED"],
    )) as NotificationPayloadMap[E];
  }

  await Promise.all(
    channels.map((channel) =>
      sendOnChannel(eventType, channel, resolvedPayload, options).catch((err) => {
        logger.error({ eventType, channel, err }, "Unhandled notification channel error");
      }),
    ),
  );
}

/** Fire-and-forget wrapper — notification failures never break business workflows. */
export function notifyAsync<E extends NotificationEventType>(
  eventType: E,
  payload: NotificationPayloadMap[E],
): void {
  void dispatchNotification(eventType, payload).catch((err) => {
    logger.error({ eventType, err }, "Async notification dispatch failed");
  });
}

/** Resend a previously logged notification (admin action). */
export async function resendNotification(logId: number): Promise<{ success: boolean; error?: string }> {
  const [log] = await db
    .select()
    .from(notificationLogsTable)
    .where(eq(notificationLogsTable.id, logId))
    .limit(1);

  if (!log) {
    return { success: false, error: "Notification log not found" };
  }

  const eventType = log.eventType as NotificationEventType;

  if (eventType === "ORGANISER_REGISTERED" && log.organizerId) {
    await dispatchNotification(
      "ORGANISER_REGISTERED",
      {
        organizerId: log.organizerId,
        name: log.recipientName ?? "Organiser",
        email: log.recipientEmail,
        mobile: log.recipientMobile ?? "",
      },
      { skipDedup: true, resendOfLogId: logId },
    );
    return { success: true };
  }

  if (eventType === "TOURNAMENT_CREATED" && log.tournamentId) {
    const { tournamentsTable } = await import("@workspace/db");
    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, log.tournamentId))
      .limit(1);

    if (!tournament) {
      return { success: false, error: "Tournament no longer exists" };
    }

    await dispatchNotification(
      "TOURNAMENT_CREATED",
      {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        sport: tournament.sport,
        auctionCode: tournament.auctionCode,
        auctionDate: tournament.auctionDate,
        auctionTime: tournament.auctionTime,
        venue: tournament.venue,
        organizerName: log.recipientName ?? tournament.organizerName,
        organizerEmail: log.recipientEmail ?? tournament.organizerEmail,
        organizerMobile: log.recipientMobile ?? tournament.organizerMobile,
        organizerId: log.organizerId ?? tournament.organizerId,
      },
      { skipDedup: true, resendOfLogId: logId },
    );
    return { success: true };
  }

  if (eventType === "PLAYER_REGISTERED" && log.tournamentId && log.recipientEmail) {
    const { playersTable, tournamentsTable } = await import("@workspace/db");

    const playerIdFromKey = log.dedupKey?.match(/^PLAYER_REGISTERED:player:(\d+):email$/)?.[1];
    const [player] = playerIdFromKey
      ? await db
          .select()
          .from(playersTable)
          .where(eq(playersTable.id, Number(playerIdFromKey)))
          .limit(1)
      : [undefined];

    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, log.tournamentId))
      .limit(1);

    if (!tournament) {
      return { success: false, error: "Tournament no longer exists" };
    }

    await dispatchNotification(
      "PLAYER_REGISTERED",
      {
        playerId: player?.id ?? Number(playerIdFromKey ?? 0),
        playerName: log.recipientName ?? player?.name ?? "Player",
        email: log.recipientEmail,
        photoUrl: player?.photoUrl ?? null,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentLogoUrl: tournament.logoUrl,
        paymentPending: player?.registrationPaymentStatus === "pending",
      },
      { skipDedup: true, resendOfLogId: logId },
    );
    return { success: true };
  }

  if (eventType === "TEAM_OWNER_REGISTERED" && log.tournamentId && log.recipientEmail) {
    const { teamsTable, tournamentsTable } = await import("@workspace/db");

    const teamIdFromKey = log.dedupKey?.match(/^TEAM_OWNER_REGISTERED:team:(\d+):email$/)?.[1];
    const [team] = teamIdFromKey
      ? await db
          .select()
          .from(teamsTable)
          .where(eq(teamsTable.id, Number(teamIdFromKey)))
          .limit(1)
      : [undefined];

    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, log.tournamentId))
      .limit(1);

    if (!tournament) {
      return { success: false, error: "Tournament no longer exists" };
    }

    await dispatchNotification(
      "TEAM_OWNER_REGISTERED",
      {
        teamId: team?.id ?? Number(teamIdFromKey ?? 0),
        teamName: team?.name ?? "Team",
        ownerName: log.recipientName ?? team?.ownerName ?? "Team Owner",
        email: log.recipientEmail,
        ownerPhotoUrl: team?.ownerPhotoUrl ?? null,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentLogoUrl: tournament.logoUrl,
      },
      { skipDedup: true, resendOfLogId: logId },
    );
    return { success: true };
  }

  return { success: false, error: `Resend not supported for event type: ${eventType}` };
}
