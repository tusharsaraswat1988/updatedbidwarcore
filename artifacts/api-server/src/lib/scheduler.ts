/**
 * 24-hour pre-tournament consent blast scheduler.
 *
 * Runs hourly. Finds tournaments whose auctionDate + auctionTime falls within
 * the next 23–25 hours (live license, not locked). Sends consent SMS with
 * wa.me link to all unconsented participants (players, team owners, organizer).
 * Deduplicates via consent_blast_log.
 *
 * Date arithmetic uses IST (UTC+5:30) to match stored auctionDate values.
 */

import { db } from "@workspace/db";
import {
  tournamentsTable,
  playersTable,
  teamsTable,
  organizersTable,
  consentTokensTable,
  consentBlastLogTable,
} from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendSms, buildWaMeLink, buildConsentSms } from "./comm-sender";
import { logger } from "./logger";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

function newToken(): string { return randomBytes(16).toString("hex"); }

function parseTournamentDateTime(date: string | null, time: string | null): Date | null {
  if (!date) return null;
  const timeStr = time ?? "09:00";
  try {
    return new Date(`${date}T${timeStr}:00+05:30`);
  } catch { return null; }
}

/** Returns the current date string in IST (YYYY-MM-DD). */
function istDateStr(offsetFromNowMs = 0): string {
  const istNow = new Date(Date.now() + IST_OFFSET_MS + offsetFromNowMs);
  return istNow.toISOString().slice(0, 10);
}

async function runConsentBlast() {
  const now = new Date();
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Use IST-aware date strings to avoid UTC midnight vs IST midnight mismatch.
  // Widen pre-filter to today + tomorrow in IST — exact window enforced below.
  const todayIst = istDateStr(0);
  const tomorrowIst = istDateStr(24 * 60 * 60 * 1000);

  logger.info({ todayIst, tomorrowIst }, "Running 24h consent blast check");

  // Find live, unlocked tournaments where auctionDate is today or tomorrow in IST
  const tournaments = await db.select({
    id: tournamentsTable.id,
    name: tournamentsTable.name,
    auctionDate: tournamentsTable.auctionDate,
    auctionTime: tournamentsTable.auctionTime,
    organizerMobile: tournamentsTable.organizerMobile,
    organizerId: tournamentsTable.organizerId,
  }).from(tournamentsTable).where(
    and(
      eq(tournamentsTable.licenseStatus, "live"),
      eq(tournamentsTable.adminLocked, false),
      or(
        sql`${tournamentsTable.auctionDate} = ${todayIst}`,
        sql`${tournamentsTable.auctionDate} = ${tomorrowIst}`,
      ),
    ),
  );

  for (const t of tournaments) {
    const auctionAt = parseTournamentDateTime(t.auctionDate, t.auctionTime);
    // Exact 23–25 h window check (works in any timezone — timestamps are absolute)
    if (!auctionAt || auctionAt < in23h || auctionAt > in25h) continue;

    logger.info({ tournamentId: t.id, name: t.name, auctionAt }, "Sending consent blast");

    // Collect unconsented players with mobile
    const players = await db.select({ id: playersTable.id, mobile: playersTable.mobileNumber })
      .from(playersTable).where(
        and(
          eq(playersTable.tournamentId, t.id),
          eq(playersTable.whatsappConsent, false),
          sql`${playersTable.mobileNumber} IS NOT NULL AND ${playersTable.mobileNumber} != ''`,
        ),
      );

    // Collect unconsented team owners with mobile
    const teams = await db.select({ id: teamsTable.id, mobile: teamsTable.ownerMobile })
      .from(teamsTable).where(
        and(
          eq(teamsTable.tournamentId, t.id),
          eq(teamsTable.whatsappConsent, false),
          sql`${teamsTable.ownerMobile} IS NOT NULL AND ${teamsTable.ownerMobile} != ''`,
        ),
      );

    type BlastTarget = { recipientType: "player" | "team_owner" | "organizer"; id: number | null; mobile: string };
    const targets: BlastTarget[] = [
      ...players.map(p => ({ recipientType: "player" as const, id: p.id, mobile: p.mobile! })),
      ...teams.map(tm => ({ recipientType: "team_owner" as const, id: tm.id, mobile: tm.mobile! })),
    ];

    // Include tournament organizer only if unconsented and has mobile
    if (t.organizerMobile && t.organizerId) {
      const [org] = await db.select({ whatsappConsent: organizersTable.whatsappConsent })
        .from(organizersTable).where(eq(organizersTable.id, t.organizerId));
      if (!org?.whatsappConsent) {
        targets.push({ recipientType: "organizer", id: t.organizerId, mobile: t.organizerMobile });
      }
    }

    let sent = 0;
    let skipped = 0;

    // Use IST tomorrow for the blast deduplication key (matches auctionDate semantics)
    const blastDateKey = tomorrowIst;

    for (const target of targets) {
      // Deduplication: one SMS per mobile per blast date
      try {
        await db.insert(consentBlastLogTable).values({ tournamentId: t.id, mobile: target.mobile, blastDate: blastDateKey });
      } catch {
        skipped++;
        continue; // Already sent for this blast window
      }

      // Generate consent token
      const token = newToken();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      await db.insert(consentTokensTable).values({
        token,
        recipientType: target.recipientType,
        recipientId: target.id ?? 0,
        mobile: target.mobile,
        tournamentId: t.id,
        expiresAt,
      });

      const waLink = buildWaMeLink(token);
      const smsBody = buildConsentSms(t.name, waLink);
      const result = await sendSms(target.mobile, smsBody);

      if (result.success) sent++;
      else logger.warn({ mobile: target.mobile, error: result.error }, "Consent blast SMS failed");
    }

    logger.info({ tournamentId: t.id, sent, skipped }, "Consent blast complete");
  }
}

let schedulerHandle: NodeJS.Timeout | null = null;

export function startConsentBlastScheduler() {
  if (schedulerHandle) return;
  // Run immediately on startup, then every hour
  void runConsentBlast().catch(err => logger.error({ err }, "Consent blast initial run failed"));
  schedulerHandle = setInterval(() => {
    void runConsentBlast().catch(err => logger.error({ err }, "Consent blast hourly run failed"));
  }, 60 * 60 * 1000);
  logger.info("Consent blast scheduler started (hourly)");
}

export function stopConsentBlastScheduler() {
  if (schedulerHandle) { clearInterval(schedulerHandle); schedulerHandle = null; }
}
