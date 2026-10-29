import { db, pool } from "@workspace/db";
import {
  membersTable,
  memberRolesTable,
  memberIdentityLinksTable,
  playersTable,
  teamsTable,
  organizersTable,
  tournamentsTable,
  otpSessionsTable,
  commLogsTable,
  consentTokensTable,
  waConsentEventsTable,
  botSessionsTable,
  bplEditionsTable,
  scoringMatchesTable,
} from "@workspace/db";
import { eq, and, desc, or, sql, gt } from "drizzle-orm";
import {
  sendSms,
  sendWhatsApp,
  sendLicensedWhatsApp,
  isTournamentLicensedForComm,
  type SendResult,
} from "../comm-sender";
import { logger, maskPhoneNumber } from "../logger";
import { randomBytes, scrypt, timingSafeEqual, randomInt, createHash } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const CONSENT_QUESTION_V1 =
  `Kya aap BidWar se match updates, auction alerts aur tournament notifications WhatsApp pe paana chahte hain?\n\nHan ke liye "YES" bhejein\nNa ke liye "NO" bhejein`;

export interface NormalizedInboundMessage {
  from: string;
  channel: "whatsapp" | "sms";
  text: string;
  messageId?: string;
  raw?: unknown;
  ip?: string | null;
  tournamentId?: number;
}

export interface ConsentTarget {
  type: "player" | "team_owner" | "organizer";
  id: number;
  name: string;
  tournamentId?: number;
  tournamentName?: string;
}

export type ResolvedIdentity =
  | {
      kind: "member";
      member: typeof membersTable.$inferSelect;
      roles: (typeof memberRolesTable.$inferSelect)[];
      links: (typeof memberIdentityLinksTable.$inferSelect)[];
      tournamentIds: number[];
      isAmbiguous: boolean;
      primaryTournamentId?: number;
      displayName: string;
    }
  | {
      kind: "legacy";
      targets: ConsentTarget[];
      tournamentIds: number[];
      isAmbiguous: boolean;
      primaryTournamentId?: number;
      displayName: string;
    }
  | {
      kind: "guest";
      mobile: string;
      displayName: string;
    }
  | {
      kind: "inactive_member";
      member: typeof membersTable.$inferSelect;
      displayName: string;
      status: string;
    }
  | {
      kind: "unverified_mobile";
      displayName: string;
    };

export class ConversationRouter {
  /** Normalise a phone number (10 or 12 digits, digits only, starting with 91 for India) */
  public normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) return digits;
    if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  public async hashOtp(otp: string): Promise<string> {
    const salt = randomBytes(8).toString("hex");
    const key = (await scryptAsync(otp, salt, 32)) as Buffer;
    return `${salt}:${key.toString("hex")}`;
  }

  public async verifyOtp(otp: string, hash: string): Promise<boolean> {
    try {
      const [salt, key] = hash.split(":");
      if (!salt || !key) return false;
      const derived = (await scryptAsync(otp, salt, 32)) as Buffer;
      return timingSafeEqual(derived, Buffer.from(key, "hex"));
    } catch {
      return false;
    }
  }

  public generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  // In-memory fallback guard for process-level serialization when pool/advisory lock is unavailable
  private inFlightLocalLocks = new Map<string, number>();
  // Process-level active execution tracker to await in-flight requests rather than premature acknowledgment
  private inFlightExecutions = new Map<string, Promise<{ handled: boolean; replySent?: boolean; deduplicated?: boolean }>>();

  /**
   * Acquire a PostgreSQL session-level advisory lock for the given message ID.
   * Derives a stable 64-bit signed BigInt from the messageId.
   * Returns a release function if acquired, or null if already locked by another request.
   */
  public async acquireMessageLock(
    messageId: string,
  ): Promise<{ acquired: boolean; release: () => Promise<void> }> {
    if (!messageId || messageId.trim() === "") {
      return { acquired: true, release: async () => {} };
    }

    const trimmedId = messageId.trim();
    const now = Date.now();

    // Clean expired local lock entries (> 60s)
    this.inFlightLocalLocks.forEach((v, k) => { if (now - v > 60000) this.inFlightLocalLocks.delete(k); });

    // Process-level fast-check
    if (this.inFlightLocalLocks.has(trimmedId)) {
      return { acquired: false, release: async () => {} };
    }

    // Hash messageId into 64-bit signed BigInt string for pg_try_advisory_lock
    const hash = createHash("sha256").update(trimmedId).digest();
    const lockKey = hash.readBigInt64BE(0).toString();

    let client: any = null;
    let dbLocked = false;

    if (pool && typeof pool.connect === "function") {
      try {
        client = await pool.connect();
        const res = await client.query("SELECT pg_try_advisory_lock($1::bigint) AS locked", [lockKey]);
        dbLocked = Boolean(res.rows?.[0]?.locked);
        if (!dbLocked) {
          client.release();
          client = null;
          return { acquired: false, release: async () => {} };
        }
      } catch (err) {
        // If pool query fails (e.g. test environment or disconnected DB), fall back safely to in-memory lock
        if (client) {
          try { client.release(); } catch {}
          client = null;
        }
        logger.warn({ err, messageId: trimmedId }, "PostgreSQL advisory lock unavailable, using process fallback");
      }
    }

    // Set process lock
    this.inFlightLocalLocks.set(trimmedId, now);

    return {
      acquired: true,
      release: async () => {
        this.inFlightLocalLocks.delete(trimmedId);
        if (client && dbLocked) {
          try {
            await client.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey]);
          } catch (err) {
            logger.warn({ err, messageId: trimmedId }, "Failed to release PostgreSQL advisory lock");
          } finally {
            try { client.release(); } catch {}
          }
        }
      },
    };
  }

  /**
   * Send a bot conversational reply back to the user on their originating channel.
   * - Inbound WhatsApp -> outbound WhatsApp via sendWhatsApp (respecting provider & fail-closed)
   * - Inbound SMS -> outbound SMS via sendSms
   * NEVER falls back to SMS when an inbound WhatsApp message has no tournament licensing context.
   */
  public async sendReply(
    tournamentId: number | null | undefined,
    to: string,
    body: string,
    channel: "whatsapp" | "sms" = "whatsapp",
  ): Promise<SendResult> {
    if (channel === "whatsapp") {
      if (tournamentId) {
        const isLicensed = await this.isTournamentWaLicensed(tournamentId);
        if (!isLicensed) {
          logger.warn(
            { tournamentId, to: maskPhoneNumber(to) },
            "Tournament not licensed for WhatsApp; suppressing message without SMS fallback",
          );
          return { success: false, blocked: true, error: "Tournament WhatsApp unlicensed" };
        }
      }
      return sendWhatsApp(to, body);
    } else {
      const smsMobile = to.replace(/^whatsapp:/i, "").replace(/^\+/, "");
      return sendSms(smsMobile, body);
    }
  }


  /**
   * Check if an inbound message has already been processed (Idempotency Guard).
   */
  public async isMessageAlreadyProcessed(messageId?: string): Promise<boolean> {
    if (!messageId || messageId.trim() === "") return false;
    try {
      const [existing] = await db
        .select({ id: commLogsTable.id })
        .from(commLogsTable)
        .where(
          or(
            eq(commLogsTable.metaMessageId, messageId),
            eq(commLogsTable.blastId, `inbound_${messageId}`),
          ),
        )
        .limit(1);

      return Boolean(existing);
    } catch {
      return false;
    }
  }

  /**
   * Record processed inbound message ID for replay protection.
   */
  public async recordProcessedInboundMessage(
    messageId: string,
    mobile: string,
    channel: "whatsapp" | "sms",
    content: string,
    tournamentId?: number,
  ): Promise<void> {
    if (!messageId) return;
    await db.insert(commLogsTable).values({
      tournamentId: tournamentId ?? null,
      recipientType: "manual",
      recipientMobile: mobile,
      channel,
      messageContent: content,
      deliveryStatus: "delivered",
      metaMessageId: messageId,
      blastId: `inbound_${messageId}`,
    });
  }

  /**
   * Resolve human identity in strict priority order:
   * 1. Canonical Member (membersTable)
   * 2. Legacy Tables (playersTable, teamsTable, organizersTable)
   * 3. Guest (unauthenticated public user)
   */
  /**
   * Helper to verify if an identity has a required role scoped to a tournament or globally.
   */
  public isAuthorizedForRole(
    identity: ResolvedIdentity,
    tournamentId: number | null | undefined,
    requiredRole: string,
  ): boolean {
    if (identity.kind !== "member") return false;
    return identity.roles.some((r) => {
      const roleMatches = r.role.toLowerCase() === requiredRole.toLowerCase();
      if (!roleMatches) return false;
      if (r.scope === "global") return true;
      if (tournamentId != null && r.tournamentId === tournamentId) return true;
      return false;
    });
  }

  public async resolveIdentity(rawMobile: string): Promise<ResolvedIdentity> {
    const mobile = this.normalizePhone(rawMobile);
    const e164 = `+${mobile}`;
    const tenDigit = mobile.startsWith("91") && mobile.length === 12 ? mobile.slice(2) : mobile;

    try {
      // 1. Check Canonical Member
      const [member] = await db
        .select()
        .from(membersTable)
        .where(
          or(
            eq(membersTable.primaryMobile, mobile),
            eq(membersTable.primaryMobile, e164),
            eq(membersTable.primaryMobile, tenDigit),
          ),
        )
        .limit(1);

      if (member) {
        // Inactive / Revoked / Suspended membership check - fail closed without legacy fallback
        if (member.accountStatus !== "active") {
          logger.warn(
            { mobile: maskPhoneNumber(mobile), accountStatus: member.accountStatus },
            "Member account is not active; blocking access without legacy fallback",
          );
          return {
            kind: "inactive_member",
            member,
            displayName: member.displayName || member.firstName || "Member",
            status: member.accountStatus,
          };
        }

        // Unverified phone check
        if (!member.isMobileVerified) {
          logger.warn(
            { mobile: maskPhoneNumber(mobile) },
            "Member primary mobile is unverified; refusing authenticated member access",
          );
          return {
            kind: "unverified_mobile",
            displayName: member.displayName || member.firstName || "Member",
          };
        }

        const rawRoles = await db
          .select()
          .from(memberRolesTable)
          .where(eq(memberRolesTable.memberId, member.id));

        const rawLinks = await db
          .select()
          .from(memberIdentityLinksTable)
          .where(
            and(
              eq(memberIdentityLinksTable.memberId, member.id),
              eq(memberIdentityLinksTable.status, "active"),
            ),
          );

        const roles = Array.isArray(rawRoles) ? rawRoles : [];
        // Only active links with verified confidence (100) are recognized
        const links = (Array.isArray(rawLinks) ? rawLinks : []).filter(
          (l) => l.status === "active" && (l.confidenceScore ?? 0) >= 100,
        );

        // Collect distinct tournament IDs from roles (eliminate arbitrary roles.find selection)
        const roleTournamentIds = roles
          .map((r) => r?.tournamentId)
          .filter((tid): tid is number => tid != null);
        const tournamentIds = Array.from(new Set(roleTournamentIds));
        const isAmbiguous = tournamentIds.length > 1;
        const primaryTournamentId = tournamentIds.length === 1 ? tournamentIds[0] : undefined;

        return {
          kind: "member",
          member,
          roles,
          links,
          tournamentIds,
          isAmbiguous,
          primaryTournamentId,
          displayName: member.displayName || member.firstName || "Member",
        };
      }
    } catch (err) {
      logger.warn({ err, mobile: maskPhoneNumber(mobile) }, "Error resolving canonical member identity");
    }

    // 2. Check Legacy Tables
    const targets = await this.findAllConsentTargets(mobile);
    if (targets.length > 0) {
      const legacyTournamentIds = Array.from(
        new Set(targets.map((t) => t.tournamentId).filter((tid): tid is number => tid != null)),
      );
      const isAmbiguous = legacyTournamentIds.length > 1 || targets.length > 1;
      const primaryTournamentId = legacyTournamentIds.length === 1 && targets.length === 1 ? targets[0].tournamentId : undefined;

      return {
        kind: "legacy",
        targets,
        tournamentIds: legacyTournamentIds,
        isAmbiguous,
        primaryTournamentId,
        displayName: targets[0].name,
      };
    }

    // 3. Fallback to Guest
    return {
      kind: "guest",
      mobile,
      displayName: "Guest",
    };
  }

  /**
   * Query all matching legacy player, team owner, or organizer records.
   */
  public async findAllConsentTargets(mobile: string): Promise<ConsentTarget[]> {
    const norm = this.normalizePhone(mobile);
    const tenDigit = norm.startsWith("91") && norm.length === 12 ? norm.slice(2) : norm;
    const results: ConsentTarget[] = [];

    try {
      const players = await db
        .select({
          id: playersTable.id,
          name: playersTable.name,
          tournamentId: playersTable.tournamentId,
        })
        .from(playersTable)
        .where(
          or(
            eq(playersTable.mobileNumber, mobile),
            eq(playersTable.mobileNumber, norm),
            eq(playersTable.mobileNumber, tenDigit),
            sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`,
          ),
        );

      if (Array.isArray(players)) {
        for (const p of players) {
          const [t] = await db
            .select({ name: tournamentsTable.name })
            .from(tournamentsTable)
            .where(eq(tournamentsTable.id, p.tournamentId))
            .limit(1);
          results.push({
            type: "player",
            id: p.id,
            name: p.name,
            tournamentId: p.tournamentId,
            tournamentName: t?.name,
          });
        }
      }

      const teams = await db
        .select({
          id: teamsTable.id,
          name: teamsTable.name,
          tournamentId: teamsTable.tournamentId,
        })
        .from(teamsTable)
        .where(
          or(
            eq(teamsTable.ownerMobile, mobile),
            eq(teamsTable.ownerMobile, norm),
            eq(teamsTable.ownerMobile, tenDigit),
            sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`,
          ),
        );

      if (Array.isArray(teams)) {
        for (const tm of teams) {
          const [t] = await db
            .select({ name: tournamentsTable.name })
            .from(tournamentsTable)
            .where(eq(tournamentsTable.id, tm.tournamentId))
            .limit(1);
          results.push({
            type: "team_owner",
            id: tm.id,
            name: tm.name,
            tournamentId: tm.tournamentId,
            tournamentName: t?.name,
          });
        }
      }

      if (results.length === 0) {
        const orgs = await db
          .select({ id: organizersTable.id, name: organizersTable.name })
          .from(organizersTable)
          .where(
            or(
              eq(organizersTable.mobile, mobile),
              eq(organizersTable.mobile, norm),
              eq(organizersTable.mobile, tenDigit),
            ),
          );
        if (Array.isArray(orgs)) {
          for (const o of orgs) {
            results.push({ type: "organizer", id: o.id, name: o.name });
          }
        }
      }
    } catch (err) {
      logger.warn({ err, mobile: maskPhoneNumber(norm) }, "Error finding consent targets");
    }

    return results;
  }

  /** Check if a tournament has an active live communication license */
  public async isTournamentWaLicensed(tournamentId?: number | null): Promise<boolean> {
    if (!tournamentId) return false;
    const [t] = await db
      .select({
        licenseStatus: tournamentsTable.licenseStatus,
        adminLocked: tournamentsTable.adminLocked,
        scoringEnabled: tournamentsTable.scoringEnabled,
        scoringPhase: tournamentsTable.scoringPhase,
        licenseGrantedAt: tournamentsTable.licenseGrantedAt,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);
    return isTournamentLicensedForComm(t);
  }

  /**
   * Universal Revocation for STOP / UNSUBSCRIBE.
   * Immediately revokes WhatsApp consent without altering SMS consent.
   */
  public async revokeConsentAcrossRecords(mobile: string): Promise<void> {
    const norm = this.normalizePhone(mobile);
    const tenDigit = norm.startsWith("91") && norm.length === 12 ? norm.slice(2) : norm;

    // Revoke players
    await db
      .update(playersTable)
      .set({ whatsappConsent: false })
      .where(
        or(
          eq(playersTable.mobileNumber, mobile),
          eq(playersTable.mobileNumber, norm),
          eq(playersTable.mobileNumber, tenDigit),
          sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`,
        ),
      );

    // Revoke team owners
    await db
      .update(teamsTable)
      .set({ whatsappConsent: false })
      .where(
        or(
          eq(teamsTable.ownerMobile, mobile),
          eq(teamsTable.ownerMobile, norm),
          eq(teamsTable.ownerMobile, tenDigit),
          sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`,
        ),
      );

    // Revoke organizers
    await db
      .update(organizersTable)
      .set({ whatsappConsent: false })
      .where(
        or(
          eq(organizersTable.mobile, mobile),
          eq(organizersTable.mobile, norm),
          eq(organizersTable.mobile, tenDigit),
        ),
      );

    // Clear active bot sessions
    await db.delete(botSessionsTable).where(eq(botSessionsTable.mobile, norm));

    // Audit log event
    await db.insert(waConsentEventsTable).values({
      mobile: norm,
      eventType: "declined",
      questionVersion: "STOP_REVOKED",
    });

    logger.info({ mobile: maskPhoneNumber(norm) }, "WhatsApp consent universally revoked via STOP");
  }

  /**
   * Set verified consent on exact target.
   */
  public async setConsentGranted(type: string, id: number, ip: string | null): Promise<void> {
    const data = {
      whatsappConsent: true,
      whatsappConsentAt: new Date(),
      whatsappConsentMethod: "whatsapp_otp_verified",
      whatsappConsentIp: ip,
    };
    if (type === "player") await db.update(playersTable).set(data).where(eq(playersTable.id, id));
    else if (type === "team_owner") await db.update(teamsTable).set(data).where(eq(teamsTable.id, id));
    else if (type === "organizer") await db.update(organizersTable).set(data).where(eq(organizersTable.id, id));
  }

  /**
   * Build personalized report for consented user.
   * NEVER called for unauthenticated guests.
   */
  public async buildPersonalizedSummary(target: ConsentTarget): Promise<string> {
    if (target.type === "player") {
      const [p] = await db
        .select({
          name: playersTable.name,
          role: playersTable.role,
          status: playersTable.status,
          basePrice: playersTable.basePrice,
          soldPrice: playersTable.soldPrice,
        })
        .from(playersTable)
        .where(eq(playersTable.id, target.id))
        .limit(1);

      const statusMap: Record<string, string> = {
        available: "Available",
        sold: "Sold",
        unsold: "Unsold",
        retained: "Retained",
      };

      return [
        `Khiladi: ${p?.name ?? target.name}`,
        `Role: ${p?.role ?? "-"}`,
        `Tournament: ${target.tournamentName ?? "-"}`,
        `Status: ${statusMap[p?.status ?? ""] ?? p?.status ?? "-"}`,
        p?.soldPrice
          ? `Sold Price: ₹${p.soldPrice.toLocaleString("en-IN")}`
          : `Base Price: ₹${(p?.basePrice ?? 0).toLocaleString("en-IN")}`,
      ].join("\n");
    } else if (target.type === "team_owner") {
      const [tm] = await db
        .select({
          name: teamsTable.name,
          ownerName: teamsTable.ownerName,
          purse: teamsTable.purse,
          purseUsed: teamsTable.purseUsed,
        })
        .from(teamsTable)
        .where(eq(teamsTable.id, target.id))
        .limit(1);

      const remaining = (tm?.purse ?? 0) - (tm?.purseUsed ?? 0);
      return [
        `Team: ${tm?.name ?? target.name}`,
        `Owner: ${tm?.ownerName ?? "-"}`,
        `Tournament: ${target.tournamentName ?? "-"}`,
        `Purse Remaining: ₹${remaining.toLocaleString("en-IN")}`,
        `Purse Used: ₹${(tm?.purseUsed ?? 0).toLocaleString("en-IN")}`,
      ].join("\n");
    } else {
      const [o] = await db
        .select({ name: organizersTable.name })
        .from(organizersTable)
        .where(eq(organizersTable.id, target.id))
        .limit(1);
      const tcount = (
        await db
          .select({ id: tournamentsTable.id })
          .from(tournamentsTable)
          .where(eq(tournamentsTable.organizerId, target.id))
      ).length;
      return [`Organizer: ${o?.name ?? target.name}`, `Active Tournaments: ${tcount}`].join("\n");
    }
  }

  /**
   * Fetch public BPL edition information. Safe for Guest access.
   */
  public async getPublicBplInfo(): Promise<string> {
    const [edition] = await db
      .select({
        name: bplEditionsTable.name,
        startDate: bplEditionsTable.startDate,
        endDate: bplEditionsTable.endDate,
        venue: bplEditionsTable.venue,
        city: bplEditionsTable.city,
        liveStreamUrl: bplEditionsTable.liveStreamUrl,
        fanPageUrl: bplEditionsTable.fanPageUrl,
        status: bplEditionsTable.status,
      })
      .from(bplEditionsTable)
      .where(or(eq(bplEditionsTable.status, "LIVE"), eq(bplEditionsTable.status, "UPCOMING")))
      .orderBy(desc(bplEditionsTable.startDate))
      .limit(1);

    if (!edition) {
      return "🏆 BidWar Premier League (BPL):\nFilhal koi active ya upcoming edition scheduled nahi hai. Naye updates ke liye bidwar.in dekhein.";
    }

    const lines = [
      `🏆 ${edition.name}`,
      `Status: ${edition.status}`,
      edition.startDate && edition.endDate ? `Dates: ${edition.startDate} to ${edition.endDate}` : null,
      edition.venue ? `Venue: ${edition.venue}${edition.city ? `, ${edition.city}` : ""}` : null,
      edition.liveStreamUrl ? `📺 Live Stream: ${edition.liveStreamUrl}` : null,
      edition.fanPageUrl ? `🌐 Fan Page: ${edition.fanPageUrl}` : null,
    ].filter(Boolean);

    return lines.join("\n");
  }

  /**
   * Fetch public live match scoreboards. Safe for Guest access.
   */
  public async getPublicLiveScores(): Promise<string> {
    const matches = await db
      .select({
        id: scoringMatchesTable.id,
        tournamentId: scoringMatchesTable.tournamentId,
        status: scoringMatchesTable.status,
        resultSummary: scoringMatchesTable.resultSummary,
      })
      .from(scoringMatchesTable)
      .where(eq(scoringMatchesTable.status, "live"))
      .limit(3);

    if (matches.length === 0) {
      return "🏏 Live Scores:\nAbhi koi match LIVE nahi chal raha hai. Fixtures aur schedules dekhne ke liye bidwar.in pe jaayein.";
    }

    const lines = ["🏏 Current Live Matches:"];
    for (const m of matches) {
      lines.push(`• Match #${m.id}: ${m.resultSummary ?? "Match in progress"}`);
    }
    lines.push("\nDetails ke liye bidwar.in visit karein.");
    return lines.join("\n");
  }

  /**
   * Core Conversation Router Pipeline.
   * Processes inbound WhatsApp / SMS messages idempotently and with full security controls.
   */
  public async processInboundMessage(input: NormalizedInboundMessage): Promise<{ handled: boolean; replySent?: boolean; deduplicated?: boolean }> {
    const mobile = this.normalizePhone(input.from);
    const from = input.channel === "whatsapp" ? `whatsapp:+${mobile}` : `+${mobile}`;
    const text = input.text.trim();
    const upper = text.toUpperCase();
    const ip = input.ip ?? null;
    const trimmedId = input.messageId?.trim();

    logger.info(
      { from: maskPhoneNumber(mobile), text, channel: input.channel, messageId: trimmedId },
      "ConversationRouter: Processing inbound message",
    );

    if (trimmedId) {
      // 1. Check if already durably processed in comm_logs
      if (await this.isMessageAlreadyProcessed(trimmedId)) {
        logger.info(
          { messageId: trimmedId, mobile: maskPhoneNumber(mobile) },
          "ConversationRouter: Inbound message already processed in comm_logs (idempotent skip)",
        );
        return { handled: true, deduplicated: true, replySent: false };
      }

      // 2. Check if currently executing in this process
      const inFlight = this.inFlightExecutions.get(trimmedId);
      if (inFlight) {
        logger.info(
          { messageId: trimmedId, mobile: maskPhoneNumber(mobile) },
          "ConversationRouter: Message is currently in-flight; awaiting initial execution result",
        );
        try {
          await inFlight;
          if (await this.isMessageAlreadyProcessed(trimmedId)) {
            return { handled: true, deduplicated: true, replySent: false };
          }
        } catch (err) {
          logger.warn({ err, messageId: trimmedId }, "ConversationRouter: Initial in-flight execution failed; proceeding to retry");
        }
      }

      // 3. Acquire lock with retry/backoff for cross-process concurrency
      let lock = await this.acquireMessageLock(trimmedId);
      if (!lock.acquired) {
        const maxWaitMs = 2000;
        const start = Date.now();
        while (!lock.acquired && Date.now() - start < maxWaitMs) {
          await new Promise((r) => setTimeout(r, 150));
          if (await this.isMessageAlreadyProcessed(trimmedId)) {
            return { handled: true, deduplicated: true, replySent: false };
          }
          lock = await this.acquireMessageLock(trimmedId);
        }

        if (!lock.acquired) {
          logger.warn(
            { messageId: trimmedId, mobile: maskPhoneNumber(mobile) },
            "ConversationRouter: Message lock contention timeout; returning unhandled for provider retry",
          );
          return { handled: false, deduplicated: false, replySent: false };
        }
      }

      // 4. Wrap execution in inFlightExecutions
      const executionPromise = (async () => {
        try {
          return await this.executeInboundMessage(input, mobile, text, upper, from, ip);
        } finally {
          this.inFlightExecutions.delete(trimmedId);
          await lock.release();
        }
      })();

      this.inFlightExecutions.set(trimmedId, executionPromise);
      return await executionPromise;
    }

    return await this.executeInboundMessage(input, mobile, text, upper, from, ip);
  }

  private async executeInboundMessage(
    input: NormalizedInboundMessage,
    mobile: string,
    text: string,
    upper: string,
    from: string,
    ip: string | null,
  ): Promise<{ handled: boolean; replySent?: boolean; deduplicated?: boolean }> {
    // 1. Idempotency Check (comm_logs persistence check)
    if (input.messageId && (await this.isMessageAlreadyProcessed(input.messageId))) {
      logger.info(
        { messageId: input.messageId, mobile: maskPhoneNumber(mobile) },
        "ConversationRouter: Inbound message already processed in comm_logs (idempotent skip)",
      );
      return { handled: true, deduplicated: true, replySent: false };
    }

    // 2. STOP / UNSUBSCRIBE — Immediate universal opt-out
    if (upper === "STOP" || upper === "UNSUBSCRIBE") {
      await this.revokeConsentAcrossRecords(mobile);
      await this.sendReply(null,
        from,
        "Aap BidWar WhatsApp updates se unsubscribe ho gaye hain. Wapas subscribe karne ke liye 'hello' bhejein.", input.channel);
      await this.recordProcessedInboundMessage(input.messageId ?? `stop_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // 3. Resolve Identity
    const identity = await this.resolveIdentity(mobile);

    // Inactive / Revoked / Unverified checks - fail closed for private actions
    if (identity.kind === "inactive_member") {
      if (upper === "BPL" || upper.includes("PREMIER LEAGUE")) {
        const bpl = await this.getPublicBplInfo();
        await this.sendReply(null, from, bpl, input.channel);
      } else if (upper === "SCORES" || upper === "SCORE" || upper === "LIVE") {
        const scores = await this.getPublicLiveScores();
        await this.sendReply(null, from, scores, input.channel);
      } else if (upper === "HELP") {
        await this.sendReply(
          null,
          from,
          "BidWar Bot Commands:\n• 'BPL' — Premier League updates & stream\n• 'SCORES' — Live match updates\n• 'STOP' — Unsubscribe\n\nSahayata ke liye support@bidwar.in pe sampark karein.",
          input.channel,
        );
      } else {
        await this.sendReply(
          null,
          from,
          `🔒 Account Inactive: Aapka account active nahi hai (${identity.status}). Kripya support@bidwar.in se sampark karein.`,
          input.channel,
        );
      }
      await this.recordProcessedInboundMessage(input.messageId ?? `inactive_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    if (identity.kind === "unverified_mobile") {
      if (upper === "BPL" || upper.includes("PREMIER LEAGUE")) {
        const bpl = await this.getPublicBplInfo();
        await this.sendReply(null, from, bpl, input.channel);
      } else if (upper === "SCORES" || upper === "SCORE" || upper === "LIVE") {
        const scores = await this.getPublicLiveScores();
        await this.sendReply(null, from, scores, input.channel);
      } else if (upper === "HELP") {
        await this.sendReply(
          null,
          from,
          "BidWar Bot Commands:\n• 'BPL' — Premier League updates & stream\n• 'SCORES' — Live match updates\n• 'STOP' — Unsubscribe\n\nSahayata ke liye support@bidwar.in pe sampark karein.",
          input.channel,
        );
      } else {
        await this.sendReply(
          null,
          from,
          "🔒 Unverified Mobile: Aapka phone number verify nahi hai. Private tournament details dekhne ke liye bidwar.in pe login karke number verify karein.",
          input.channel,
        );
      }
      await this.recordProcessedInboundMessage(input.messageId ?? `unverified_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // 4. Check Pending Multi-Turn Bot Session (Tournament Disambiguation or Flow Continuation)
    if (/^\d{1,2}$/.test(upper.trim())) {
      const [sess] = await db
        .select()
        .from(botSessionsTable)
        .where(and(eq(botSessionsTable.mobile, mobile), gt(botSessionsTable.expiresAt, new Date())))
        .limit(1);

      if (sess?.pendingAction === "disambiguate_tournament") {
        const choice = parseInt(upper.trim(), 10);
        type DisambigOption = {
          kind: "member" | "legacy";
          tournamentId: number;
          tournamentName: string;
          roleOrType: string;
          target?: ConsentTarget;
        };
        let options: DisambigOption[] = [];
        try {
          options = JSON.parse(sess.pendingData ?? "[]") as DisambigOption[];
        } catch {}

        const selected = options[choice - 1];
        if (selected) {
          await db.delete(botSessionsTable).where(eq(botSessionsTable.mobile, mobile));
          // Revalidate authorization at point of access
          if (identity.kind === "member") {
            const hasRole = identity.roles.some((r) => r.tournamentId === selected.tournamentId);
            if (!hasRole) {
              await this.sendReply(
                null,
                from,
                "🔒 Unauthorized: Aap is tournament ke authorized member nahi hain.",
                input.channel,
              );
              await this.recordProcessedInboundMessage(input.messageId ?? `num_${Date.now()}`, mobile, input.channel, text);
              return { handled: true, replySent: true };
            }
            await this.sendReply(
              selected.tournamentId,
              from,
              `BidWar aapki jankari:\n\nTournament: ${selected.tournamentName}\nRole: ${selected.roleOrType}\n\nComplete stats & roster details dekhne ke liye bidwar.in portal pe login karein.`,
              input.channel,
            );
          } else if (identity.kind === "legacy" && selected.target) {
            const summary = await this.buildPersonalizedSummary(selected.target);
            await this.sendReply(
              selected.tournamentId,
              from,
              `BidWar aapki jankari:\n\n${summary}\n\nDetails ke liye apne tournament portal pe jaayein.`,
              input.channel,
            );
          }
        } else {
          await this.sendReply(
            options[0]?.tournamentId,
            from,
            `Invalid choice. 1 se ${options.length} ke beech mein reply karein. Ya 'DATA' dobara bhejein.`,
            input.channel,
          );
        }
        await this.recordProcessedInboundMessage(input.messageId ?? `num_${Date.now()}`, mobile, input.channel, text);
        return { handled: true, replySent: true };
      }
    }

    // 5. Check 6-digit OTP Verification
    if (/^\d{6}$/.test(upper)) {
      const [session] = await db
        .select()
        .from(otpSessionsTable)
        .where(
          and(
            or(eq(otpSessionsTable.mobile, mobile), eq(otpSessionsTable.mobile, `+${mobile}`)),
            eq(otpSessionsTable.used, false),
            gt(otpSessionsTable.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(otpSessionsTable.createdAt))
        .limit(1);

      if (session) {
        let payloadData: { attempts?: number } = {};
        try {
          payloadData = session.payload ? JSON.parse(session.payload) : {};
        } catch {}

        const attempts = (payloadData.attempts ?? 0) + 1;
        if (attempts > 3) {
          await db.update(otpSessionsTable).set({ used: true }).where(eq(otpSessionsTable.id, session.id));
          await this.sendReply(null,
            from,
            "Bohot baar galat OTP dali gayi. Yeh session expire ho gaya hai. Dobara 'hello' bhejein.", input.channel);
          return { handled: true, replySent: true };
        }

        const valid = session.otpHash ? await this.verifyOtp(upper, session.otpHash) : false;
        if (valid) {
          await db.update(otpSessionsTable).set({ used: true }).where(eq(otpSessionsTable.id, session.id));

          // Fetch stored target from pending_otp bot session
          const [otpSess] = await db
            .select()
            .from(botSessionsTable)
            .where(
              and(
                eq(botSessionsTable.mobile, mobile),
                eq(botSessionsTable.pendingAction, "pending_otp"),
                gt(botSessionsTable.expiresAt, new Date()),
              ),
            )
            .limit(1);

          await db
            .delete(botSessionsTable)
            .where(and(eq(botSessionsTable.mobile, mobile), eq(botSessionsTable.pendingAction, "pending_otp")));

          type StoredTarget = { recipientType: string; recipientId: number; tournamentId: number | null; name: string };
          let storedTarget: StoredTarget | null = null;
          try {
            storedTarget = otpSess?.pendingData ? (JSON.parse(otpSess.pendingData) as StoredTarget) : null;
          } catch {}

          if (storedTarget) {
            await this.setConsentGranted(storedTarget.recipientType, storedTarget.recipientId, ip);
            await db.insert(waConsentEventsTable).values({
              mobile,
              recipientType: storedTarget.recipientType,
              recipientId: storedTarget.recipientId,
              tournamentId: storedTarget.tournamentId ?? null,
              eventType: "otp_verified",
              ip,
            });

            await this.sendReply(storedTarget.tournamentId,
              from,
              `Shukriya ${storedTarget.name}! Aap BidWar WhatsApp notifications ke liye successfully subscribed hain. STOP bhejein unsubscribe ke liye.`, input.channel);
          } else {
            await this.sendReply(null,
              from,
              "OTP verify ho gayi lekin consent session expire ho gaya. Kripya 'hello' bhejein aur dobara subscribe karein.", input.channel);
          }
        } else {
          await db
            .update(otpSessionsTable)
            .set({ payload: JSON.stringify({ ...payloadData, attempts }) })
            .where(eq(otpSessionsTable.id, session.id));

          await this.sendReply(null, from, `Galat OTP (${attempts}/3 attempts). Dobara koshish karein.`, input.channel);
        }

        await this.recordProcessedInboundMessage(input.messageId ?? `otp_${Date.now()}`, mobile, input.channel, text);
        return { handled: true, replySent: true };
      }
    }

    // 6. OPTIN <token> — Verify token & stage consent question
    if (upper.startsWith("OPTIN ")) {
      const tokenStr = text.slice(6).trim();
      const [ct] = await db
        .select()
        .from(consentTokensTable)
        .where(
          and(
            eq(consentTokensTable.token, tokenStr),
            eq(consentTokensTable.used, false),
            gt(consentTokensTable.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!ct) {
        await this.sendReply(null, from, "Yeh consent link invalid ya expired hai. Kripya naya link request karein.", input.channel);
        await this.recordProcessedInboundMessage(input.messageId ?? `optin_${Date.now()}`, mobile, input.channel, text);
        return { handled: true, replySent: true };
      }

      // Security check: mobile must match issued token mobile
      const normTokenMobile = this.normalizePhone(ct.mobile);
      if (mobile !== normTokenMobile) {
        logger.warn(
          { inbound: maskPhoneNumber(mobile), issued: maskPhoneNumber(normTokenMobile) },
          "Consent token mobile mismatch",
        );
        await this.sendReply(null, from, "Yeh consent link aapke number ke liye nahi hai. Apne registered number se koshish karein.", input.channel);
        return { handled: true, replySent: true };
      }

      // Stage pending_yes session
      const sessionData = JSON.stringify({
        token: tokenStr,
        recipientType: ct.recipientType,
        recipientId: ct.recipientId,
        tournamentId: ct.tournamentId,
        name: identity.displayName,
      });

      await db
        .insert(botSessionsTable)
        .values({
          mobile,
          pendingAction: "pending_yes",
          pendingData: sessionData,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        })
        .onConflictDoUpdate({
          target: botSessionsTable.mobile,
          set: {
            pendingAction: "pending_yes",
            pendingData: sessionData,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });

      await this.sendReply(ct.tournamentId,
        from,
        `Namaste ${identity.displayName}!\n\n${CONSENT_QUESTION_V1}`, input.channel);
      await this.recordProcessedInboundMessage(input.messageId ?? `optin_staged_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // 7. YES / HA — Explicit consent reply $\rightarrow$ send OTP with 3-attempt/15min rate limit
    if (upper === "YES" || upper === "HA" || upper === "HAN") {
      const [session] = await db
        .select()
        .from(botSessionsTable)
        .where(
          and(
            eq(botSessionsTable.mobile, mobile),
            eq(botSessionsTable.pendingAction, "pending_yes"),
            gt(botSessionsTable.expiresAt, new Date()),
          ),
        )
        .limit(1);

      type StoredYesTarget = {
        token: string | null;
        recipientType: string;
        recipientId: number;
        tournamentId: number | null;
        name: string;
      };

      let yesTarget: StoredYesTarget | null = null;
      if (session?.pendingData) {
        try {
          yesTarget = JSON.parse(session.pendingData) as StoredYesTarget;
        } catch {}
      }

      if (!yesTarget) {
        await this.sendReply(null, from, "Koi active consent request nahi mili. Pehle 'hello' bhejein.", input.channel);
        return { handled: true, replySent: true };
      }

      // Check OTP rate limit: max 3 requests per 15 minutes
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentOtps = await db
        .select({ id: otpSessionsTable.id })
        .from(otpSessionsTable)
        .where(
          and(
            or(eq(otpSessionsTable.mobile, mobile), eq(otpSessionsTable.mobile, `+${mobile}`)),
            gt(otpSessionsTable.createdAt, fifteenMinsAgo),
          ),
        );

      if (Array.isArray(recentOtps) && recentOtps.length >= 3) {
        await this.sendReply(yesTarget.tournamentId,
          from,
          "Aapne bohot baar OTP request kiya hai. Kripya 15 minute baad dobara koshish karein.", input.channel);
        return { handled: true, replySent: true };
      }

      // Clear pending_yes session
      await db.delete(botSessionsTable).where(and(eq(botSessionsTable.mobile, mobile), eq(botSessionsTable.pendingAction, "pending_yes")));

      if (yesTarget.token) {
        await db.update(consentTokensTable).set({ used: true }).where(eq(consentTokensTable.token, yesTarget.token));
      }

      // Record explicit YES event
      await db.insert(waConsentEventsTable).values({
        mobile,
        recipientType: yesTarget.recipientType,
        recipientId: yesTarget.recipientId,
        tournamentId: yesTarget.tournamentId ?? null,
        eventType: "yes_received",
        questionVersion: CONSENT_QUESTION_V1,
        tokenUsed: yesTarget.token ?? null,
      });

      // Generate & stage OTP
      const otp = this.generateOtp();
      const otpHash = await this.hashOtp(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(otpSessionsTable).values({
        mobile,
        otpHash,
        purpose: "wa_consent",
        expiresAt,
      });

      const otpSessionData = JSON.stringify({
        recipientType: yesTarget.recipientType,
        recipientId: yesTarget.recipientId,
        tournamentId: yesTarget.tournamentId,
        name: yesTarget.name,
      });

      await db
        .insert(botSessionsTable)
        .values({
          mobile,
          pendingAction: "pending_otp",
          pendingData: otpSessionData,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        })
        .onConflictDoUpdate({
          target: botSessionsTable.mobile,
          set: {
            pendingAction: "pending_otp",
            pendingData: otpSessionData,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });

      // Send OTP via SMS
      await sendSms(`+${mobile}`, `BidWar OTP: ${otp} — WhatsApp consent verify karne ke liye use karein. 10 min valid.`);
      await this.sendReply(yesTarget.tournamentId,
        from,
        `Shukriya ${yesTarget.name}! Identity confirm karne ke liye SMS OTP bheja gaya hai. OTP aane ke baad yahan reply karein.`, input.channel);

      await this.recordProcessedInboundMessage(input.messageId ?? `yes_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // 8. HELLO / HI / MENU
    if (upper === "HELLO" || upper === "HI" || upper === "NAMASTE" || upper === "MENU") {
      if (identity.kind === "guest") {
        await this.sendReply(null,
          from,
          "Namaste! Main BidWar Assistant hun.\n\nPublic Commands:\n• 'BPL' — BPL schedules & live stream\n• 'SCORES' — Live match updates\n• 'HELP' — Jankari\n\nApna account ya auction details dekhne ke liye bidwar.in pe login karein.", input.channel);
      } else {
        // Registered Member or Legacy Target
        if (identity.isAmbiguous) {
          await this.sendReply(
            null,
            from,
            `Namaste ${identity.displayName}! Aapke ek se zyada tournaments registered hain. Apni details dekhne ke liye 'DATA' bhejein.\n\nCommands: 'DATA', 'BPL', 'SCORES', 'HELP'`,
            input.channel,
          );
        } else {
          const targetTournamentId = identity.primaryTournamentId;
          const isLicensed = await this.isTournamentWaLicensed(targetTournamentId);

          if (!isLicensed) {
            await this.sendReply(null,
              from,
              `Namaste ${identity.displayName}! Aapka tournament abhi WhatsApp notifications ke liye licensed nahi hai. SMS pe updates milte rahenge.\n\nCommands: 'BPL', 'SCORES', 'HELP'.`, input.channel);
          } else {
            // Stage pending_yes session
            const helloSessionData = JSON.stringify({
              token: null,
              recipientType: identity.kind === "member" ? "player" : identity.targets[0]?.type ?? "player",
              recipientId: identity.kind === "member" ? 0 : identity.targets[0]?.id ?? 0,
              tournamentId: targetTournamentId ?? null,
              name: identity.displayName,
            });

            await db
              .insert(botSessionsTable)
              .values({
                mobile,
                pendingAction: "pending_yes",
                pendingData: helloSessionData,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
              })
              .onConflictDoUpdate({
                target: botSessionsTable.mobile,
                set: {
                  pendingAction: "pending_yes",
                  pendingData: helloSessionData,
                  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
                },
              });

            await this.sendReply(targetTournamentId,
              from,
              `Namaste ${identity.displayName}!\n\n${CONSENT_QUESTION_V1}\n\nOther commands: 'DATA', 'BPL', 'SCORES', 'HELP'`, input.channel);
          }
        }
      }

      await this.recordProcessedInboundMessage(input.messageId ?? `hello_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // 9. DATA / REPORT — Strict Guest Privacy Protection & Multi-Tournament Disambiguation
    if (upper === "DATA" || upper === "REPORT" || upper === "STATUS" || /^(DATA|REPORT|STATUS)\s+\d+$/i.test(upper)) {
      if (identity.kind === "guest") {
        // Zero disclosure to Guests
        await this.sendReply(null,
          from,
          "🔒 Access Restricted: Aapka number kisi private tournament ya team se linked nahi hai. Private auction ya team data dekhne ke liye bidwar.in pe registered number se login karein.", input.channel);
        return { handled: true, replySent: true };
      }

      // Check for explicit tournament context in command text or input
      const explicitMatch = upper.match(/^(?:DATA|REPORT|STATUS)\s+(\d+)$/i);
      const explicitTid = explicitMatch ? parseInt(explicitMatch[1], 10) : input.tournamentId;

      if (explicitTid != null) {
        // Explicit tournament context requested: revalidate authorization
        if (identity.kind === "member") {
          const matchingRole = identity.roles.find((r) => r.tournamentId === explicitTid);
          if (!matchingRole) {
            await this.sendReply(
              null,
              from,
              "🔒 Unauthorized: Aap is tournament ke authorized member nahi hain.",
              input.channel,
            );
            await this.recordProcessedInboundMessage(input.messageId ?? `data_${Date.now()}`, mobile, input.channel, text);
            return { handled: true, replySent: true };
          }
          let tName = `Tournament ${explicitTid}`;
          try {
            const [t] = await db
              .select({ name: tournamentsTable.name })
              .from(tournamentsTable)
              .where(eq(tournamentsTable.id, explicitTid))
              .limit(1);
            if (t?.name) tName = t.name;
          } catch {}
          await this.sendReply(
            explicitTid,
            from,
            `BidWar aapki jankari:\n\nTournament: ${tName}\nRole: ${matchingRole.role}\n\nComplete stats & roster details dekhne ke liye bidwar.in portal pe login karein.`,
            input.channel,
          );
          await this.recordProcessedInboundMessage(input.messageId ?? `data_${Date.now()}`, mobile, input.channel, text);
          return { handled: true, replySent: true };
        } else if (identity.kind === "legacy") {
          const matchingTarget = identity.targets.find((t) => t.tournamentId === explicitTid);
          if (!matchingTarget) {
            await this.sendReply(
              null,
              from,
              "🔒 Unauthorized: Aap is tournament ke authorized member nahi hain.",
              input.channel,
            );
            await this.recordProcessedInboundMessage(input.messageId ?? `data_${Date.now()}`, mobile, input.channel, text);
            return { handled: true, replySent: true };
          }
          const summary = await this.buildPersonalizedSummary(matchingTarget);
          await this.sendReply(
            explicitTid,
            from,
            `BidWar aapki jankari:\n\n${summary}\n\nDetails ke liye bidwar.in pe jaayein.`,
            input.channel,
          );
          await this.recordProcessedInboundMessage(input.messageId ?? `data_${Date.now()}`, mobile, input.channel, text);
          return { handled: true, replySent: true };
        }
      }

      // No explicit tournament context: check ambiguity
      if (identity.isAmbiguous) {
        // Multi-tournament ambiguity: NEVER pick arbitrarily! Request disambiguation
        type DisambigOption = {
          kind: "member" | "legacy";
          tournamentId: number;
          tournamentName: string;
          roleOrType: string;
          target?: ConsentTarget;
        };
        const options: DisambigOption[] = [];

        if (identity.kind === "member") {
          for (const tid of identity.tournamentIds) {
            let tName = `Tournament ${tid}`;
            try {
              const [t] = await db
                .select({ name: tournamentsTable.name })
                .from(tournamentsTable)
                .where(eq(tournamentsTable.id, tid))
                .limit(1);
              if (t?.name) tName = t.name;
            } catch {}
            const rolesInT = identity.roles.filter((r) => r.tournamentId === tid).map((r) => r.role);
            options.push({
              kind: "member",
              tournamentId: tid,
              tournamentName: tName,
              roleOrType: rolesInT.join(", ") || "Member",
            });
          }
        } else if (identity.kind === "legacy") {
          for (const target of identity.targets) {
            options.push({
              kind: "legacy",
              tournamentId: target.tournamentId!,
              tournamentName: target.tournamentName ?? `Tournament ${target.tournamentId}`,
              roleOrType: target.type,
              target,
            });
          }
        }

        const sessionData = JSON.stringify(options);
        await db
          .insert(botSessionsTable)
          .values({
            mobile,
            pendingAction: "disambiguate_tournament",
            pendingData: sessionData,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          })
          .onConflictDoUpdate({
            target: botSessionsTable.mobile,
            set: {
              pendingAction: "disambiguate_tournament",
              pendingData: sessionData,
              expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
          });

        const menu = options.map((opt, idx) => `${idx + 1}. ${opt.tournamentName} (${opt.roleOrType})`).join("\n");
        await this.sendReply(
          options[0]?.tournamentId,
          from,
          `Aapke ek se zyada tournaments hain. Number chun kar reply karein:\n\n${menu}`,
          input.channel,
        );
        await this.recordProcessedInboundMessage(input.messageId ?? `data_${Date.now()}`, mobile, input.channel, text);
        return { handled: true, replySent: true };
      }

      // Unambiguous (single tournament or 0)
      if (identity.kind === "legacy") {
        if (identity.targets.length === 1) {
          const summary = await this.buildPersonalizedSummary(identity.targets[0]);
          await this.sendReply(
            identity.targets[0].tournamentId,
            from,
            `BidWar aapki jankari:\n\n${summary}\n\nDetails ke liye bidwar.in pe jaayein.`,
            input.channel,
          );
        }
      } else if (identity.kind === "member") {
        if (identity.primaryTournamentId != null) {
          let tName = "Tournament";
          try {
            const [t] = await db
              .select({ name: tournamentsTable.name })
              .from(tournamentsTable)
              .where(eq(tournamentsTable.id, identity.primaryTournamentId))
              .limit(1);
            if (t?.name) tName = t.name;
          } catch {}
          await this.sendReply(
            identity.primaryTournamentId,
            from,
            `Namaste ${identity.displayName}!\nTournament: ${tName}\nRole: ${identity.roles.map((r) => r.role).join(", ") || "Member"}\n\nComplete stats & roster details dekhne ke liye bidwar.in portal pe login karein.`,
            input.channel,
          );
        } else {
          await this.sendReply(
            null,
            from,
            `Namaste ${identity.displayName}!\nAap kisi active tournament se linked nahi hain. Details ke liye bidwar.in portal pe login karein.`,
            input.channel,
          );
        }
      }

      await this.recordProcessedInboundMessage(input.messageId ?? `data_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // 10. BPL — Public Information
    if (upper === "BPL" || upper.includes("PREMIER LEAGUE")) {
      const bplSummary = await this.getPublicBplInfo();
      await this.sendReply(null, from, bplSummary, input.channel);
      await this.recordProcessedInboundMessage(input.messageId ?? `bpl_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // 11. SCORES — Public Match Scoreboards
    if (upper === "SCORES" || upper === "SCORE" || upper === "LIVE") {
      const scoresSummary = await this.getPublicLiveScores();
      await this.sendReply(null, from, scoresSummary, input.channel);
      await this.recordProcessedInboundMessage(input.messageId ?? `scores_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // 12. HELP / DEFAULT MENU
    if (upper === "HELP") {
      await this.sendReply(null,
        from,
        "BidWar Bot Commands:\n• 'BPL' — Premier League updates & stream\n• 'SCORES' — Live match updates\n• 'DATA' — Apni team / player info\n• 'STOP' — Unsubscribe\n\nSahayata ke liye support@bidwar.in pe sampark karein.", input.channel);
      await this.recordProcessedInboundMessage(input.messageId ?? `help_${Date.now()}`, mobile, input.channel, text);
      return { handled: true, replySent: true };
    }

    // Unknown command
    await this.sendReply(null,
      from,
      "BidWar Bot Menu:\n• 'HELLO' — Subscribe / Start\n• 'BPL' — BPL Updates\n• 'SCORES' — Live Scores\n• 'DATA' — Profile Info\n• 'STOP' — Unsubscribe", input.channel);
    await this.recordProcessedInboundMessage(input.messageId ?? `unknown_${Date.now()}`, mobile, input.channel, text);
    return { handled: true, replySent: true };
  }
}

export const conversationRouter = new ConversationRouter();
