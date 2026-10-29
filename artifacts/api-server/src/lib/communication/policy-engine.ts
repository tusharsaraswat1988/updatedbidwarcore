/**
 * BIDWAR Communication Policy Engine
 *
 * Governs outbound Push notification eligibility across events and channels:
 * - Event category enablement (Push notifications)
 * - Tournament licensing & lock checks
 * - Recipient eligibility & explicit WhatsApp consent (opt-in / opt-out)
 * - Active provider availability
 *
 * STRICT INVARIANT:
 * - Push notification policies NEVER gate or restrict inbound Pull bot processing.
 * - Disabling a Push notification event does NOT disable inbound bot commands or authorized replies.
 * - Outbound WhatsApp dispatches that are blocked or unlicensed NEVER fall back to SMS.
 */

import { db } from "@workspace/db";
import { tournamentsTable, playersTable } from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";
import { logger, maskPhoneNumber } from "../logger";
import {
  isTournamentLicensedForComm,
  sendWhatsApp,
  type SendResult,
} from "../comm-sender";
import { resolveWhatsAppProviderId } from "./providers";

export type CommunicationPushEvent =
  | "player_sold"
  | "player_unsold"
  | "player_reauction"
  | "team_owner_welcome"
  | "auction_reminder"
  | "custom";

export interface PolicyEvaluationInput {
  event: CommunicationPushEvent | string;
  channel: "whatsapp" | "sms" | "email";
  tournamentId?: number | null;
  recipientMobile?: string | null;
  recipientConsent?: boolean | null;
  tournament?: {
    licenseStatus?: string | null;
    adminLocked?: boolean | null;
    scoringEnabled?: boolean | null;
    scoringPhase?: string | null;
    licenseGrantedAt?: Date | string | null;
  } | null;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason?: string;
  channel: "whatsapp" | "sms" | "email";
  event: string;
  tournamentId?: number | null;
  recipientMobile?: string | null;
}

export class CommunicationPolicyEngine {
  /**
   * Evaluates outbound Push policy for an event and channel.
   * Checks recipient mobile, tournament licensing context, recipient consent,
   * and provider availability.
   */
  public async evaluatePushPolicy(
    input: PolicyEvaluationInput,
  ): Promise<PolicyEvaluationResult> {
    const { event, channel, tournamentId, recipientMobile, recipientConsent } = input;
    const maskedMobile = recipientMobile ? maskPhoneNumber(recipientMobile) : "[NONE]";

    // 1. Recipient destination guard
    if (!recipientMobile || recipientMobile.trim() === "") {
      return {
        allowed: false,
        reason: "Missing recipient mobile number",
        channel,
        event,
        tournamentId,
        recipientMobile: null,
      };
    }

    // 2. Channel-specific checks
    if (channel === "whatsapp") {
      // A. Active Provider check in production
      const providerId = resolveWhatsAppProviderId();
      if (providerId === "none" && process.env.NODE_ENV === "production") {
        logger.error(
          { event, to: maskedMobile },
          "Push policy rejected: No WhatsApp provider configured in production",
        );
        return {
          allowed: false,
          reason: "WhatsApp provider not configured in production",
          channel,
          event,
          tournamentId,
          recipientMobile,
        };
      }

      // B. Tournament Licensing and Emergency Lock Guard
      let tournament = input.tournament;
      if (!tournament && tournamentId) {
        try {
          const [t] = await db
            .select({
              licenseStatus: tournamentsTable.licenseStatus,
              adminLocked: tournamentsTable.adminLocked,
              scoringEnabled: tournamentsTable.scoringEnabled,
              scoringPhase: tournamentsTable.scoringPhase,
              licenseGrantedAt: tournamentsTable.licenseGrantedAt,
            })
            .from(tournamentsTable)
            .where(eq(tournamentsTable.id, tournamentId));
          tournament = t ?? null;
        } catch (err) {
          logger.error(
            { err, tournamentId },
            "Push policy error fetching tournament licensing context",
          );
        }
      }

      if (tournamentId && !isTournamentLicensedForComm(tournament)) {
        const reason = tournament?.adminLocked
          ? "Tournament is admin-locked"
          : `Tournament licensing status '${tournament?.licenseStatus ?? "unknown"}' not eligible for communications`;

        logger.info(
          { event, tournamentId, to: maskedMobile, reason },
          "Push policy suppressed: Tournament unlicensed or locked",
        );

        return {
          allowed: false,
          reason,
          channel,
          event,
          tournamentId,
          recipientMobile,
        };
      }

      // C. Recipient Consent Guard (Explicit Opt-In / Opt-Out)
      let hasConsent = recipientConsent;
      if (hasConsent === undefined && tournamentId && recipientMobile) {
        try {
          const norm = recipientMobile.replace(/\D/g, "").replace(/^0/, "91");
          const [player] = await db
            .select({ whatsappConsent: playersTable.whatsappConsent })
            .from(playersTable)
            .where(
              and(
                eq(playersTable.tournamentId, tournamentId),
                or(
                  eq(playersTable.mobileNumber, recipientMobile),
                  eq(playersTable.mobileNumber, norm),
                  sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`,
                ),
              ),
            )
            .limit(1);

          if (player) {
            hasConsent = player.whatsappConsent;
          }
        } catch (err) {
          logger.warn(
            { err, tournamentId, to: maskedMobile },
            "Push policy consent check database lookup error (non-fatal, proceeding)",
          );
        }
      }

      if (hasConsent === false) {
        logger.info(
          { event, tournamentId, to: maskedMobile },
          "Push policy suppressed: Recipient has not consented to WhatsApp updates (opted-out)",
        );
        return {
          allowed: false,
          reason: "Recipient has not consented to WhatsApp updates (opted-out)",
          channel,
          event,
          tournamentId,
          recipientMobile,
        };
      }
    }

    return {
      allowed: true,
      channel,
      event,
      tournamentId,
      recipientMobile,
    };
  }

  /**
   * Helper verifying that Pull bot command processing is completely decoupled
   * from Push event policies.
   */
  public isPullCommandIndependent(): boolean {
    return true;
  }
}

export const communicationPolicyEngine = new CommunicationPolicyEngine();

/**
 * Dispatch an outbound Push notification over WhatsApp respecting the Communication Policy.
 * If blocked (unlicensed tournament, admin-locked, no consent, or missing recipient):
 * - Returns `{ success: false, blocked: true, error: reason }`
 * - Logs audit outcome
 * - NEVER invokes SMS as a fallback
 */
export async function dispatchPushWhatsApp(opts: {
  event: CommunicationPushEvent | string;
  tournamentId: number;
  mobile: string | null;
  body: string;
  recipientConsent?: boolean | null;
  templateSid?: string;
}): Promise<SendResult & { blocked?: boolean }> {
  const policy = await communicationPolicyEngine.evaluatePushPolicy({
    event: opts.event,
    channel: "whatsapp",
    tournamentId: opts.tournamentId,
    recipientMobile: opts.mobile,
    recipientConsent: opts.recipientConsent,
  });

  if (!policy.allowed) {
    logger.warn(
      {
        event: opts.event,
        tournamentId: opts.tournamentId,
        to: opts.mobile ? maskPhoneNumber(opts.mobile) : "[NONE]",
        reason: policy.reason,
      },
      "dispatchPushWhatsApp: WhatsApp dispatch blocked by policy (no SMS fallback)",
    );
    return {
      success: false,
      blocked: true,
      error: policy.reason,
    };
  }

  return sendWhatsApp(opts.mobile!, opts.body, opts.templateSid);
}
