import { dispatchPushWhatsApp } from "./communication/policy-engine";
import type { SendResult } from "./comm-sender";
import { getPublicOrigin } from "./runtime-env";
import { logger, maskPhoneNumber } from "./logger";
import { db, commLogsTable } from "@workspace/db";

export const META_AUCTION_PLAYER_SOLD_TEMPLATE = "auction_player_sold";
export const META_AUCTION_PLAYER_SOLD_LANGUAGE = "en";
export const META_AUCTION_PLAYER_SOLD_CATEGORY = "utility";

/**
 * Resolves the public image URL for the auction_player_sold Meta template image header.
 * Priority:
 * 1. Explicitly passed customUrl
 * 2. Environment variable WHATSAPP_PLAYER_SOLD_IMAGE_URL
 * 3. Default canonical public asset path: ${getPublicOrigin()}/assets/branding/player-sold-banner.jpg
 */
export function resolvePlayerSoldImageUrl(customUrl?: string | null): string {
  if (customUrl && typeof customUrl === "string" && customUrl.trim()) {
    return customUrl.trim();
  }
  const envUrl = process.env.WHATSAPP_PLAYER_SOLD_IMAGE_URL?.trim();
  if (envUrl) {
    return envUrl;
  }
  const appUrl = process.env.APP_URL?.trim() || process.env.PUBLIC_ORIGIN?.trim();
  if (appUrl) {
    return `${appUrl.replace(/\/+$/, "")}/assets/branding/player-sold-banner.jpg`;
  }
  try {
    const origin = getPublicOrigin();
    return `${origin}/assets/branding/player-sold-banner.jpg`;
  } catch {
    return "https://bidwar.in/assets/branding/player-sold-banner.jpg";
  }
}

function isValidHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// In-memory idempotency cache (10-minute TTL) to prevent duplicate event dispatches from retries
const recentPlayerSoldIdempotency = new Map<string, number>();

export function clearPlayerSoldIdempotencyCache(): void {
  recentPlayerSoldIdempotency.clear();
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
  teamId?: number | null;
  teamName: string;
  amount: number;
  tournamentName: string;
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
  const formattedAmount = `₹${Math.round(opts.amount).toLocaleString("en-IN")}`;

  // Image Header URL Resolution & Safety Validation
  const imageUrl = resolvePlayerSoldImageUrl(opts.headerImageUrl);
  if (!imageUrl || !isValidHttpUrl(imageUrl)) {
    logger.warn(
      {
        tournamentId: opts.tournamentId,
        playerName,
        imageUrl,
      },
      "notifyPlayerSold: Missing or invalid header image URL for WhatsApp template auction_player_sold",
    );
    return {
      success: false,
      blocked: true,
      error: "Missing or invalid header image URL for WhatsApp template auction_player_sold",
    };
  }

  // Idempotency / Duplicate-Event Suppression Check
  const idempotencyKey =
    opts.idempotencyKey ||
    buildPlayerSoldIdempotencyKey({
      tournamentId: opts.tournamentId,
      playerId: opts.playerId,
      playerName,
      teamName,
      amount: opts.amount,
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

  // Meta-approved exact template body copy (source of truth from Meta WhatsApp Manager)
  const msg =
    `🏏 PLAYER SOLD!\n\n` +
    `Congratulations, ${playerName}! 🎉\n\n` +
    `You have been sold to *${teamName}* for *${formattedAmount}* in the *${tournamentName}* auction.\n\n` +
    `Wishing you and your team great success in the tournament!\n\n` +
    `BIDWAR | From Auction to Champions`;

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

    // Best-effort audit logging into commLogsTable
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
          deliveryStatus: "sent",
          metaMessageId: result.messageSid ?? null,
          errorMessage: null,
        });
      }
    } catch (logErr) {
      logger.warn(
        { err: logErr, tournamentId: opts.tournamentId },
        "notifyPlayerSold: Failed to write audit record to commLogsTable (non-fatal)",
      );
    }
  }

  return result;
}

export async function notifyPlayerUnsold(opts: {
  mobile: string | null;
  tournamentId: number;
  playerName: string;
  tournamentName: string;
  whatsappConsent?: boolean | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou went *UNSOLD* in today's auction for *${opts.tournamentName}*.\n\nDon't worry — there may be another round. Stay ready!`;
  return dispatchPushWhatsApp({
    event: "player_unsold",
    tournamentId: opts.tournamentId,
    mobile: opts.mobile,
    body: msg,
    recipientConsent: opts.whatsappConsent,
  });
}

export async function notifyPlayerReAuction(opts: {
  mobile: string | null;
  tournamentId: number;
  playerName: string;
  tournamentName: string;
  whatsappConsent?: boolean | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou have been returned to the *auction pool* for *${opts.tournamentName}* and will be *RE-AUCTIONED*.\n\nStay tuned!`;
  return dispatchPushWhatsApp({
    event: "player_reauction",
    tournamentId: opts.tournamentId,
    mobile: opts.mobile,
    body: msg,
    recipientConsent: opts.whatsappConsent,
  });
}
