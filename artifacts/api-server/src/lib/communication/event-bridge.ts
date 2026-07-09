import { randomUUID } from "crypto";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import {
  db,
  brandingSettingsTable,
  organizersTable,
  playersTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { brandingService } from "../branding-service.js";
import { buildPublicUrl, getPublicOrigin } from "../runtime-env.js";
import type {
  NotificationEventType,
  NotificationPayloadMap,
} from "../notifications/types.js";
import { logger } from "../logger.js";
import { createCommunicationJob } from "./job-service.js";
import { buildPlayerRegistrationMergeData } from "./player-registration-merge-data.js";
import { getTemplateByEventType } from "./template-service.js";

/** Maps business events to communication template internal keys. */
const EVENT_TEMPLATE_MAP: Record<string, string> = {
  ORGANISER_REGISTERED: "welcome_organiser",
  TOURNAMENT_CREATED: "tournament_created",
  PLAYER_REGISTERED: "player_registration",
  TEAM_OWNER_REGISTERED: "welcome_team_owner",
  OWNER_CREDENTIALS_SENT: "team_credentials",
  PLAYER_SOLD: "player_sold",
  PLAYER_UNSOLD: "player_unsold",
  AUCTION_REMINDER: "auction_reminder",
  AUCTION_STARTED: "auction_starting",
  PAYMENT_REMINDER: "payment_reminder",
  TOURNAMENT_SCHEDULE: "tournament_schedule",
  WINNER_CONGRATULATIONS: "winner_congratulations",
  THANK_YOU: "thank_you",
  REMINDER: "reminder",
};

const EVENT_ENTITY_MAP: Record<string, { type: string; idKey: string; role: string }> = {
  ORGANISER_REGISTERED: { type: "organizer", idKey: "organizerId", role: "organiser" },
  TOURNAMENT_CREATED: { type: "organizer", idKey: "organizerId", role: "organiser" },
  PLAYER_REGISTERED: { type: "player", idKey: "playerId", role: "player" },
  TEAM_OWNER_REGISTERED: { type: "team", idKey: "teamId", role: "team_owner" },
};

function getAppUrl(): string {
  return process.env.APP_URL?.trim() || getPublicOrigin();
}

function buildIdempotencyKey(eventType: string, entityType: string, entityId: number | string): string {
  return `${eventType}:${entityType}:${entityId}:email`;
}

async function enrichPayload<E extends NotificationEventType>(
  eventType: E,
  payload: NotificationPayloadMap[E],
): Promise<NotificationPayloadMap[E]> {
  if (eventType === "TOURNAMENT_CREATED") {
    const p = payload as NotificationPayloadMap["TOURNAMENT_CREATED"];
    if (p.organizerEmail || !p.organizerId) return payload;
    const [organizer] = await db
      .select()
      .from(organizersTable)
      .where(eq(organizersTable.id, p.organizerId))
      .limit(1);
    if (!organizer) return payload;
    return {
      ...p,
      organizerName: p.organizerName ?? organizer.name,
      organizerEmail: p.organizerEmail ?? organizer.email,
      organizerMobile: p.organizerMobile ?? organizer.mobile,
    } as NotificationPayloadMap[E];
  }

  if (eventType === "PLAYER_REGISTERED" || eventType === "TEAM_OWNER_REGISTERED") {
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
    } as NotificationPayloadMap[E];
  }

  return payload;
}

function resolveJobFromPayload<E extends NotificationEventType>(
  eventType: E,
  payload: NotificationPayloadMap[E],
): {
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  tournamentId: number | null;
  entityType: string | null;
  entityId: number | null;
  recipientRole: string;
  mergeData: Record<string, unknown>;
} | null {
  const appUrl = getAppUrl();
  const entityMeta = EVENT_ENTITY_MAP[eventType];

  if (eventType === "ORGANISER_REGISTERED") {
    const p = payload as NotificationPayloadMap["ORGANISER_REGISTERED"];
    return {
      recipientName: p.name,
      recipientEmail: p.email,
      recipientPhone: p.mobile,
      tournamentId: null,
      entityType: "organizer",
      entityId: p.organizerId,
      recipientRole: "organiser",
      mergeData: {
        organiser_name: p.name,
        owner_name: p.name,
        email: p.email,
        phone: p.mobile,
        login_link: appUrl,
        app_url: appUrl,
      },
    };
  }

  if (eventType === "TOURNAMENT_CREATED") {
    const p = payload as NotificationPayloadMap["TOURNAMENT_CREATED"];
    return {
      recipientName: p.organizerName,
      recipientEmail: p.organizerEmail,
      recipientPhone: p.organizerMobile,
      tournamentId: p.tournamentId,
      entityType: p.organizerId ? "organizer" : null,
      entityId: p.organizerId,
      recipientRole: "organiser",
      mergeData: {
        tournament_name: p.tournamentName,
        auction_name: p.tournamentName,
        auction_date: p.auctionDate,
        organiser_name: p.organizerName,
        email: p.organizerEmail,
        phone: p.organizerMobile,
        login_link: appUrl,
        app_url: appUrl,
      },
    };
  }

  if (eventType === "PLAYER_REGISTERED") {
    const p = payload as NotificationPayloadMap["PLAYER_REGISTERED"];
    return {
      recipientName: p.playerName,
      recipientEmail: p.email,
      recipientPhone: null,
      tournamentId: p.tournamentId,
      entityType: "player",
      entityId: p.playerId,
      recipientRole: "player",
      mergeData: {
        player_name: p.playerName,
        tournament_name: p.tournamentName,
        email: p.email,
        payment_link: p.paymentPending ? `${appUrl}/player/pay` : "",
        login_link: appUrl,
        app_url: appUrl,
        brand_name: p.brandName,
        powered_by_text: p.poweredByText,
      },
    };
  }

  if (eventType === "TEAM_OWNER_REGISTERED") {
    const p = payload as NotificationPayloadMap["TEAM_OWNER_REGISTERED"];
    const ownerJoinUrl = buildPublicUrl(ownerJoinPath(p.tournamentId, p.teamId));
    return {
      recipientName: p.ownerName,
      recipientEmail: p.email,
      recipientPhone: null,
      tournamentId: p.tournamentId,
      entityType: "team",
      entityId: p.teamId,
      recipientRole: "team_owner",
      mergeData: {
        owner_name: p.ownerName,
        team_name: p.teamName,
        tournament_name: p.tournamentName,
        email: p.email,
        login_link: ownerJoinUrl,
        app_url: appUrl,
        brand_name: p.brandName,
        powered_by_text: p.poweredByText,
      },
    };
  }

  if (entityMeta) {
    const entityId = (payload as Record<string, unknown>)[entityMeta.idKey] as number | undefined;
    return {
      recipientName: null,
      recipientEmail: null,
      recipientPhone: null,
      tournamentId: (payload as Record<string, unknown>).tournamentId as number | null ?? null,
      entityType: entityMeta.type,
      entityId: entityId ?? null,
      recipientRole: entityMeta.role,
      mergeData: { ...(payload as Record<string, unknown>), app_url: appUrl },
    };
  }

  return null;
}

/**
 * Create a communication job from a business event.
 * This is the ONLY path business logic should use for email communications.
 */
export async function createJobFromBusinessEvent<E extends NotificationEventType>(
  eventType: E,
  payload: NotificationPayloadMap[E],
): Promise<string | null> {
  const templateKey = EVENT_TEMPLATE_MAP[eventType];
  if (!templateKey) {
    logger.debug({ eventType }, "No communication template mapping for event");
    return null;
  }

  const template = await getTemplateByEventType(eventType);
  if (!template) {
    const { getTemplateByKey } = await import("./template-service.js");
    const byKey = await getTemplateByKey(templateKey);
    if (!byKey) {
      logger.warn({ eventType, templateKey }, "Communication template not found for event");
      return null;
    }
  }

  const resolvedPayload = await enrichPayload(eventType, payload);
  const jobData = resolveJobFromPayload(eventType, resolvedPayload);
  if (!jobData) {
    logger.warn({ eventType }, "Could not resolve job data from event payload");
    return null;
  }

  let mergeData = jobData.mergeData;
  if (eventType === "PLAYER_REGISTERED" && jobData.entityId) {
    mergeData = {
      ...mergeData,
      ...(await buildPlayerRegistrationMergeData(jobData.entityId)),
    };
  }

  const entityId = jobData.entityId ?? randomUUID();
  const idempotencyKey = buildIdempotencyKey(
    eventType,
    jobData.entityType ?? "unknown",
    entityId,
  );

  return createCommunicationJob({
    channel: "email",
    templateInternalKey: templateKey,
    tournamentId: jobData.tournamentId,
    triggeredByEvent: eventType,
    entityType: jobData.entityType,
    entityId: typeof jobData.entityId === "number" ? jobData.entityId : null,
    recipientName: jobData.recipientName,
    recipientEmail: jobData.recipientEmail,
    recipientPhone: jobData.recipientPhone,
    recipientRole: jobData.recipientRole,
    mergeData: mergeData,
    idempotencyKey,
    sentBy: "system",
  });
}

/** Fire-and-forget — never throws. */
export function enqueueCommunicationFromEvent<E extends NotificationEventType>(
  eventType: E,
  payload: NotificationPayloadMap[E],
): void {
  void createJobFromBusinessEvent(eventType, payload).catch((err) => {
    logger.error({ eventType, err }, "Failed to create communication job from event");
  });
}
