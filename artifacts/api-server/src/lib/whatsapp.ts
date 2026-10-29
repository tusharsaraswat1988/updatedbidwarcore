import { dispatchPushWhatsApp } from "./communication/policy-engine";
import type { SendResult } from "./comm-sender";
import { getPublicOrigin } from "./runtime-env";
import { logger, maskPhoneNumber } from "./logger";
import { db, commLogsTable } from "@workspace/db";

export const META_AUCTION_PLAYER_SOLD_TEMPLATE = "auction_player_sold";
export const META_AUCTION_PLAYER_SOLD_LANGUAGE = "en";
export const META_AUCTION_PLAYER_SOLD_CATEGORY = "utility";

export const META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE = "organiser_onboarding_welcome";
export const META_ORGANISER_ONBOARDING_WELCOME_LANGUAGE = "en";
export const META_ORGANISER_ONBOARDING_WELCOME_CATEGORY = "marketing";

import {
  resolvePlayerSoldImageUrl,
  isValidHttpUrl,
} from "./communication/template-registry";
import { generateAndHostPlayerSoldPoster } from "./poster/player-sold-poster-service.js";
export { resolvePlayerSoldImageUrl, isValidHttpUrl, generateAndHostPlayerSoldPoster };

// In-memory idempotency cache (10-minute TTL) to prevent duplicate event dispatches from retries
const recentPlayerSoldIdempotency = new Map<string, number>();
const recentOrganiserWelcomeIdempotency = new Map<string, number>();

export function clearPlayerSoldIdempotencyCache(): void {
  recentPlayerSoldIdempotency.clear();
}

export function clearOrganiserWelcomeIdempotencyCache(): void {
  recentOrganiserWelcomeIdempotency.clear();
}

export function buildPlayerSoldIdempotencyKey(opts: {
  tournamentId: number;
  playerId?: number | null;
  playerName: string;
  teamName: string;
  amount: number;
  mobile?: string | null;
}): string {
  const normMobile = (opts.mobile ?? "").replace(/\D/g, "");
  return `player_sold:${opts.tournamentId}:${opts.playerId ?? opts.playerName}:${opts.amount}:${opts.teamName}:${normMobile}`;
}

export async function notifyPlayerSold(opts: {
  mobile: string | null;
  tournamentId: number;
  playerId?: number | null;
  playerName: string;
  playerPhotoUrl?: string | null;
  playerRole?: string | null;
  teamId?: number | null;
  teamName: string;
  teamLogoUrl?: string | null;
  teamShortCode?: string | null;
  teamColor?: string | null;
  amount: number;
  tournamentName: string;
  tournamentSport?: string | null;
  auctionUnit?: "rupee" | "points" | null;
  whatsappConsent?: boolean | null;
  headerImageUrl?: string | null;
  idempotencyKey?: string | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile || !opts.mobile.trim()) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }

  // Authoritative sanitization & validation of template variables
  const playerName = opts.playerName?.trim() || "Player";
  const teamName = opts.teamName?.trim() || "Team";
  const tournamentName = opts.tournamentName?.trim() || "the tournament";
  const rawAmount = typeof opts.amount === "number" && !isNaN(opts.amount) ? Math.max(0, opts.amount) : 0;
  const formattedAmount = `₹${Math.round(rawAmount).toLocaleString("en-IN")}`;

  // Idempotency / Duplicate-Event Suppression Check (checked before heavy poster generation)
  const idempotencyKey =
    opts.idempotencyKey ||
    buildPlayerSoldIdempotencyKey({
      tournamentId: opts.tournamentId,
      playerId: opts.playerId,
      playerName,
      teamName,
      amount: rawAmount,
      mobile: opts.mobile,
    });

  const lastSent = recentPlayerSoldIdempotency.get(idempotencyKey);
  if (lastSent && Date.now() - lastSent < 600_000) {
    logger.info(
      {
        idempotencyKey,
        tournamentId: opts.tournamentId,
        to: maskPhoneNumber(opts.mobile),
      },
      "notifyPlayerSold: Duplicate player sold event suppressed by idempotency guard",
    );
    return {
      success: true,
      blocked: true,
      stub: true,
      messageSid: "suppressed_duplicate_idempotency",
      error: "Duplicate player sold notification suppressed",
    };
  }

  // Dynamic Poster Image Header URL Resolution & Safety Validation
  let imageUrl: string | null = null;
  if (opts.headerImageUrl) {
    imageUrl = resolvePlayerSoldImageUrl(opts.headerImageUrl);
  } else {
    try {
      const posterResult = await generateAndHostPlayerSoldPoster({
        tournamentId: opts.tournamentId,
        playerId: opts.playerId,
        playerName,
        playerPhotoUrl: opts.playerPhotoUrl,
        playerRole: opts.playerRole,
        teamId: opts.teamId,
        teamName,
        teamLogoUrl: opts.teamLogoUrl,
        teamShortCode: opts.teamShortCode,
        teamColor: opts.teamColor,
        amount: rawAmount,
        auctionUnit: opts.auctionUnit ?? "rupee",
        tournamentName,
        tournamentSport: opts.tournamentSport ?? "Cricket",
      });
      imageUrl = posterResult.publicUrl;
    } catch (posterErr) {
      logger.error(
        { err: posterErr, tournamentId: opts.tournamentId, playerName },
        "notifyPlayerSold: Failed to generate personalized player sold poster",
      );
      imageUrl = null;
    }
  }

  // Meta-approved exact template body copy (source of truth from Meta WhatsApp Manager)
  const msg =
    `🏏 PLAYER SOLD!\n\n` +
    `Congratulations, ${playerName}! 🎉\n\n` +
    `You have been sold to *${teamName}* for *${formattedAmount}* in the *${tournamentName}* auction.\n\n` +
    `Wishing you and your team great success in the tournament!\n\n` +
    `BIDWAR | From Auction to Champions`;

  if (!imageUrl || !isValidHttpUrl(imageUrl)) {
    logger.warn(
      {
        tournamentId: opts.tournamentId,
        playerName,
        imageUrl,
      },
      "notifyPlayerSold: Missing or invalid header image URL for WhatsApp template auction_player_sold",
    );
    try {
      if (typeof db?.insert === "function") {
        await db.insert(commLogsTable).values({
          tournamentId: opts.tournamentId,
          recipientType: "player",
          recipientId: opts.playerId ?? null,
          recipientMobile: opts.mobile,
          channel: "whatsapp",
          templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
          messageContent: msg,
          sentByAdminId: null,
          blastId: idempotencyKey,
          deliveryStatus: "failed",
          metaMessageId: null,
          errorMessage: "Missing or invalid header image URL for WhatsApp template auction_player_sold",
        });
      }
    } catch {
      // Non-fatal
    }
    return {
      success: false,
      blocked: true,
      error: "Missing or invalid header image URL for WhatsApp template auction_player_sold",
    };
  }

  // Meta Cloud API template components matching approved template specification
  const templateComponents = [
    {
      type: "header" as const,
      parameters: [
        {
          type: "image" as const,
          image: {
            link: imageUrl,
          },
        },
      ],
    },
    {
      type: "body" as const,
      parameters: [
        { type: "text" as const, text: playerName },
        { type: "text" as const, text: teamName },
        { type: "text" as const, text: formattedAmount },
        { type: "text" as const, text: tournamentName },
      ],
    },
  ];

  try {
    const result = await dispatchPushWhatsApp({
      event: "player_sold",
      tournamentId: opts.tournamentId,
      mobile: opts.mobile,
      body: msg,
      recipientConsent: opts.whatsappConsent,
      templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
      templateLanguage: META_AUCTION_PLAYER_SOLD_LANGUAGE,
      templateComponents,
    });

    if (result.success) {
      recentPlayerSoldIdempotency.set(idempotencyKey, Date.now());
    }

    // Best-effort audit logging into commLogsTable for both successful and blocked/failed outcomes
    try {
      if (typeof db?.insert === "function") {
        await db.insert(commLogsTable).values({
          tournamentId: opts.tournamentId,
          recipientType: "player",
          recipientId: opts.playerId ?? null,
          recipientMobile: opts.mobile,
          channel: "whatsapp",
          templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
          messageContent: msg,
          sentByAdminId: null, // Automated auction event
          blastId: idempotencyKey,
          deliveryStatus: result.success ? "sent" : "failed",
          metaMessageId: result.messageSid ?? null,
          errorMessage: result.success ? null : (result.error ?? "Dispatch blocked by policy"),
        });
      }
    } catch (logErr) {
      logger.warn(
        { err: logErr, tournamentId: opts.tournamentId },
        "notifyPlayerSold: Failed to write audit record to commLogsTable (non-fatal)",
      );
    }

    return result;
  } catch (err: any) {
    logger.error(
      { err, tournamentId: opts.tournamentId, playerId: opts.playerId, to: maskPhoneNumber(opts.mobile) },
      "notifyPlayerSold: Unexpected failure in WhatsApp dispatch",
    );
    try {
      if (typeof db?.insert === "function") {
        await db.insert(commLogsTable).values({
          tournamentId: opts.tournamentId,
          recipientType: "player",
          recipientId: opts.playerId ?? null,
          recipientMobile: opts.mobile,
          channel: "whatsapp",
          templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
          messageContent: msg,
          sentByAdminId: null,
          blastId: idempotencyKey,
          deliveryStatus: "failed",
          metaMessageId: null,
          errorMessage: err?.message ?? "Unexpected failure in WhatsApp dispatch",
        });
      }
    } catch {
      // Non-fatal
    }
    return {
      success: false,
      error: err?.message ?? "Failed to send WhatsApp player sold notification",
    };
  }
}

export async function notifyPlayerUnsold(opts: {
  mobile: string | null;
  tournamentId: number;
  playerId?: number | null;
  playerName: string;
  tournamentName: string;
  whatsappConsent?: boolean | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou went *UNSOLD* in today's auction for *${opts.tournamentName}*.\n\nDon't worry — there may be another round. Stay ready!`;
  const result = await dispatchPushWhatsApp({
    event: "player_unsold",
    tournamentId: opts.tournamentId,
    mobile: opts.mobile,
    body: msg,
    recipientConsent: opts.whatsappConsent,
  });

  try {
    if (typeof db?.insert === "function") {
      await db.insert(commLogsTable).values({
        tournamentId: opts.tournamentId,
        recipientType: "player",
        recipientId: opts.playerId ?? null,
        recipientMobile: opts.mobile,
        channel: "whatsapp",
        templateName: "player_unsold",
        messageContent: msg,
        sentByAdminId: null,
        deliveryStatus: result.success ? "sent" : "failed",
        metaMessageId: result.messageSid ?? null,
        errorMessage: result.success ? null : (result.error ?? "Dispatch blocked by policy"),
      });
    }
  } catch {
    // Non-fatal
  }

  return result;
}

export async function notifyPlayerReAuction(opts: {
  mobile: string | null;
  tournamentId: number;
  playerId?: number | null;
  playerName: string;
  tournamentName: string;
  whatsappConsent?: boolean | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou have been returned to the *auction pool* for *${opts.tournamentName}* and will be *RE-AUCTIONED*.\n\nStay tuned!`;
  const result = await dispatchPushWhatsApp({
    event: "player_reauction",
    tournamentId: opts.tournamentId,
    mobile: opts.mobile,
    body: msg,
    recipientConsent: opts.whatsappConsent,
  });

  try {
    if (typeof db?.insert === "function") {
      await db.insert(commLogsTable).values({
        tournamentId: opts.tournamentId,
        recipientType: "player",
        recipientId: opts.playerId ?? null,
        recipientMobile: opts.mobile,
        channel: "whatsapp",
        templateName: "player_reauction",
        messageContent: msg,
        sentByAdminId: null,
        deliveryStatus: result.success ? "sent" : "failed",
        metaMessageId: result.messageSid ?? null,
        errorMessage: result.success ? null : (result.error ?? "Dispatch blocked by policy"),
      });
    }
  } catch {
    // Non-fatal
  }

  return result;
}

export async function notifyOrganiserOnboardingWelcome(opts: {
  mobile: string | null;
  organizerId?: number | null;
  name: string;
  whatsappConsent?: boolean | null;
  idempotencyKey?: string | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile || !opts.mobile.trim()) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }

  const name = opts.name?.trim() || "Organiser";
  const normMobile = opts.mobile.replace(/\D/g, "");
  const idempotencyKey = opts.idempotencyKey || `org_welcome:${opts.organizerId ?? name}:${normMobile}`;

  const lastSent = recentOrganiserWelcomeIdempotency.get(idempotencyKey);
  if (lastSent && Date.now() - lastSent < 600_000) {
    logger.info(
      { idempotencyKey, organizerId: opts.organizerId, to: maskPhoneNumber(opts.mobile) },
      "notifyOrganiserOnboardingWelcome: Duplicate welcome suppressed by idempotency guard",
    );
    return {
      success: true,
      blocked: true,
      stub: true,
      messageSid: "suppressed_duplicate_idempotency",
      error: "Duplicate organiser welcome notification suppressed",
    };
  }

  // Meta-approved exact template body copy
  const msg =
    `🏏 Welcome to BIDWAR, ${name}!\n\n` +
    `Thank you for joining BIDWAR as a Tournament Organiser.\n\n` +
    `BIDWAR helps you manage your tournament activities, including team registration, fixtures, live scoring and player auctions — all in one place.\n\n` +
    `We're excited to be part of your sporting journey!\n\n` +
    `Need help getting started? Our team is here to assist you.\n\n` +
    `BIDWAR | From Auction to Champions`;

  // Meta Cloud API template components matching approved template specification ({{1}} = Organiser Name)
  const templateComponents = [
    {
      type: "body" as const,
      parameters: [
        { type: "text" as const, text: name },
      ],
    },
  ];

  try {
    const result = await dispatchPushWhatsApp({
      event: "organiser_onboarding_welcome",
      tournamentId: null,
      mobile: opts.mobile,
      body: msg,
      recipientConsent: opts.whatsappConsent,
      templateName: META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE,
      templateLanguage: META_ORGANISER_ONBOARDING_WELCOME_LANGUAGE,
      templateComponents,
    });

    if (result.success) {
      recentOrganiserWelcomeIdempotency.set(idempotencyKey, Date.now());
    }

    try {
      if (typeof db?.insert === "function") {
        await db.insert(commLogsTable).values({
          tournamentId: null,
          recipientType: "organizer",
          recipientId: opts.organizerId ?? null,
          recipientMobile: opts.mobile,
          channel: "whatsapp",
          templateName: META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE,
          messageContent: msg,
          sentByAdminId: null,
          blastId: idempotencyKey,
          deliveryStatus: result.success ? "sent" : "failed",
          metaMessageId: result.messageSid ?? null,
          errorMessage: result.success ? null : (result.error ?? "Dispatch blocked by policy"),
        });
      }
    } catch (logErr) {
      logger.warn(
        { err: logErr, organizerId: opts.organizerId },
        "notifyOrganiserOnboardingWelcome: Failed to write audit record to commLogsTable (non-fatal)",
      );
    }

    return result;
  } catch (err: any) {
    logger.error(
      { err, organizerId: opts.organizerId, to: maskPhoneNumber(opts.mobile) },
      "notifyOrganiserOnboardingWelcome: Unexpected failure in WhatsApp dispatch",
    );
    try {
      if (typeof db?.insert === "function") {
        await db.insert(commLogsTable).values({
          tournamentId: null,
          recipientType: "organizer",
          recipientId: opts.organizerId ?? null,
          recipientMobile: opts.mobile,
          channel: "whatsapp",
          templateName: META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE,
          messageContent: msg,
          sentByAdminId: null,
          blastId: idempotencyKey,
          deliveryStatus: "failed",
          metaMessageId: null,
          errorMessage: err?.message ?? "Unexpected failure in WhatsApp dispatch",
        });
      }
    } catch {
      // Non-fatal
    }
    return {
      success: false,
      error: err?.message ?? "Failed to send WhatsApp organiser onboarding welcome",
    };
  }
}
