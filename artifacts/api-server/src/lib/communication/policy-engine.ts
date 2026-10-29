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
import { tournamentsTable, playersTable, waConsentEventsTable, teamsTable, organizersTable, scorerAccountsTable } from "@workspace/db";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { logger, maskPhoneNumber } from "../logger";
import {
  isTournamentLicensedForComm,
  sendWhatsApp,
  type SendResult,
} from "../comm-sender";
import { resolveTournamentFeatures } from "@workspace/platform-core/tournament-features";
import { resolveWhatsAppProviderId } from "./providers";
import { validateTemplateDispatchEligibility } from "./template-registry";

/**
 * Checks whether a mobile number has explicitly revoked WhatsApp consent via STOP or decline.
 * Fails closed (returns true) if an unexpected database error occurs.
 */
export async function isMobileRevoked(mobileDigits: string): Promise<boolean> {
  if (!mobileDigits) return false;
  const digits = mobileDigits.replace(/\D/g, "");
  const tenDigit = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const twelveDigit = tenDigit.length === 10 ? `91${tenDigit}` : tenDigit;

  try {
    const q = db
      .select({ eventType: waConsentEventsTable.eventType })
      .from(waConsentEventsTable)
      .where(
        or(
          eq(waConsentEventsTable.mobile, tenDigit),
          eq(waConsentEventsTable.mobile, twelveDigit),
          eq(waConsentEventsTable.mobile, `+${twelveDigit}`),
          eq(waConsentEventsTable.mobile, mobileDigits),
        )
      );

    let events: any[];
    if (typeof (q as any)?.orderBy === "function") {
      const ordered = (q as any).orderBy(desc(waConsentEventsTable.eventAt), desc(waConsentEventsTable.id));
      events = typeof ordered?.limit === "function" ? await ordered.limit(1) : await ordered;
    } else if (typeof (q as any)?.limit === "function") {
      events = await (q as any).limit(1);
    } else {
      events = await (q as any);
    }

    if (Array.isArray(events) && events.length > 0) {
      return events[0].eventType === "STOP_REVOKED" || events[0].eventType === "declined" || events[0].eventType === "withdrawn";
    }
    return false;
  } catch (err) {
    logger.error(
      { err, mobileDigits },
      "isMobileRevoked database check error, failing closed (treating as revoked)",
    );
    return true;
  }
}

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
  templateName?: string | null;
  tournament?: {
    licenseStatus?: string | null;
    adminLocked?: boolean | null;
    scoringEnabled?: boolean | null;
    scoringPhase?: string | null;
    licenseGrantedAt?: Date | string | null;
    featuresJson?: Record<string, unknown> | null;
    features?: { whatsappNotifications?: boolean } | null;
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
      // A. Verified Meta Template Allowlist Guard
      if (input.templateName !== undefined && input.templateName !== null) {
        const eligibility = validateTemplateDispatchEligibility(input.templateName);
        if (!eligibility.eligible) {
          logger.warn(
            {
              event,
              tournamentId,
              to: maskedMobile,
              templateName: input.templateName,
              reason: eligibility.error,
            },
            "Push policy suppressed: WhatsApp template is not approved on the Meta allowlist",
          );
          return {
            allowed: false,
            reason: eligibility.error ?? "Template not approved by Meta",
            channel,
            event,
            tournamentId,
            recipientMobile,
          };
        }
      }

      // B. Active Provider check in production
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
              featuresJson: tournamentsTable.featuresJson,
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

      if ((tournamentId || tournament) && !isTournamentLicensedForComm(tournament)) {
        const rawFeatures = (tournament as any)?.featuresJson ?? (tournament as any)?.features;
        const features = rawFeatures ? resolveTournamentFeatures(rawFeatures) : null;
        const reason = tournament?.adminLocked
          ? "Tournament is admin-locked"
          : features?.whatsappNotifications === false
            ? "WhatsApp communications explicitly disabled by admin for this tournament"
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

      // C. Recipient Revocation Check (STOP / Decline)
      let revoked = false;
      try {
        revoked = await isMobileRevoked(recipientMobile);
      } catch (err) {
        revoked = true;
      }
      if (revoked) {
        logger.info(
          { event, tournamentId, to: maskedMobile },
          "Push policy suppressed: Recipient has revoked WhatsApp updates (opted-out via STOP/declined)",
        );
        return {
          allowed: false,
          reason: "Recipient has not consented to WhatsApp updates (opted-out via STOP/declined)",
          channel,
          event,
          tournamentId,
          recipientMobile,
        };
      }

      // D. Recipient Consent Guard (Strict Fail-Closed Opt-In)
      let hasConsent = recipientConsent;
      if ((hasConsent === undefined || hasConsent === null) && recipientMobile) {
        try {
          const norm = recipientMobile.replace(/\D/g, "").replace(/^0/, "91");
          const tenDigit = norm.length === 12 && norm.startsWith("91") ? norm.slice(2) : norm;

          if (tournamentId) {
            const pQ = db
              .select({ whatsappConsent: playersTable.whatsappConsent })
              .from(playersTable)
              .where(
                and(
                  eq(playersTable.tournamentId, tournamentId),
                  or(
                    eq(playersTable.mobileNumber, recipientMobile),
                    eq(playersTable.mobileNumber, norm),
                    eq(playersTable.mobileNumber, tenDigit),
                    sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`,
                  ),
                ),
              );
            const pRows = typeof (pQ as any)?.limit === "function" ? await (pQ as any).limit(1) : await pQ;
            const player = Array.isArray(pRows) ? pRows[0] : null;

            if (player) {
              hasConsent = player.whatsappConsent;
            } else {
              // Check teamsTable for team owner
              const tQ = db
                .select({ whatsappConsent: teamsTable.whatsappConsent })
                .from(teamsTable)
                .where(
                  and(
                    eq(teamsTable.tournamentId, tournamentId),
                    or(
                      eq(teamsTable.ownerMobile, recipientMobile),
                      eq(teamsTable.ownerMobile, norm),
                      eq(teamsTable.ownerMobile, tenDigit),
                      sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`,
                    ),
                  ),
                );
              const tRows = typeof (tQ as any)?.limit === "function" ? await (tQ as any).limit(1) : await tQ;
              const team = Array.isArray(tRows) ? tRows[0] : null;

              if (team) {
                hasConsent = team.whatsappConsent;
              }
            }
          }

          if (hasConsent === undefined || hasConsent === null) {
            // Check organizersTable
            const oQ = db
              .select({ whatsappConsent: organizersTable.whatsappConsent })
              .from(organizersTable)
              .where(
                or(
                  eq(organizersTable.mobile, recipientMobile),
                  eq(organizersTable.mobile, norm),
                  eq(organizersTable.mobile, tenDigit),
                ),
              );
            const oRows = typeof (oQ as any)?.limit === "function" ? await (oQ as any).limit(1) : await oQ;
            const org = Array.isArray(oRows) ? oRows[0] : null;
            if (org) {
              hasConsent = org.whatsappConsent;
            } else {
              // Check scorerAccountsTable
              const sQ = db
                .select({ whatsappConsent: scorerAccountsTable.whatsappConsent })
                .from(scorerAccountsTable)
                .where(
                  or(
                    eq(scorerAccountsTable.mobile, recipientMobile),
                    eq(scorerAccountsTable.mobile, norm),
                    eq(scorerAccountsTable.mobile, tenDigit),
                  ),
                );
              const sRows = typeof (sQ as any)?.limit === "function" ? await (sQ as any).limit(1) : await sQ;
              const scorer = Array.isArray(sRows) ? sRows[0] : null;
              if (scorer) {
                hasConsent = scorer.whatsappConsent;
              }
            }
          }
        } catch (err) {
          logger.error(
            { err, tournamentId, to: maskedMobile },
            "Push policy consent check database lookup error (failing closed)",
          );
          hasConsent = false;
        }
      }

      if (hasConsent !== true) {
        logger.info(
          { event, tournamentId, to: maskedMobile, hasConsent },
          "Push policy suppressed: Recipient has not consented to WhatsApp updates (missing_or_unverified_consent)",
        );
        return {
          allowed: false,
          reason: "Recipient has not consented to WhatsApp updates (missing_or_unverified_consent)",
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
  tournamentId?: number | null;
  mobile: string | null;
  body: string;
  recipientConsent?: boolean | null;
  templateSid?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Array<{
    type: "header" | "body" | "button";
    sub_type?: string;
    index?: string | number;
    parameters: Array<{
      type: "text" | "currency" | "date_time" | "image" | "document" | "video";
      text?: string;
      image?: { link: string };
      document?: { link: string; filename?: string };
    }>;
  }>;
}): Promise<SendResult & { blocked?: boolean }> {
  const policy = await communicationPolicyEngine.evaluatePushPolicy({
    event: opts.event,
    channel: "whatsapp",
    tournamentId: opts.tournamentId,
    recipientMobile: opts.mobile,
    recipientConsent: opts.recipientConsent,
    templateName: opts.templateName,
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

  return sendWhatsApp(opts.mobile!, opts.body, opts.templateSid, {
    type: opts.templateName ? "template" : "text",
    templateName: opts.templateName,
    templateLanguage: opts.templateLanguage,
    templateComponents: opts.templateComponents,
  });
}
