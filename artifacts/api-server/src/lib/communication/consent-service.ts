/**
 * Centralized WhatsApp Consent Management Service
 *
 * Implements BIDWAR Phase 2 Individual Opt-In, Notice & Withdrawal lifecycle.
 * Provides unified, attributable consent recording, universal withdrawal suppression,
 * and phone-number mutation safety across players, team owners, organizers, and scorers.
 */

import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  organizersTable,
  scorerAccountsTable,
  waConsentEventsTable,
  botSessionsTable,
} from "@workspace/db";
import { eq, or, sql, and } from "drizzle-orm";
import pino from "pino";
import {
  CURRENT_CONSENT_NOTICE_VERSION,
  type ConsentScope,
} from "@workspace/api-base";

const logger = pino({ name: "consent-service" });

export type ConsentRecipientType = "player" | "team_owner" | "organizer" | "scorer";

export type ConsentSource =
  | "registration_web"
  | "profile_web"
  | "whatsapp_bot"
  | "whatsapp_otp_verified"
  | "consent_link"
  | "scorer_portal"
  | "organizer_portal"
  | "owner_portal";

export interface RecordConsentGrantedOptions {
  recipientType: ConsentRecipientType;
  recipientId: number;
  mobile: string;
  tournamentId?: number | null;
  noticeVersion?: string;
  consentScope?: ConsentScope | string;
  source: ConsentSource;
  ip?: string | null;
  tokenUsed?: string | null;
  tx?: any;
}

export interface RecordConsentWithdrawalOptions {
  mobile: string;
  recipientType?: ConsentRecipientType | "all";
  recipientId?: number | null;
  tournamentId?: number | null;
  reason?: string;
  source?: string;
  ip?: string | null;
}

export interface HandlePhoneChangeOptions {
  entityType: ConsentRecipientType;
  entityId: number;
  oldMobile: string | null | undefined;
  newMobile: string;
  tournamentId?: number | null;
  ip?: string | null;
}

/**
 * Normalizes phone numbers to standard 12-digit Indian format (91XXXXXXXXXX)
 * or 10-digit national number.
 */
export function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

/**
 * Masks a phone number for secure logging (e.g. 91******3210).
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return "****";
  const str = phone.replace(/\s+/g, "");
  if (str.length <= 4) return "****";
  const prefix = str.slice(0, 2);
  const suffix = str.slice(-4);
  return `${prefix}${"*".repeat(Math.max(1, str.length - 6))}${suffix}`;
}

/**
 * Records an affirmative, attributable WhatsApp opt-in for an identifiable recipient.
 */
export async function recordConsentGranted(
  options: RecordConsentGrantedOptions,
): Promise<{ success: boolean; eventId?: number }> {
  const {
    recipientType,
    recipientId,
    mobile,
    tournamentId = null,
    noticeVersion = CURRENT_CONSENT_NOTICE_VERSION,
    consentScope = "tournament_operational",
    source,
    ip = null,
    tokenUsed = null,
    tx,
  } = options;

  const client = tx ?? db;
  const norm = normalizePhone(mobile);
  const updateData = {
    whatsappConsent: true,
    whatsappConsentAt: new Date(),
    whatsappConsentMethod: source,
    whatsappConsentIp: ip,
  };

  try {
    // 1. Update the authoritative entity record
    if (recipientType === "player" && recipientId > 0) {
      await client.update(playersTable).set(updateData).where(eq(playersTable.id, recipientId));
    } else if (recipientType === "team_owner" && recipientId > 0) {
      await client.update(teamsTable).set(updateData).where(eq(teamsTable.id, recipientId));
    } else if (recipientType === "organizer" && recipientId > 0) {
      await client.update(organizersTable).set(updateData).where(eq(organizersTable.id, recipientId));
    } else if (recipientType === "scorer" && recipientId > 0) {
      await client.update(scorerAccountsTable).set(updateData as any).where(eq(scorerAccountsTable.id, recipientId));
    }

    // 2. Append immutable audit ledger event
    const [inserted] = await client
      .insert(waConsentEventsTable)
      .values({
        mobile: norm,
        recipientType,
        recipientId: recipientId > 0 ? recipientId : null,
        tournamentId,
        eventType: "opt_in",
        questionVersion: noticeVersion,
        consentScope,
        source,
        tokenUsed,
        ip,
        eventAt: new Date(),
      })
      .returning({ id: waConsentEventsTable.id });

    logger.info(
      {
        recipientType,
        recipientId,
        mobile: maskPhoneNumber(norm),
        noticeVersion,
        consentScope,
        source,
      },
      "WhatsApp consent granted and persisted with verifiable audit record",
    );

    return { success: true, eventId: inserted?.id };
  } catch (err) {
    logger.error(
      { err, recipientType, recipientId, mobile: maskPhoneNumber(norm) },
      "Failed to record consent granted",
    );
    throw err;
  }
}

/**
 * Records an explicit consent withdrawal and immediately updates all affected entities.
 */
export async function recordConsentWithdrawal(
  options: RecordConsentWithdrawalOptions,
): Promise<{ success: boolean; eventId?: number }> {
  const {
    mobile,
    recipientType = "all",
    recipientId = null,
    tournamentId = null,
    reason = "USER_WITHDRAWAL",
    source = "manual_withdrawal",
    ip = null,
  } = options;

  const norm = normalizePhone(mobile);
  const tenDigit = norm.startsWith("91") && norm.length === 12 ? norm.slice(2) : norm;

  try {
    // 1. Update target entity / entities
    if (recipientType === "player" && recipientId) {
      await db.update(playersTable).set({ whatsappConsent: false }).where(eq(playersTable.id, recipientId));
    } else if (recipientType === "team_owner" && recipientId) {
      await db.update(teamsTable).set({ whatsappConsent: false }).where(eq(teamsTable.id, recipientId));
    } else if (recipientType === "organizer" && recipientId) {
      await db.update(organizersTable).set({ whatsappConsent: false }).where(eq(organizersTable.id, recipientId));
    } else if (recipientType === "scorer" && recipientId) {
      await db.update(scorerAccountsTable).set({ whatsappConsent: false }).where(eq(scorerAccountsTable.id, recipientId));
    } else {
      // Universal withdrawal across all records matching this phone number
      await Promise.all([
        db
          .update(playersTable)
          .set({ whatsappConsent: false })
          .where(
            or(
              eq(playersTable.mobileNumber, mobile),
              eq(playersTable.mobileNumber, norm),
              eq(playersTable.mobileNumber, tenDigit),
              sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`,
            ),
          ),
        db
          .update(teamsTable)
          .set({ whatsappConsent: false })
          .where(
            or(
              eq(teamsTable.ownerMobile, mobile),
              eq(teamsTable.ownerMobile, norm),
              eq(teamsTable.ownerMobile, tenDigit),
              sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`,
            ),
          ),
        db
          .update(organizersTable)
          .set({ whatsappConsent: false })
          .where(
            or(
              eq(organizersTable.mobile, mobile),
              eq(organizersTable.mobile, norm),
              eq(organizersTable.mobile, tenDigit),
            ),
          ),
        db
          .update(scorerAccountsTable)
          .set({ whatsappConsent: false })
          .where(
            or(
              eq(scorerAccountsTable.mobile, mobile),
              eq(scorerAccountsTable.mobile, norm),
              eq(scorerAccountsTable.mobile, tenDigit),
            ),
          ),
      ]);
    }

    // 2. Clear any active bot sessions for this number
    await db.delete(botSessionsTable).where(eq(botSessionsTable.mobile, norm));

    // 3. Append immutable audit ledger event
    const [inserted] = await db
      .insert(waConsentEventsTable)
      .values({
        mobile: norm,
        recipientType: recipientType === "all" ? "universal" : recipientType,
        recipientId,
        tournamentId,
        eventType: "declined", // Handled as revoked by policy engine
        questionVersion: reason,
        source,
        ip,
        eventAt: new Date(),
      })
      .returning({ id: waConsentEventsTable.id });

    logger.info(
      {
        mobile: maskPhoneNumber(norm),
        recipientType,
        recipientId,
        reason,
        source,
      },
      "WhatsApp consent revoked and persisted across records",
    );

    return { success: true, eventId: inserted?.id };
  } catch (err) {
    logger.error(
      { err, mobile: maskPhoneNumber(norm), recipientType, recipientId },
      "Failed to record consent withdrawal",
    );
    throw err;
  }
}

/**
 * Handles phone number changes for any entity.
 * In accordance with Phase 2 principles:
 * - A new phone number NEVER inherits consent granted for an old number.
 * - Consent is bound to the number that was actually consented to.
 * - Changing a number invalidates the consent on the changed record.
 */
export async function handlePhoneNumberChange(
  options: HandlePhoneChangeOptions,
): Promise<{ changed: boolean; consentReset: boolean }> {
  const { entityType, entityId, oldMobile, newMobile, tournamentId = null, ip = null } = options;

  if (!oldMobile || !oldMobile.trim()) {
    return { changed: false, consentReset: false };
  }

  const oldNorm = normalizePhone(oldMobile);
  const newNorm = normalizePhone(newMobile);

  if (oldNorm === newNorm) {
    return { changed: false, consentReset: false };
  }

  try {
    // 1. Reset consent fields on the updated entity
    const resetData = {
      whatsappConsent: false,
      whatsappConsentAt: null,
      whatsappConsentMethod: null,
      whatsappConsentIp: ip,
    };

    if (entityType === "player") {
      await db.update(playersTable).set(resetData).where(eq(playersTable.id, entityId));
    } else if (entityType === "team_owner") {
      await db.update(teamsTable).set(resetData).where(eq(teamsTable.id, entityId));
    } else if (entityType === "organizer") {
      await db.update(organizersTable).set(resetData).where(eq(organizersTable.id, entityId));
    } else if (entityType === "scorer") {
      await db.update(scorerAccountsTable).set(resetData as any).where(eq(scorerAccountsTable.id, entityId));
    }

    // 2. Record audit lifecycle event for phone mutation
    await db.insert(waConsentEventsTable).values({
      mobile: oldNorm,
      recipientType: entityType,
      recipientId: entityId,
      tournamentId,
      eventType: "phone_changed",
      questionVersion: "PHONE_NUMBER_CHANGED_RESET",
      source: "phone_mutation",
      ip,
      eventAt: new Date(),
    });

    logger.info(
      {
        entityType,
        entityId,
        oldMobile: maskPhoneNumber(oldNorm),
        newMobile: maskPhoneNumber(newNorm),
      },
      "Phone number mutated: revoked inherited consent for entity",
    );

    return { changed: true, consentReset: true };
  } catch (err) {
    logger.error(
      { err, entityType, entityId, oldMobile: maskPhoneNumber(oldNorm), newMobile: maskPhoneNumber(newNorm) },
      "Error during phone number mutation consent handling",
    );
    throw err;
  }
}
