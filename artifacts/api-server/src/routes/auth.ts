import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, organizersTable, auctionSessionsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { timingSafeEqual, scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { authLimiter, otpSendLimiter, otpVerifyLimiter } from "../lib/rate-limiters";
import {
  checkLoginAttemptAllowed,
  clearLoginFailures,
  getLoginGuardStatus,
  recordLoginFailure,
} from "../lib/login-attempt-guard";
import { setAuthCookie, clearAuthCookie, setOAuthCookie, clearOAuthCookie, COOKIE_NAME, signNativeGoogleHandoffJwt, verifyNativeGoogleHandoffJwt } from "../lib/jwt";
import type { AuthClaims } from "../lib/jwt";
import { sendDltSms } from "../lib/fast2sms";
import { sendOtp as bulkSmsOtpSend, verifyOtp as bulkSmsOtpVerify, resendOtp as bulkSmsOtpResend } from "../lib/bulksms-otp";
import {
  buildPublicUrlForRequest,
  getAdminDataPassword,
  getAdminPassword,
} from "../lib/runtime-env";
import { tryCompleteGoogleSheetsOAuth } from "../lib/google-sheets-oauth-callback.js";
import {
  DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
  DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
  DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
  DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
} from "@workspace/api-base/auction-readiness";
import { parseIndianMobile, isPlaceholderOrganizerMobile, displayOrganizerMobile, organizerNeedsPhoneVerification } from "@workspace/api-base/mobile";
import { isOrganizerAccountLocked, organizerPhoneStatusLabel } from "@workspace/api-base/organizer-account";
import { mergeTournamentFeatures, resolveTournamentFeatures } from "@workspace/api-base/tournament-features";
import { notifyAsync } from "../lib/notifications";
import {
  notifyAdminOrganiserRegistered,
  notifyAdminTournamentCreated,
} from "../lib/admin-notifications/triggers.js";
import { commitCloudinaryImageWrite } from "../lib/cloudinary-media-service";
import type { Organizer } from "@workspace/db";
import { auditLog, auditDenied } from "../lib/audit-service";
import { isKnownActiveSportSlug, resolveSportIdBySlug } from "./sports";
import {
  isScoringSupportedSport,
  TOURNAMENT_LIFECYCLE_STATUSES,
} from "../lib/tournament-lifecycle";
import { parseAuditReason, tournamentConfigFieldsChanged } from "../lib/audit-reason";
import { snapshotTournament, snapshotOrganizer } from "../lib/audit-snapshots";
import { claimTournamentsForOrganizer } from "../lib/claim-tournaments-for-organizer";

const scryptAsync = promisify(scrypt);

function triggerOrganiserRegisteredNotification(organizer: Organizer): void {
  notifyAsync("ORGANISER_REGISTERED", {
    organizerId: organizer.id,
    name: organizer.name,
    email: organizer.email,
    mobile: organizer.mobile,
  });
  notifyAdminOrganiserRegistered(organizer);
}

async function organizerNormalizedMobileTaken(normalized: string, excludeId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: organizersTable.id, mobile: organizersTable.mobile })
    .from(organizersTable);
  for (const row of rows) {
    if (excludeId !== undefined && row.id === excludeId) continue;
    if (isPlaceholderOrganizerMobile(row.mobile)) continue;
    const parsed = parseIndianMobile(row.mobile);
    if (parsed.ok && parsed.normalized === normalized) return true;
  }
  return false;
}

async function findOrganizerByMobileInput(raw: string) {
  const parsed = parseIndianMobile(raw);
  if (!parsed.ok) return { parsed, organizer: null as (typeof organizersTable.$inferSelect | null) };
  const rows = await db.select().from(organizersTable);
  for (const row of rows) {
    if (isPlaceholderOrganizerMobile(row.mobile)) continue;
    const existing = parseIndianMobile(row.mobile);
    if (existing.ok && existing.normalized === parsed.normalized) {
      return { parsed, organizer: row };
    }
  }
  return { parsed, organizer: null };
}

// Auction code helpers (mirrors tournaments.ts — kept local to avoid circular deps)
function _buildAuctionCode(name: string, auctionDate?: string | null): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const tt = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (words[0]?.substring(0, 2) ?? "XX").toUpperCase();
  const nn = String(Math.floor(Math.random() * 90) + 10);
  const d = auctionDate ? new Date(auctionDate) : new Date();
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${tt}${nn}${dd}${mm}`;
}
async function _generateUniqueAuctionCode(name: string, auctionDate?: string | null): Promise<string> {
  for (let i = 0; i < 15; i++) {
    const code = _buildAuctionCode(name, auctionDate);
    const ex = await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(eq(tournamentsTable.auctionCode, code)).limit(1);
    if (ex.length === 0) return code;
  }
  return _buildAuctionCode(name, auctionDate) + String(Math.floor(Math.random() * 90) + 10);
}

const router = Router();

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      timingSafeEqual(Buffer.from(a), Buffer.from(a));
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
  } catch {
    return false;
  }
}

function isMasterAdmin(req: import("express").Request): boolean {
  return !!req.jwtUser.isAdmin && req.jwtUser.adminLevel === "master";
}

function isAnyAdmin(req: import("express").Request): boolean {
  return !!req.jwtUser.isAdmin;
}

const organizerToJson = (o: typeof organizersTable.$inferSelect) => {
  const incomplete = organizerNeedsPhoneVerification({
    mobile: o.mobile,
    phoneVerified: o.phoneVerified,
  });
  return {
    id: o.id,
    name: o.name,
    email: o.email,
    mobile: displayOrganizerMobile(o.mobile),
    photoUrl: o.photoUrl ?? null,
    photoPublicId: o.photoPublicId ?? null,
    licenseStatus: o.licenseStatus,
    maxTournaments: o.maxTournaments,
    notes: o.notes,
    hasPassword: !!o.passwordHash,
    phoneVerified: o.phoneVerified === true && !incomplete,
    phoneVerifiedAt: o.phoneVerifiedAt?.toISOString() ?? null,
    phoneStatus: organizerPhoneStatusLabel({
      mobile: displayOrganizerMobile(o.mobile),
      phoneVerified: o.phoneVerified === true && !incomplete,
    }),
    /** @deprecated use incompleteProfile — kept for existing clients */
    needsMobile: incomplete,
    incompleteProfile: incomplete,
    createdAt: o.createdAt.toISOString(),
  };
};

function verifiedPhoneFields(now = new Date()) {
  return {
    phoneVerified: true as const,
    phoneVerifiedAt: now,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === "23505";
}

// ─── Admin Login ──────────────────────────────────────────────────────────────

router.post("/auth/admin/login", authLimiter, (req, res) => {
  const masterPw = getAdminPassword();
  const dataPw = getAdminDataPassword();

  const body = z.object({ password: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { password } = body.data;

  if (masterPw && safeCompare(password, masterPw)) {
    setAuthCookie(res, { isAdmin: true, adminLevel: "master", organizer: req.jwtUser.organizer ?? {} });
    auditLog(req, {
      category: "auth",
      action: "auth.admin_login",
      summary: "Master admin logged in",
      actor: { type: "master_admin", id: "master", label: "Master Admin" },
    });
    res.json({ success: true, adminLevel: "master" });
    return;
  }

  if (dataPw && safeCompare(password, dataPw)) {
    setAuthCookie(res, { isAdmin: true, adminLevel: "data_entry", organizer: req.jwtUser.organizer ?? {} });
    auditLog(req, {
      category: "auth",
      action: "auth.admin_login",
      summary: "Data entry admin logged in",
      actor: { type: "data_entry_admin", id: "data_entry", label: "Data Entry Admin" },
    });
    res.json({ success: true, adminLevel: "data_entry" });
    return;
  }

  auditDenied(req, {
    category: "auth",
    action: "auth.admin_login_failed",
    summary: "Failed admin login attempt",
    actor: { type: "public", label: "Unknown" },
  });
  res.status(401).json({ error: "Incorrect password" });
});

router.post("/auth/admin/logout", (req, res) => {
  if (req.jwtUser?.isAdmin) {
    auditLog(req, {
      category: "auth",
      action: "auth.admin_logout",
      summary: "Admin logged out",
    });
  }
  clearAuthCookie(res);
  res.json({ success: true });
});

router.get("/auth/admin/me", (req, res) => {
  const hasAuthCookie = Boolean(req.cookies?.[COOKIE_NAME]);
  if (!req.jwtUser.isAdmin) {
    req.log.info(
      {
        path: "/auth/admin/me",
        hasAuthCookie,
        isAdmin: false,
        host: req.headers.host ?? null,
      },
      "admin/me — not an admin session",
    );
    res.json({
      isAdmin: false,
      adminLevel: null,
      hasAuthCookie,
      host: req.headers.host ?? null,
      hint: "Log in at /admin/login on this same host, then retry.",
      loginPath: "/admin/login",
    });
    return;
  }
  res.json({
    isAdmin: true,
    adminLevel: req.jwtUser.adminLevel ?? "master",
    hasAuthCookie: true,
    host: req.headers.host ?? null,
  });
});

// ─── Unified /auth/me — returns current JWT claims without any DB lookup ───────
// Used by the frontend to restore session state on page load.

router.get("/auth/me", (req, res) => {
  res.json({
    isAdmin: req.jwtUser.isAdmin ?? false,
    adminLevel: req.jwtUser.adminLevel ?? null,
    organizerAccountId: req.jwtUser.organizerAccountId ?? null,
    organizer: req.jwtUser.organizer ?? {},
  });
});

// ─── Organizer (per tournament) ───────────────────────────────────────────────

router.post("/auth/organizer/:tournamentId/login", authLimiter, async (req, res) => {
  const tid = parseInt(String(req.params.tournamentId));
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = z.object({ password: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const masterPw = getAdminPassword();
  const dataPw = getAdminDataPassword();

  if (masterPw && safeCompare(body.data.password, masterPw)) {
    const organizer = { ...(req.jwtUser.organizer ?? {}), [String(tid)]: true as const };
    setAuthCookie(res, { isAdmin: true, adminLevel: "master", organizer, organizerAccountId: req.jwtUser.organizerAccountId });
    auditLog(req, {
      category: "auth",
      action: "auth.tournament_organizer_login",
      summary: `Master admin opened tournament ${tid} organizer session`,
      tournamentId: tid,
      actor: { type: "master_admin", id: "master", label: "Master Admin" },
    });
    res.json({ success: true });
    return;
  }

  if (dataPw && safeCompare(body.data.password, dataPw)) {
    const organizer = { ...(req.jwtUser.organizer ?? {}), [String(tid)]: true as const };
    setAuthCookie(res, { isAdmin: true, adminLevel: "data_entry", organizer, organizerAccountId: req.jwtUser.organizerAccountId });
    auditLog(req, {
      category: "auth",
      action: "auth.tournament_organizer_login",
      summary: `Data entry admin opened tournament ${tid} organizer session`,
      tournamentId: tid,
      actor: { type: "data_entry_admin", id: "data_entry", label: "Data Entry Admin" },
    });
    res.json({ success: true });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  // Organizer-account owners already have access — stamp organizer[tid] like /me (no password).
  if (req.jwtUser.organizer?.[String(tid)]) {
    res.json({ success: true });
    return;
  }
  if (
    req.jwtUser.organizerAccountId != null &&
    tournament.organizerId === req.jwtUser.organizerAccountId
  ) {
    const organizer = { ...(req.jwtUser.organizer ?? {}), [String(tid)]: true as const };
    setAuthCookie(res, { ...req.jwtUser, organizer });
    auditLog(req, {
      category: "auth",
      action: "auth.tournament_organizer_login",
      summary: `Organizer account owner opened tournament ${tid} session`,
      tournamentId: tid,
      resource: { type: "tournament", id: tid },
    });
    res.json({ success: true });
    return;
  }

  if (!tournament.organizerPassword) {
    res.status(403).json({ error: "Organizer access is not yet configured for this tournament." });
    return;
  }
  if (!safeCompare(body.data.password, tournament.organizerPassword)) {
    auditDenied(req, {
      category: "auth",
      action: "auth.tournament_organizer_login_failed",
      summary: `Failed tournament organizer login for tournament ${tid}`,
      tournamentId: tid,
    });
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  const organizer = { ...(req.jwtUser.organizer ?? {}), [String(tid)]: true as const };
  setAuthCookie(res, { ...req.jwtUser, organizer });
  auditLog(req, {
    category: "auth",
    action: "auth.tournament_organizer_login",
    summary: `Tournament organizer logged in for "${tournament.name}"`,
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
  });
  res.json({ success: true });
});

router.post("/auth/organizer/:tournamentId/logout", (req, res) => {
  const tidKey = req.params.tournamentId;
  const tid = parseInt(tidKey);
  const hadAccess = !!req.jwtUser.organizer?.[tidKey];
  const organizer = { ...(req.jwtUser.organizer ?? {}) };
  delete organizer[tidKey];
  setAuthCookie(res, { ...req.jwtUser, isAdmin: undefined, adminLevel: undefined, organizer });
  if (!isNaN(tid) && hadAccess) {
    auditLog(req, {
      category: "auth",
      action: "auth.tournament_organizer_logout",
      summary: `Tournament organizer logged out from tournament ${tid}`,
      tournamentId: tid,
    });
  }
  res.json({ success: true });
});

router.get("/auth/organizer/:tournamentId/me", async (req, res) => {
  const tid = req.params.tournamentId;
  const tidNum = parseInt(tid, 10);

  if (
    req.organizerAccountLicenseStatus &&
    isOrganizerAccountLocked(req.organizerAccountLicenseStatus)
  ) {
    res.json({ isOrganizer: false, accountLocked: true });
    return;
  }

  if (req.jwtUser.isAdmin || (req.jwtUser.organizer && req.jwtUser.organizer[tid])) {
    res.json({ isOrganizer: true });
    return;
  }

  if (req.jwtUser.organizerAccountId && !isNaN(tidNum)) {
    const [tournament] = await db
      .select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tidNum))
      .limit(1);
    if (tournament?.organizerId === req.jwtUser.organizerAccountId) {
      const updatedOrgMap = { ...(req.jwtUser.organizer ?? {}), [tid]: true as const };
      setAuthCookie(res, { ...req.jwtUser, organizer: updatedOrgMap });
      res.json({ isOrganizer: true });
      return;
    }
  }

  res.json({ isOrganizer: false });
});

// ─── Set organizer password (organizer only — admin cannot set this) ──────────

router.patch("/auth/organizer/:tournamentId/password", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const tidStr = String(tid);
  let isOrganizer = !!(req.jwtUser.organizer && req.jwtUser.organizer[tidStr]);
  if (!isOrganizer && req.jwtUser.organizerAccountId) {
    const [tournament] = await db
      .select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid))
      .limit(1);
    if (tournament?.organizerId === req.jwtUser.organizerAccountId) {
      isOrganizer = true;
      const updatedOrgMap = { ...(req.jwtUser.organizer ?? {}), [tidStr]: true as const };
      setAuthCookie(res, { ...req.jwtUser, organizer: updatedOrgMap });
    }
  }
  if (!isOrganizer) { res.status(401).json({ error: "Not authorised" }); return; }
  const body = z.object({ password: z.string().min(4) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Password must be at least 4 characters" }); return; }
  await db.update(tournamentsTable).set({ organizerPassword: body.data.password }).where(eq(tournamentsTable.id, tid));
  res.json({ success: true });
});

// ─── Admin: List all tournaments ──────────────────────────────────────────────

router.get("/auth/admin/tournaments", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tournaments = await db.select().from(tournamentsTable).orderBy(tournamentsTable.createdAt);
  res.json(tournaments.map(t => ({
    id: t.id,
    name: t.name,
    sport: t.sport,
    status: t.status,
    licenseStatus: t.licenseStatus,
    adminLocked: t.adminLocked,
    organizerId: t.organizerId,
    organizerName: t.organizerName,
    organizerMobile: t.organizerMobile,
    organizerEmail: t.organizerEmail,
    hasPassword: !!t.organizerPassword,
    auctionDate: t.auctionDate ?? null,
    auctionTime: t.auctionTime ?? null,
    createdAt: t.createdAt.toISOString(),
  })));
});

// ─── Admin: Create tournament ─────────────────────────────────────────────────

router.post("/auth/admin/tournaments", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const schema = z.object({
    name: z.string().min(1),
    sport: z.string().default("cricket"),
    city: z.string().trim().min(1, "City is required"),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    auctionTime: z.string().optional(),
    organizerId: z.number().int().optional(),
    organizerName: z.string().optional(),
    organizerMobile: z.string().optional(),
    organizerEmail: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    timerSeconds: z.number().int().optional(),
    bidTimerSeconds: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;

  if (!await isKnownActiveSportSlug(d.sport)) {
    res.status(400).json({ error: "Unknown or inactive sport" });
    return;
  }

  let organizerMobile: string | null | undefined = d.organizerMobile;
  if (d.organizerMobile !== undefined) {
    const trimmed = d.organizerMobile.trim();
    if (trimmed) {
      const mobileParsed = parseIndianMobile(trimmed);
      if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
      organizerMobile = mobileParsed.normalized;
    } else {
      organizerMobile = null;
    }
  }

  const auctionCode = await _generateUniqueAuctionCode(d.name, d.auctionDate);
  const [t] = await db.insert(tournamentsTable).values({
    name: d.name,
    sport: d.sport,
    sportId: await resolveSportIdBySlug(d.sport),
    auctionCode,
    city: d.city,
    venue: d.venue,
    auctionDate: d.auctionDate,
    auctionTime: d.auctionTime ?? null,
    organizerId: d.organizerId ?? null,
    organizerName: d.organizerName,
    organizerMobile,
    organizerEmail: d.organizerEmail,
    basePurse: d.basePurse ?? 10000000,
    minBid: d.minBid ?? 100000,
    bidTiers: DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
    timerSeconds: d.timerSeconds ?? DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
    bidTimerSeconds: d.bidTimerSeconds ?? DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
    playerSelectionMode: DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
    minimumSquadSize: 0,
    maximumSquadSize: 0,
  }).returning();

  notifyAsync("TOURNAMENT_CREATED", {
    tournamentId: t.id,
    tournamentName: t.name,
    sport: t.sport,
    auctionCode: t.auctionCode,
    auctionDate: t.auctionDate,
    auctionTime: t.auctionTime,
    city: t.city,
    venue: t.venue,
    organizerName: t.organizerName,
    organizerEmail: t.organizerEmail,
    organizerMobile: t.organizerMobile,
    organizerId: t.organizerId,
  });
  notifyAdminTournamentCreated(t);

  res.json({ success: true, id: t.id });
});

// ─── Admin: Delete tournament ─────────────────────────────────────────────────

router.delete("/auth/admin/tournaments/:tournamentId", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [beforeTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!beforeTournament) { res.status(404).json({ error: "Not found" }); return; }
  const { adminDeleteTournamentCascade } = await import("../lib/admin-delete-tournament");
  const deleted = await adminDeleteTournamentCascade(tid);
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  auditLog(req, {
    category: "admin",
    action: "tournament.admin_deleted",
    summary: `Admin deleted tournament "${beforeTournament.name}" and all tournament-scoped data`,
    severity: "critical",
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    before: snapshotTournament(beforeTournament),
    alertKey: "tournament_admin_deleted",
  });
  res.json({ success: true });
});

// ─── Admin: Grant license (master only) ───────────────────────────────────────

router.post("/auth/admin/tournaments/:tournamentId/grant-license", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Only the master admin can grant licenses" }); return; }
  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [before] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const [t] = await db.update(tournamentsTable)
    .set({ licenseStatus: "active", licenseGrantedAt: new Date(), licenseGrantedBy: "master" })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  auditLog(req, {
    category: "admin",
    action: "tournament.license_granted",
    summary: `License granted for tournament "${t.name}"`,
    severity: "critical",
    reason: reasonResult.reason,
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    before: before ? snapshotTournament(before) : null,
    after: snapshotTournament(t),
    alertKey: "license_granted",
  });
  res.json({ success: true });
});

// ─── Admin: Revoke license (master only) ──────────────────────────────────────

router.post("/auth/admin/tournaments/:tournamentId/revoke-license", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Only the master admin can revoke licenses" }); return; }
  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [before] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const [t] = await db.update(tournamentsTable)
    .set({ licenseStatus: "trial", licenseGrantedAt: null, licenseGrantedBy: null })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  auditLog(req, {
    category: "admin",
    action: "tournament.license_revoked",
    summary: `License revoked for tournament "${t.name}"`,
    severity: "critical",
    reason: reasonResult.reason,
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    before: before ? snapshotTournament(before) : null,
    after: snapshotTournament(t),
    alertKey: "license_revoked",
  });
  res.json({ success: true });
});

// ─── Admin: Lock / Unlock ─────────────────────────────────────────────────────

router.post("/auth/admin/tournaments/:tournamentId/lock", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [before] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const [t] = await db.update(tournamentsTable)
    .set({ adminLocked: true, adminLockedAt: new Date(), status: "completed" })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  auditLog(req, {
    category: "admin",
    action: "tournament.locked",
    summary: `Tournament "${t.name}" locked by admin`,
    severity: "warning",
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    before: before ? snapshotTournament(before) : null,
    after: snapshotTournament(t),
    alertKey: "tournament_locked",
  });
  res.json({ success: true });
});

router.post("/auth/admin/tournaments/:tournamentId/unlock", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [before] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const [t] = await db.update(tournamentsTable)
    .set({ adminLocked: false, adminLockedAt: null })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  auditLog(req, {
    category: "admin",
    action: "tournament.unlocked",
    summary: `Tournament "${t.name}" unlocked by admin`,
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    before: before ? snapshotTournament(before) : null,
    after: snapshotTournament(t),
  });
  res.json({ success: true });
});

// ─── Admin: Full tournament detail ────────────────────────────────────────────

router.get("/auth/admin/tournaments/:tournamentId/detail", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { teamsTable, playersTable, bidsTable, categoriesTable } = await import("@workspace/db");

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid));
  const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, tid));
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, tid));

  const { desc } = await import("drizzle-orm");
  const recentBids = await db.select().from(bidsTable)
    .where(eq(bidsTable.tournamentId, tid))
    .orderBy(desc(bidsTable.timestamp))
    .limit(50);

  const bidDetails = await Promise.all(recentBids.map(async bid => {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
    return {
      id: bid.id,
      amount: bid.amount,
      timestamp: bid.timestamp.toISOString(),
      playerName: player?.name ?? null,
      teamName: team?.name ?? null,
      teamColor: team?.color ?? null,
    };
  }));

  res.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      sport: tournament.sport,
      city: tournament.city,
      venue: tournament.venue,
      auctionDate: tournament.auctionDate,
      auctionTime: tournament.auctionTime ?? null,
      organizerId: tournament.organizerId,
      organizerName: tournament.organizerName,
      organizerMobile: tournament.organizerMobile,
      organizerEmail: tournament.organizerEmail,
      status: tournament.status,
      licenseStatus: tournament.licenseStatus,
      adminLocked: tournament.adminLocked,
      licenseGrantedAt: tournament.licenseGrantedAt?.toISOString() ?? null,
      adminLockedAt: tournament.adminLockedAt?.toISOString() ?? null,
      basePurse: tournament.basePurse,
      minBid: tournament.minBid,
      timerSeconds: tournament.timerSeconds,
      bidTimerSeconds: tournament.bidTimerSeconds,
      playerSelectionMode: tournament.playerSelectionMode,
      bidTiers: tournament.bidTiers,
      hasPassword: !!tournament.organizerPassword,
      organizerPassword: tournament.organizerPassword ?? null,
      resetCount: tournament.resetCount ?? 0,
      lastResetAt: tournament.lastResetAt ? tournament.lastResetAt.toISOString() : null,
      lastResetBy: tournament.lastResetBy ?? null,
      cheerMessagesEnabled: tournament.cheerMessagesEnabled ?? true,
      cheerMessagePresets: tournament.cheerMessagePresets ?? null,
      localModeEnabled: tournament.localModeEnabled ?? false,
      scoringEnabled: tournament.scoringEnabled ?? false,
      features: resolveTournamentFeatures(tournament.featuresJson),
      createdAt: tournament.createdAt.toISOString(),
    },
    teams: teams.map(t => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      ownerName: t.ownerName,
      color: t.color,
      logoUrl: t.logoUrl,
      purse: t.purse,
      purseUsed: t.purseUsed,
    })),
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      status: p.status,
      basePrice: p.basePrice,
      soldPrice: p.soldPrice,
      teamId: p.teamId,
      categoryId: p.categoryId,
    })),
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      minBid: c.minBid,
    })),
    playerCounts: {
      total: players.length,
      available: players.filter(p => p.status === "available").length,
      sold: players.filter(p => p.status === "sold").length,
      unsold: players.filter(p => p.status === "unsold").length,
      retained: players.filter(p => (p.status as string) === "retained").length,
    },
    recentBids: bidDetails,
  });
});

// ─── Admin: Update tournament ─────────────────────────────────────────────────

router.patch("/auth/admin/tournaments/:tournamentId", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    name: z.string().optional(),
    sport: z.string().optional(),
    city: z.string().trim().min(1).optional(),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    auctionTime: z.string().nullable().optional(),
    organizerId: z.number().int().nullable().optional(),
    organizerName: z.string().optional(),
    organizerMobile: z.string().optional(),
    organizerEmail: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    bidTimerSeconds: z.number().int().optional(),
    timerSeconds: z.number().int().optional(),
    playerSelectionMode: z.string().optional(),
    status: z.enum(TOURNAMENT_LIFECYCLE_STATUSES).optional(),
    bidTiers: z.string().optional(),
    localModeEnabled: z.boolean().optional(),
    scoringEnabled: z.boolean().optional(),
    features: z.object({
      buzzStudio: z.boolean().optional(),
      allowCreativeDownloads: z.boolean().optional(),
      allowPlayerDownloads: z.boolean().optional(),
      watermarkRequired: z.boolean().optional(),
      ownerApp: z.boolean().optional(),
      scoring: z.boolean().optional(),
      sponsorshipHub: z.boolean().optional(),
      analytics: z.boolean().optional(),
    }).optional(),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const configFields = tournamentConfigFieldsChanged(d as Record<string, unknown>);
  if (configFields.length > 0) {
    const reasonResult = parseAuditReason(req.body, true);
    if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }
  }
  const [beforeTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const updates: Record<string, unknown> = {};
  if (d.sport !== undefined) {
    if (!await isKnownActiveSportSlug(d.sport)) {
      res.status(400).json({ error: "Unknown or inactive sport" });
      return;
    }
    updates.sport = d.sport;
    updates.sportId = await resolveSportIdBySlug(d.sport);
  }
  const nextSport =
    typeof updates.sport === "string" ? updates.sport : (beforeTournament?.sport ?? "cricket");
  const nextScoringEnabled =
    d.scoringEnabled !== undefined
      ? d.scoringEnabled
      : (beforeTournament?.scoringEnabled ?? false);
  if (nextScoringEnabled && !isScoringSupportedSport(nextSport)) {
    res.status(400).json({
      error: "Match scoring can only be enabled for cricket or badminton tournaments.",
    });
    return;
  }
  if (d.name !== undefined) updates.name = d.name;
  if (d.organizerId !== undefined) updates.organizerId = d.organizerId;
  if (d.organizerName !== undefined) updates.organizerName = d.organizerName;
  if (d.organizerMobile !== undefined) {
    const trimmed = d.organizerMobile.trim();
    if (trimmed) {
      const mobileParsed = parseIndianMobile(trimmed);
      if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
      updates.organizerMobile = mobileParsed.normalized;
    } else {
      updates.organizerMobile = "";
    }
  }
  if (d.organizerEmail !== undefined) updates.organizerEmail = d.organizerEmail;
  if (d.city !== undefined) updates.city = d.city;
  if (d.venue !== undefined) updates.venue = d.venue;
  if (d.auctionDate !== undefined) updates.auctionDate = d.auctionDate;
  if (d.auctionTime !== undefined) updates.auctionTime = d.auctionTime;
  if (d.status !== undefined) updates.status = d.status;
  if (d.bidTimerSeconds !== undefined) updates.bidTimerSeconds = d.bidTimerSeconds;
  if (d.timerSeconds !== undefined) updates.timerSeconds = d.timerSeconds;
  if (d.basePurse !== undefined) updates.basePurse = d.basePurse;
  if (d.minBid !== undefined) updates.minBid = d.minBid;
  if (d.playerSelectionMode !== undefined) updates.playerSelectionMode = d.playerSelectionMode;
  if (d.bidTiers !== undefined) updates.bidTiers = d.bidTiers;
  if (d.localModeEnabled !== undefined) updates.localModeEnabled = d.localModeEnabled;
  if (d.scoringEnabled !== undefined) {
    updates.scoringEnabled = d.scoringEnabled;
    updates.scoringPhase = d.scoringEnabled ? "active" : "disabled";
  }
  if (d.features !== undefined) {
    updates.featuresJson = mergeTournamentFeatures(beforeTournament?.featuresJson, d.features);
  }

  // Auto-link organizer account by mobile or email when those fields are set
  let autoLinkedOrganizer: { id: number; name: string } | null = null;
  if (d.organizerId === undefined) {
    const linkedMobile = typeof updates.organizerMobile === "string" ? updates.organizerMobile : "";
    if (d.organizerMobile !== undefined && linkedMobile) {
      const { organizer } = await findOrganizerByMobileInput(linkedMobile);
      if (organizer) { updates.organizerId = organizer.id; autoLinkedOrganizer = { id: organizer.id, name: organizer.name }; }
    } else if (d.organizerEmail !== undefined && d.organizerEmail.trim()) {
      const rows = await db.select().from(organizersTable).where(eq(organizersTable.email, d.organizerEmail.trim()));
      if (rows[0]) { updates.organizerId = rows[0].id; autoLinkedOrganizer = { id: rows[0].id, name: rows[0].name }; }
    }
  }

  const [tournament] = await db.update(tournamentsTable).set(updates).where(eq(tournamentsTable.id, tid)).returning();
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  // When admin changes status away from "completed", unblock the auction session so
  // the frontend stops treating it as finished. "idle" means the session exists but
  // no auction is running — the operator can start fresh from the operator panel.
  if (d.status !== undefined && d.status !== "completed") {
    await db
      .update(auctionSessionsTable)
      .set({
        status: "idle",
        lastAction: `Status changed to "${d.status}" by admin — auction session reopened`,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
  }

  const reasonResult = parseAuditReason(req.body, configFields.length > 0);
  auditLog(req, {
    category: configFields.length > 0 ? "tournament" : "admin",
    action: configFields.length > 0 ? "tournament.config_updated" : "tournament.admin_updated",
    summary: `Admin updated tournament "${tournament.name}"`,
    severity: configFields.length > 0 ? "critical" : "info",
    reason: reasonResult.ok ? reasonResult.reason : null,
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    before: beforeTournament ? snapshotTournament(beforeTournament) : null,
    after: snapshotTournament(tournament),
    metadata: { changedFields: Object.keys(updates), configFields },
    alertKey: configFields.length > 0 ? "tournament_config_changed" : null,
  });

  res.json({ success: true, id: tournament.id, linkedOrganizerId: autoLinkedOrganizer?.id ?? null, linkedOrganizerName: autoLinkedOrganizer?.name ?? null });
});

// ─── Admin: Explicitly link/unlink organizer to tournament ────────────────────

router.post("/auth/admin/tournaments/:tournamentId/link-organizer", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = z.object({ organizerId: z.number().int().nullable() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [tournament] = await db.update(tournamentsTable)
    .set({ organizerId: body.data.organizerId })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  let linkedOrganizer: { id: number; name: string } | null = null;
  if (body.data.organizerId !== null) {
    const rows = await db.select().from(organizersTable).where(eq(organizersTable.id, body.data.organizerId));
    if (rows[0]) linkedOrganizer = { id: rows[0].id, name: rows[0].name };
  }
  auditLog(req, {
    category: "admin",
    action: "tournament.organizer_linked",
    summary: linkedOrganizer
      ? `Organizer "${linkedOrganizer.name}" linked to tournament "${tournament.name}"`
      : `Organizer unlinked from tournament "${tournament.name}"`,
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    metadata: { organizerId: body.data.organizerId },
  });
  res.json({ success: true, id: tournament.id, linkedOrganizerId: linkedOrganizer?.id ?? null, linkedOrganizerName: linkedOrganizer?.name ?? null });
});

// ─── Admin: List all organizer accounts ──────────────────────────────────────

router.get("/auth/admin/organizers", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const organizers = await db.select().from(organizersTable).orderBy(organizersTable.createdAt);
  const tournaments = await db.select().from(tournamentsTable);
  const result = organizers.map(o => ({
    ...organizerToJson(o),
    tournamentCount: tournaments.filter(t => t.organizerId === o.id).length,
  }));
  res.json(result);
});

// ─── Admin: Update organizer account ─────────────────────────────────────────

router.patch("/auth/admin/organizers/:id", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const schema = z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    mobile: z.string().optional(),
    licenseStatus: z.enum(["pending", "active", "suspended"]).optional(),
    maxTournaments: z.number().int().min(0).optional(),
    notes: z.string().optional(),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;

  if (d.licenseStatus !== undefined) {
    const reasonResult = parseAuditReason(req.body, true);
    if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }
  }

  const [beforeOrganizer] = await db.select().from(organizersTable).where(eq(organizersTable.id, id));
  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) updates.name = d.name;
  if (d.email !== undefined) updates.email = d.email;
  if (d.mobile !== undefined) {
    const mobileParsed = parseIndianMobile(d.mobile);
    if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
    if (await organizerNormalizedMobileTaken(mobileParsed.normalized, id)) {
      res.status(409).json({ error: "An account with this mobile number already exists." });
      return;
    }
    updates.mobile = mobileParsed.normalized;
    // Admin override marks phone verified (audited) — ops exception to OTP path.
    Object.assign(updates, verifiedPhoneFields());
  }
  if (d.licenseStatus !== undefined) updates.licenseStatus = d.licenseStatus;
  if (d.maxTournaments !== undefined) updates.maxTournaments = d.maxTournaments;
  if (d.notes !== undefined) updates.notes = d.notes;

  const [updated] = await db.update(organizersTable).set(updates).where(eq(organizersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const reasonResult = parseAuditReason(req.body, d.licenseStatus !== undefined);
  auditLog(req, {
    category: "admin",
    action: d.licenseStatus !== undefined ? "admin.organizer_suspended" : "admin.organizer_updated",
    summary: d.licenseStatus !== undefined
      ? `Organizer "${updated.name}" license status set to ${d.licenseStatus}`
      : `Organizer "${updated.name}" updated by admin`,
    severity: d.licenseStatus === "suspended" ? "critical" : "info",
    reason: reasonResult.ok ? reasonResult.reason : null,
    resource: { type: "organizer", id: id },
    before: beforeOrganizer ? snapshotOrganizer(beforeOrganizer) : null,
    after: snapshotOrganizer(updated),
    alertKey: d.licenseStatus === "suspended" ? "organizer_suspended" : null,
  });
  res.json({ success: true, organizer: organizerToJson(updated) });
});

// ─── Admin: Delete organizer account ─────────────────────────────────────────

router.delete("/auth/admin/organizers/:id", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Only the master admin can delete organizer accounts" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.update(tournamentsTable).set({ organizerId: null }).where(eq(tournamentsTable.organizerId, id));
  const [deleted] = await db.delete(organizersTable).where(eq(organizersTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  auditLog(req, {
    category: "admin",
    action: "admin.organizer_deleted",
    summary: `Organizer account "${deleted.name}" deleted`,
    severity: "critical",
    resource: { type: "organizer", id: id },
    before: snapshotOrganizer(deleted),
    alertKey: "organizer_deleted",
  });
  res.json({ success: true });
});

// ─── Organizer Account (self-service portal) ──────────────────────────────────

// Step 1: name + email + mobile → send OTP (password only after OTP — step 3)
router.post("/auth/organizer-account/signup/send-otp", otpSendLimiter, async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    mobile: z.string().min(7),
    email: z.string().email(),
  }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Name, email, and mobile number are required." });
    return;
  }

  const { name, mobile: rawMobile, email } = body.data;

  const mobileParsed = parseIndianMobile(rawMobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
  const mobile = mobileParsed.normalized;

  if (await organizerNormalizedMobileTaken(mobile)) {
    res.status(409).json({ error: "An account with this mobile number already exists." });
    return;
  }
  const [emailExists] = await db
    .select({ id: organizersTable.id })
    .from(organizersTable)
    .where(eq(organizersTable.email, email))
    .limit(1);
  if (emailExists) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const payload = JSON.stringify({ name, mobile, email });
  const result = await bulkSmsOtpSend(mobile, "signup", payload);
  if (!result.success) {
    res.status(503).json({ error: result.error ?? "Failed to send OTP. Please try again." });
    return;
  }

  setOAuthCookie(res, {
    ...req.oauthState,
    pendingEmailSignup: { name, email, mobile, otpVerified: false },
  });

  auditLog(req, {
    category: "auth",
    action: "auth.organizer_signup_otp_sent",
    summary: `Signup OTP sent for ${email}`,
    metadata: { mobile, email },
  });

  res.json({ success: true });
});

// Public config flags used by the organizer portal UI
router.get("/auth/config", (_req, res) => {
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY?.trim() || null;
  res.json({
    smsOtpEnabled: process.env.SMS_OTP_ENABLED === "true",
    turnstileSiteKey,
    /** Email signup requires mobile OTP; placeholder eml: accounts are no longer created. */
    emailSignupRequiresMobileOtp: true,
  });
});

// Progressive login guard status (UX hint — enforcement is on POST login)
router.get("/auth/organizer-account/login/status", (req, res) => {
  const identifier = String(req.query.identifier ?? "");
  const guard = getLoginGuardStatus(req, identifier, {
    includeCaptcha: true,
  });
  res.json(guard);
});

/**
 * Email signup entry — Phase 1: always requires mobile + OTP send.
 * Does not create an account. Password is collected only after OTP verify.
 */
router.post("/auth/organizer-account/signup/email", otpSendLimiter, async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    mobile: z.string().min(7),
  }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "Name, email, and mobile number are required. Password is set after OTP verification.",
    });
    return;
  }

  // Reuse send-otp logic by forwarding body shape
  const mobileParsed = parseIndianMobile(body.data.mobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
  const mobile = mobileParsed.normalized;
  const { name, email } = body.data;

  if (await organizerNormalizedMobileTaken(mobile)) {
    res.status(409).json({ error: "An account with this mobile number already exists." });
    return;
  }
  const [emailExists] = await db
    .select({ id: organizersTable.id })
    .from(organizersTable)
    .where(eq(organizersTable.email, email))
    .limit(1);
  if (emailExists) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const result = await bulkSmsOtpSend(mobile, "signup", JSON.stringify({ name, mobile, email }));
  if (!result.success) {
    res.status(503).json({ error: result.error ?? "Failed to send OTP. Please try again." });
    return;
  }

  setOAuthCookie(res, {
    ...req.oauthState,
    pendingEmailSignup: { name, email, mobile, otpVerified: false },
  });

  auditLog(req, {
    category: "auth",
    action: "auth.organizer_signup_otp_sent",
    summary: `Email signup OTP sent for ${email}`,
    metadata: { mobile, email },
  });

  res.json({ success: true, step: "otp" });
});

// Step 2: verify OTP — marks pending signup as verified (no account yet)
router.post("/auth/organizer-account/signup/verify", otpVerifyLimiter, async (req, res) => {
  const body = z.object({
    mobile: z.string().min(7),
    otp: z.string().length(6),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Mobile and 6-digit OTP required" }); return; }

  const { mobile: rawMobile, otp } = body.data;

  const mobileParsed = parseIndianMobile(rawMobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
  const mobile = mobileParsed.normalized;

  const result = await bulkSmsOtpVerify(mobile, otp, "signup");
  if (!result.success) {
    auditDenied(req, {
      category: "auth",
      action: "auth.organizer_signup_otp_failed",
      summary: "Signup OTP verification failed",
      metadata: { mobile },
    });
    res.status(400).json({ error: result.error ?? "Invalid or expired OTP" });
    return;
  }

  let pending = req.oauthState.pendingEmailSignup;
  if (result.payload) {
    try {
      const parsed = JSON.parse(result.payload) as { name: string; mobile: string; email: string };
      pending = {
        name: parsed.name,
        email: parsed.email,
        mobile: parsed.mobile,
        otpVerified: true,
      };
    } catch {
      /* keep cookie pending */
    }
  }

  if (!pending || pending.mobile !== mobile) {
    res.status(400).json({ error: "Signup session expired — please start over" });
    return;
  }

  if (await organizerNormalizedMobileTaken(mobile)) {
    res.status(409).json({ error: "An account with this mobile number already exists." });
    return;
  }

  setOAuthCookie(res, {
    ...req.oauthState,
    pendingEmailSignup: { ...pending, mobile, otpVerified: true },
  });

  auditLog(req, {
    category: "auth",
    action: "auth.organizer_signup_otp_verified",
    summary: `Signup OTP verified for ${pending.email}`,
    metadata: { mobile, email: pending.email },
  });

  res.json({
    success: true,
    step: "password",
    email: pending.email,
    mobile,
    name: pending.name,
  });
});

// Step 3: set password after OTP — creates the account (no eml: placeholders)
router.post("/auth/organizer-account/signup/complete", authLimiter, async (req, res) => {
  const body = z.object({
    password: z.string().min(6),
  }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  const pending = req.oauthState.pendingEmailSignup;
  if (!pending?.otpVerified) {
    res.status(401).json({
      error: "Verify your mobile number with OTP before creating a password.",
      code: "OTP_REQUIRED",
    });
    return;
  }

  const mobileParsed = parseIndianMobile(pending.mobile);
  if (!mobileParsed.ok) {
    res.status(400).json({ error: "Signup session has an invalid mobile — please start over" });
    return;
  }
  const mobile = mobileParsed.normalized;

  if (await organizerNormalizedMobileTaken(mobile)) {
    res.status(409).json({ error: "An account with this mobile number already exists." });
    return;
  }
  const [emailExists] = await db
    .select({ id: organizersTable.id })
    .from(organizersTable)
    .where(eq(organizersTable.email, pending.email))
    .limit(1);
  if (emailExists) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await hashPassword(body.data.password);
  const now = new Date();

  let organizer: typeof organizersTable.$inferSelect;
  try {
    [organizer] = await db.insert(organizersTable).values({
      name: pending.name,
      email: pending.email,
      mobile,
      passwordHash,
      licenseStatus: "active",
      maxTournaments: 1,
      ...verifiedPhoneFields(now),
    }).returning();
  } catch (insertErr) {
    if (isUniqueViolation(insertErr)) {
      res.status(409).json({ error: "An account with this email or mobile already exists." });
      return;
    }
    throw insertErr;
  }

  clearOAuthCookie(res);

  await claimTournamentsForOrganizer(organizer.id, {
    mobile: organizer.mobile,
    email: organizer.email,
  });

  const orgMap: Record<string, true> = { ...(req.jwtUser.organizer ?? {}) };
  const myTournaments = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.organizerId, organizer.id));
  for (const t of myTournaments) orgMap[String(t.id)] = true;

  setAuthCookie(res, { ...req.jwtUser, organizerAccountId: organizer.id, organizer: orgMap });
  triggerOrganiserRegisteredNotification(organizer);
  auditLog(req, {
    category: "auth",
    action: "auth.organizer_registered",
    summary: `Organizer "${organizer.name}" registered with verified mobile`,
    actor: { type: "organizer_account", id: String(organizer.id), label: organizer.name },
    after: snapshotOrganizer(organizer),
    metadata: { phoneVerified: true, method: "email_mobile_otp" },
  });
  res.json({ success: true, organizer: organizerToJson(organizer) });
});

router.get("/auth/organizer-account/signup/status", (req, res) => {
  const pending = req.oauthState.pendingEmailSignup;
  if (!pending) {
    res.json({ ready: false });
    return;
  }
  res.json({
    ready: true,
    step: pending.otpVerified ? "password" : "otp",
    email: pending.email,
    mobile: pending.mobile,
    name: pending.name,
  });
});

router.post("/auth/organizer-account/login", async (req, res) => {
  const body = z.object({
    identifier: z.string().min(1),
    password: z.string().min(1),
    turnstileToken: z.string().optional(),
    captchaId: z.string().optional(),
    captchaAnswer: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { identifier: rawIdentifier, password, turnstileToken, captchaId, captchaAnswer } = body.data;

  const guardCheck = await checkLoginAttemptAllowed(req, rawIdentifier, {
    turnstileToken,
    captchaId,
    captchaAnswer,
  });
  if (!guardCheck.allowed) {
    res.status(guardCheck.status).json({ error: guardCheck.error, loginGuard: guardCheck.guard });
    return;
  }

  const trimmed = rawIdentifier.trim();
  const mobileParsed = parseIndianMobile(trimmed);
  const lookupMobile = mobileParsed.ok ? mobileParsed.normalized : trimmed;
  const lookupEmail = trimmed.toLowerCase();

  const rows = await db.select().from(organizersTable).where(
    or(eq(organizersTable.mobile, lookupMobile), eq(organizersTable.email, lookupEmail))
  );
  const organizer = rows[0];

  if (!organizer) {
    const loginGuard = recordLoginFailure(req, rawIdentifier);
    res.status(401).json({ error: "No account found with that mobile or email.", loginGuard });
    return;
  }
  if (!organizer.passwordHash) {
    const loginGuard = recordLoginFailure(req, rawIdentifier);
    res.status(401).json({
      error: "This account uses Google Sign-In. Please use the 'Continue with Google' button.",
      loginGuard,
    });
    return;
  }

  const valid = await verifyPassword(password, organizer.passwordHash);
  if (!valid) {
    const loginGuard = recordLoginFailure(req, rawIdentifier);
    res.status(401).json({ error: "Incorrect password.", loginGuard });
    return;
  }

  clearLoginFailures(req, rawIdentifier);

  await claimTournamentsForOrganizer(organizer.id, {
    mobile: organizer.mobile,
    email: organizer.email,
  });

  const orgMap: Record<string, true> = { ...(req.jwtUser.organizer ?? {}) };
  const myTournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerId, organizer.id));
  for (const t of myTournaments) orgMap[String(t.id)] = true;

  setAuthCookie(res, { ...req.jwtUser, organizerAccountId: organizer.id, organizer: orgMap });
  auditLog(req, {
    category: "auth",
    action: "auth.organizer_login",
    summary: `Organizer "${organizer.name}" logged in`,
    actor: { type: "organizer_account", id: String(organizer.id), label: organizer.name },
  });
  // Include tournaments in the login response so the frontend can skip the
  // extra GET /me round-trip after login (which is the slow Neon cold-start call).
  res.json({
    success: true,
    organizer: organizerToJson(organizer),
    tournaments: myTournaments.map(t => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      status: t.status,
      licenseStatus: t.licenseStatus,
      city: t.city ?? null,
      venue: t.venue ?? null,
      auctionDate: t.auctionDate ?? null,
      auctionTime: t.auctionTime ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

router.get("/auth/organizer-account/me", async (req, res) => {
  if (!req.jwtUser.organizerAccountId) {
    res.json({ loggedIn: false });
    return;
  }
  const [organizer] = await db.select().from(organizersTable).where(eq(organizersTable.id, req.jwtUser.organizerAccountId));
  if (!organizer) {
    clearAuthCookie(res);
    res.json({ loggedIn: false });
    return;
  }
  const tournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerId, organizer.id));
  res.json({
    loggedIn: true,
    organizer: organizerToJson(organizer),
    tournaments: tournaments.map(t => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      status: t.status,
      licenseStatus: t.licenseStatus,
      city: t.city ?? null,
      venue: t.venue,
      auctionDate: t.auctionDate,
      auctionTime: t.auctionTime ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

router.post("/auth/organizer-account/logout", (req, res) => {
  if (req.jwtUser.organizerAccountId) {
    auditLog(req, {
      category: "auth",
      action: "auth.organizer_logout",
      summary: `Organizer #${req.jwtUser.organizerAccountId} logged out`,
    });
  }
  clearAuthCookie(res);
  res.json({ success: true });
});

// Set backup password — only for accounts without a password (e.g. Google-only users)
router.post("/auth/organizer-account/set-password", async (req, res) => {
  if (!req.jwtUser.organizerAccountId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const body = z.object({ password: z.string().min(6) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Password must be at least 6 characters." }); return; }

  const [organizer] = await db
    .select()
    .from(organizersTable)
    .where(eq(organizersTable.id, req.jwtUser.organizerAccountId));
  if (!organizer) { res.status(401).json({ error: "Account not found" }); return; }
  if (organizer.passwordHash) {
    res.status(409).json({ error: "Use the password reset flow to change your existing password." });
    return;
  }

  const passwordHash = await hashPassword(body.data.password);
  const [updated] = await db
    .update(organizersTable)
    .set({ passwordHash })
    .where(eq(organizersTable.id, organizer.id))
    .returning();
  res.json({ success: true, organizer: organizerToJson(updated) });
});

// ─── Organizer Account: Create tournament ─────────────────────────────────────

router.post("/auth/organizer-account/tournaments", async (req, res) => {
  if (!req.jwtUser.organizerAccountId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const [organizer] = await db.select().from(organizersTable).where(eq(organizersTable.id, req.jwtUser.organizerAccountId));
  if (!organizer) { res.status(401).json({ error: "Account not found" }); return; }
  if (isOrganizerAccountLocked(organizer.licenseStatus)) {
    res.status(403).json({ error: "Your account has been locked. Please contact admin." });
    return;
  }
  if (organizerNeedsPhoneVerification({ mobile: organizer.mobile, phoneVerified: organizer.phoneVerified })) {
    res.status(403).json({
      error: "Complete your mobile verification to continue.",
      code: "PHONE_VERIFICATION_REQUIRED",
      needsMobile: true,
    });
    return;
  }

  const schema = z.object({
    name: z.string().min(1),
    sport: z.string().default("cricket"),
    city: z.string().trim().min(1, "City is required"),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    auctionTime: z.string().optional(),
    basePurse: z.number().int().min(1),
    minBid: z.number().int().min(1),
    bidIncrement: z.number().int().min(1),
    minimumSquadSize: z.number().int().min(1).max(100).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;

  if (!await isKnownActiveSportSlug(d.sport)) {
    res.status(400).json({ error: "Unknown or inactive sport" });
    return;
  }

  const bidTiersJson = JSON.stringify([{ increment: d.bidIncrement }]);

  // Generate unique auction code (TT+NN+DDMM format)
  function buildOrgCode(name: string, auctionDate?: string | null): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const tt = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : (words[0]?.substring(0, 2) ?? "XX").toUpperCase();
    const nn = String(Math.floor(Math.random() * 90) + 10);
    const dt = auctionDate ? new Date(auctionDate) : new Date();
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    return `${tt}${nn}${dd}${mm}`;
  }
  let auctionCode = buildOrgCode(d.name, d.auctionDate);
  for (let i = 0; i < 14; i++) {
    const [dup] = await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(eq(tournamentsTable.auctionCode, auctionCode)).limit(1);
    if (!dup) break;
    auctionCode = buildOrgCode(d.name, d.auctionDate);
  }

  const [tournament] = await db.insert(tournamentsTable).values({
    organizerId: organizer.id,
    name: d.name,
    sport: d.sport,
    sportId: await resolveSportIdBySlug(d.sport),
    auctionCode,
    city: d.city,
    venue: d.venue ?? null,
    auctionDate: d.auctionDate ?? null,
    auctionTime: d.auctionTime ?? null,
    organizerName: organizer.name,
    organizerMobile: organizer.mobile,
    organizerEmail: organizer.email ?? null,
    basePurse: d.basePurse,
    minBid: d.minBid,
    bidTiers: bidTiersJson,
    timerSeconds: DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
    bidTimerSeconds: DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
    playerSelectionMode: DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
    minimumSquadSize: d.minimumSquadSize ?? 0,
    maximumSquadSize: 0,
    licenseStatus: "trial",
  }).returning();

  notifyAsync("TOURNAMENT_CREATED", {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    sport: tournament.sport,
    auctionCode: tournament.auctionCode,
    auctionDate: tournament.auctionDate,
    auctionTime: tournament.auctionTime,
    city: tournament.city,
    venue: tournament.venue,
    organizerName: tournament.organizerName,
    organizerEmail: tournament.organizerEmail,
    organizerMobile: tournament.organizerMobile,
    organizerId: tournament.organizerId,
  });
  notifyAdminTournamentCreated(tournament);

  const updatedOrgMap = { ...(req.jwtUser.organizer ?? {}), [String(tournament.id)]: true as const };
  setAuthCookie(res, { ...req.jwtUser, organizer: updatedOrgMap });

  res.status(201).json({ success: true, tournament: { id: tournament.id, name: tournament.name, auctionCode: tournament.auctionCode } });
});

// ─── OTP: Send code via BulkSMS Gateway ──────────────────────────────────────

router.post("/auth/organizer-account/otp/send", otpSendLimiter, async (req, res) => {
  const body = z.object({ mobile: z.string().min(7) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Mobile number is required" }); return; }

  const mobileParsed = parseIndianMobile(body.data.mobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
  const mobile = mobileParsed.normalized;

  const { organizer } = await findOrganizerByMobileInput(mobile);
  if (!organizer) { res.status(404).json({ error: "No account found with this mobile number" }); return; }

  const result = await bulkSmsOtpSend(mobile, "password_reset");
  if (!result.success) {
    res.status(503).json({ error: result.error ?? "Failed to send OTP. Please try again." }); return;
  }

  res.json({ success: true, message: "OTP sent" });
});

// ─── OTP: Verify code and reset password ─────────────────────────────────────

router.post("/auth/organizer-account/otp/verify", otpVerifyLimiter, async (req, res) => {
  const body = z.object({
    mobile: z.string().min(7),
    code: z.string().length(6),
    newPassword: z.string().min(6),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Mobile, 6-digit code, and new password required" }); return; }

  const { mobile: rawMobile, code, newPassword } = body.data;

  const mobileParsed = parseIndianMobile(rawMobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
  const mobile = mobileParsed.normalized;

  try {
    const result = await bulkSmsOtpVerify(mobile, code, "password_reset");
    if (!result.success) {
      res.status(400).json({ error: result.error ?? "Invalid or expired OTP code" });
      return;
    }

    const { organizer } = await findOrganizerByMobileInput(mobile);
    if (!organizer) { res.status(404).json({ error: "Account not found" }); return; }

    const newHash = await hashPassword(newPassword);
    const [updated] = await db.update(organizersTable).set({ passwordHash: newHash })
      .where(eq(organizersTable.id, organizer.id)).returning();

    if (!updated) {
      res.status(500).json({ error: "Failed to update password. Please try again." });
      return;
    }

    await issueOrganizerAuthCookie(req, res, updated.id);
    res.json({ success: true, organizer: organizerToJson(updated) });
  } catch (err) {
    req.log.error({ err, mobile }, "OTP password reset error");
    res.status(503).json({
      error: "Server is temporarily unavailable. Your OTP may already be verified — tap Verify again or use Resend OTP.",
    });
  }
});

// ─── OTP: Resend code ─────────────────────────────────────────────────────────

router.post("/auth/organizer-account/otp/resend", otpSendLimiter, async (req, res) => {
  const body = z.object({ mobile: z.string().min(7) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Mobile number is required" }); return; }

  const mobileParsed = parseIndianMobile(body.data.mobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }

  const result = await bulkSmsOtpResend(mobileParsed.normalized, "password_reset");
  if (!result.success) {
    res.status(503).json({ error: result.error ?? "Failed to resend OTP" }); return;
  }
  res.json({ success: true });
});

// ─── Admin: SMS notification settings ────────────────────────────────────────

router.get("/auth/admin/sms-settings", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const { smsNotificationSettingsTable } = await import("@workspace/db");
  const [settings] = await db.select().from(smsNotificationSettingsTable).limit(1);
  // Surface which template IDs are configured via env var so the UI can show them
  const envTemplates = {
    playerSoldTemplateIdFromEnv: process.env.BULKSMS_PLAYER_SOLD_TEMPLATE_ID || null,
    teamOwnerTemplateIdFromEnv:  process.env.BULKSMS_TEAM_OWNER_TEMPLATE_ID  || null,
    viewerLinkTemplateIdFromEnv: process.env.BULKSMS_VIEWER_LINK_TEMPLATE_ID || null,
  };
  res.json({
    ...(settings ?? {
      dltEnabled: false,
      teamOwnerEnabled: false,
      teamOwnerTemplateId: null,
      playerSoldEnabled: false,
      playerSoldTemplateId: null,
      viewerLinkEnabled: false,
      viewerLinkTemplateId: null,
    }),
    ...envTemplates,
  });
});

router.patch("/auth/admin/sms-settings", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const schema = z.object({
    dltEnabled: z.boolean().optional(),
    teamOwnerEnabled: z.boolean().optional(),
    teamOwnerTemplateId: z.string().min(1).nullable().optional(),
    playerSoldEnabled: z.boolean().optional(),
    playerSoldTemplateId: z.string().min(1).nullable().optional(),
    viewerLinkEnabled: z.boolean().optional(),
    viewerLinkTemplateId: z.string().min(1).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { smsNotificationSettingsTable } = await import("@workspace/db");
  const [existing] = await db.select({ id: smsNotificationSettingsTable.id })
    .from(smsNotificationSettingsTable).limit(1);

  if (existing) {
    const [updated] = await db
      .update(smsNotificationSettingsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(smsNotificationSettingsTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(smsNotificationSettingsTable)
      .values(parsed.data)
      .returning();
    res.json(created);
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/** Safe post-login redirect — blocks auth/setup pages that would loop back to sign-in. */
function sanitizeOAuthNext(raw: string | undefined): string | undefined {
  if (!raw?.startsWith("/")) return undefined;
  const blocked = new Set(["/complete-profile", "/organizer", "/api"]);
  if (blocked.has(raw) || raw.startsWith("/complete-profile?") || raw.startsWith("/api/")) {
    return undefined;
  }
  return raw;
}

/** Return Google OAuth errors to the originating app (e.g. /mobile login) when possible. */
function googleOAuthErrorRedirect(
  pendingNext: string | undefined,
  error: string,
  extraQuery = "",
  nativeApp?: "android" | "ios",
): string {
  if (nativeApp === "android" || nativeApp === "ios") {
    return `bidwar://oauth-complete?error=${encodeURIComponent(error)}${extraQuery}`;
  }
  if (pendingNext?.startsWith("/mobile")) {
    return `/mobile/organizer/login?error=${error}${extraQuery}`;
  }
  return `/organizer?error=${error}${extraQuery}`;
}

function parseNativeAppParam(raw: unknown): "android" | "ios" | undefined {
  if (raw === "android" || raw === "ios") return raw;
  return undefined;
}

function nativeOAuthSuccessRedirect(organizerAccountId: number): string {
  const handoff = signNativeGoogleHandoffJwt(organizerAccountId);
  return `bidwar://oauth-complete?handoff=${encodeURIComponent(handoff)}`;
}

async function issueOrganizerAuthCookie(
  req: import("express").Request,
  res: import("express").Response,
  organizerId: number,
): Promise<void> {
  const [organizer] = await db
    .select({ mobile: organizersTable.mobile, email: organizersTable.email })
    .from(organizersTable)
    .where(eq(organizersTable.id, organizerId))
    .limit(1);
  if (organizer) {
    await claimTournamentsForOrganizer(organizerId, {
      mobile: organizer.mobile,
      email: organizer.email,
    });
  }

  const writeCookie = async () => {
    const orgMap: Record<string, true> = { ...(req.jwtUser.organizer ?? {}) };
    const myTournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerId, organizerId));
    for (const t of myTournaments) orgMap[String(t.id)] = true;
    setAuthCookie(res, { ...req.jwtUser, organizerAccountId: organizerId, organizer: orgMap });
  };

  try {
    await writeCookie();
  } catch (firstErr) {
    req.log.warn({ err: firstErr, organizerId }, "Auth cookie write failed — retrying once");
    await new Promise((resolve) => setTimeout(resolve, 800));
    await writeCookie();
  }
}

router.get("/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { res.status(503).send("Google login not configured"); return; }
  // Prefer the trusted request host so staging never sends Google back to production.
  const redirectUri = buildPublicUrlForRequest(req.headers, "/api/auth/google/callback");

  // Preserve the ?next= redirect destination through the OAuth round-trip
  const next = sanitizeOAuthNext(req.query.next as string | undefined);
  const nativeApp = parseNativeAppParam(req.query.native_app);

  // Generate a random state token to prevent login CSRF
  const state = randomBytes(32).toString("hex");
  // Store state (+ optional next path) in a short-lived signed cookie — avoids any DB round-trip
  setOAuthCookie(res, {
    state,
    next,
    nativeApp,
    pendingGoogleProfile: req.oauthState.pendingGoogleProfile,
    pendingGoogleMobile: req.oauthState.pendingGoogleMobile,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/auth/google/callback", async (req, res) => {
  if (await tryCompleteGoogleSheetsOAuth(req, res)) return;

  const pendingNext = sanitizeOAuthNext(req.oauthState.next);
  const nativeApp = parseNativeAppParam(req.oauthState.nativeApp);
  const code = req.query.code as string | undefined;
  const returnedState = req.query.state as string | undefined;
  if (!code) {
    res.redirect(googleOAuthErrorRedirect(pendingNext, "google_cancelled", "", nativeApp));
    return;
  }

  // Validate state to prevent login CSRF attacks
  const expectedState = req.oauthState.state;
  if (!expectedState || !returnedState || !safeCompare(expectedState, returnedState)) {
    clearOAuthCookie(res);
    res.redirect(googleOAuthErrorRedirect(pendingNext, "google_state_mismatch", "", nativeApp));
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // Must match the redirect_uri used in /auth/google (request host when trusted).
  const redirectUri = buildPublicUrlForRequest(req.headers, "/api/auth/google/callback");
  if (!clientId || !clientSecret) {
    res.redirect(googleOAuthErrorRedirect(pendingNext, "not_configured", "", nativeApp));
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json() as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokens.access_token) {
      req.log.warn(
        {
          googleError: tokens.error,
          googleErrorDescription: tokens.error_description,
          redirectUri,
        },
        "Google OAuth token exchange failed",
      );
      const errCode =
        tokens.error === "redirect_uri_mismatch"
          ? "google_redirect_mismatch"
          : "google_token_failed";
      const devHint =
        process.env.NODE_ENV !== "production"
          ? `&oauth_redirect_uri=${encodeURIComponent(redirectUri)}`
          : "";
      res.redirect(googleOAuthErrorRedirect(pendingNext, errCode, devHint, nativeApp));
      return;
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await userRes.json() as { email?: string; name?: string; id?: string };
    if (!gUser.email || !gUser.id) {
      res.redirect(googleOAuthErrorRedirect(pendingNext, "no_email", "", nativeApp));
      return;
    }

    // 1. Try to find by googleId (returning user)
    let [organizer] = await db.select().from(organizersTable).where(eq(organizersTable.googleId, gUser.id));

    if (!organizer) {
      // 2. Try to link to existing account by email
      const [existing] = await db.select().from(organizersTable).where(eq(organizersTable.email, gUser.email));
      if (existing) {
        // Link google ID to this existing account
        const [linked] = await db.update(organizersTable)
          .set({ googleId: gUser.id, googleEmail: gUser.email })
          .where(eq(organizersTable.id, existing.id))
          .returning();
        organizer = linked;
      } else {
        // 3. New Google user — DO NOT create organizer record yet.
        // Native shells cannot complete /complete-profile inside Custom Tabs safely yet.
        if (nativeApp) {
          clearOAuthCookie(res);
          res.redirect(googleOAuthErrorRedirect(pendingNext, "needs_profile", "", nativeApp));
          return;
        }
        // Store pending Google profile in the OAuth cookie and redirect to /complete-profile
        // where the organizer's mobile will be collected and OTP-verified before
        // the organizer record is created. This ensures mobile is never null.
        setOAuthCookie(res, {
          next: pendingNext,
          pendingGoogleProfile: {
            name: gUser.name ?? gUser.email.split("@")[0],
            email: gUser.email,
            googleId: gUser.id,
            googleEmail: gUser.email,
          },
        });
        const cpRedirect = pendingNext ? `/complete-profile?next=${encodeURIComponent(pendingNext)}` : "/complete-profile";
        res.redirect(cpRedirect);
        return;
      }
    }

    if (!organizer) {
      clearOAuthCookie(res);
      res.redirect(googleOAuthErrorRedirect(pendingNext, "google_failed", "", nativeApp));
      return;
    }

    clearOAuthCookie(res);
    await issueOrganizerAuthCookie(req, res, organizer.id);
    if (nativeApp) {
      // Chrome Custom Tabs cannot share cookies with the Capacitor WebView.
      // Hand the session back via a short-lived deep-link token.
      res.redirect(nativeOAuthSuccessRedirect(organizer.id));
      return;
    }
    // Cross-app destinations (e.g. /mobile/...) must be full-page landings, not /organizer?next=
    const successRedirect = (() => {
      if (pendingNext?.startsWith("/mobile")) {
        return pendingNext.includes("?")
          ? `${pendingNext}&google_ok=1`
          : `${pendingNext}?google_ok=1`;
      }
      return pendingNext
        ? `/organizer?google_ok=1&next=${encodeURIComponent(pendingNext)}`
        : "/organizer?google_ok=1";
    })();
    res.redirect(successRedirect);
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback error");
    clearOAuthCookie(res);
    res.redirect(googleOAuthErrorRedirect(pendingNext, "google_failed", "", nativeApp));
  }
});

/**
 * Capacitor Android/iOS: exchange the deep-link handoff token for a WebView session cookie.
 * Custom Tabs hold Google OAuth cookies; the WebView must mint its own bidwar_auth cookie.
 */
router.post("/auth/google/native-handoff", async (req, res) => {
  const handoff =
    typeof req.body?.handoff === "string"
      ? req.body.handoff
      : typeof req.body?.token === "string"
        ? req.body.token
        : "";
  if (!handoff) {
    res.status(400).json({ error: "Missing handoff token" });
    return;
  }
  const claims = verifyNativeGoogleHandoffJwt(handoff);
  if (!claims) {
    res.status(401).json({ error: "Invalid or expired handoff token" });
    return;
  }
  const [organizer] = await db
    .select()
    .from(organizersTable)
    .where(eq(organizersTable.id, claims.organizerAccountId));
  if (!organizer) {
    res.status(401).json({ error: "Organizer not found" });
    return;
  }
  await issueOrganizerAuthCookie(req, res, organizer.id);
  res.json({
    ok: true,
    organizer: {
      id: organizer.id,
      name: organizer.name,
      email: organizer.email,
      mobile: organizer.mobile,
      photoUrl: organizer.photoUrl ?? null,
    },
  });
});

// ─── Legacy / incomplete profile: verify mobile via OTP (login still allowed) ─

router.post("/auth/organizer-account/phone/send-otp", otpSendLimiter, async (req, res) => {
  if (!req.jwtUser.organizerAccountId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const body = z.object({ mobile: z.string().min(7) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Mobile number is required" }); return; }

  const mobileParsed = parseIndianMobile(body.data.mobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
  const mobile = mobileParsed.normalized;

  if (await organizerNormalizedMobileTaken(mobile, req.jwtUser.organizerAccountId)) {
    res.status(409).json({ error: "This mobile number is already registered to another account." });
    return;
  }

  const result = await bulkSmsOtpSend(mobile, "complete_profile");
  if (!result.success) {
    res.status(503).json({ error: result.error ?? "Failed to send OTP. Please try again." });
    return;
  }

  auditLog(req, {
    category: "auth",
    action: "auth.organizer_phone_otp_sent",
    summary: `Phone OTP sent for organizer #${req.jwtUser.organizerAccountId}`,
    actor: { type: "organizer_account", id: String(req.jwtUser.organizerAccountId) },
    metadata: { mobile },
  });

  res.json({ success: true });
});

router.post("/auth/organizer-account/phone/verify", otpVerifyLimiter, async (req, res) => {
  if (!req.jwtUser.organizerAccountId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const body = z.object({
    mobile: z.string().min(7),
    otp: z.string().length(6),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Mobile and 6-digit OTP required" }); return; }

  const mobileParsed = parseIndianMobile(body.data.mobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
  const mobile = mobileParsed.normalized;

  const result = await bulkSmsOtpVerify(mobile, body.data.otp, "complete_profile");
  if (!result.success) {
    auditDenied(req, {
      category: "auth",
      action: "auth.organizer_phone_otp_failed",
      summary: `Phone OTP failed for organizer #${req.jwtUser.organizerAccountId}`,
      actor: { type: "organizer_account", id: String(req.jwtUser.organizerAccountId) },
      metadata: { mobile },
    });
    res.status(400).json({ error: result.error ?? "Invalid or expired OTP" });
    return;
  }

  if (await organizerNormalizedMobileTaken(mobile, req.jwtUser.organizerAccountId)) {
    res.status(409).json({ error: "This mobile number is already registered to another account." });
    return;
  }

  const [before] = await db
    .select()
    .from(organizersTable)
    .where(eq(organizersTable.id, req.jwtUser.organizerAccountId));
  if (!before) { res.status(404).json({ error: "Account not found." }); return; }

  const [updated] = await db.update(organizersTable)
    .set({ mobile, ...verifiedPhoneFields() })
    .where(eq(organizersTable.id, req.jwtUser.organizerAccountId))
    .returning();

  auditLog(req, {
    category: "auth",
    action: "auth.organizer_phone_verified",
    summary: `Organizer "${updated.name}" completed phone verification`,
    actor: { type: "organizer_account", id: String(updated.id), label: updated.name },
    before: snapshotOrganizer(before),
    after: snapshotOrganizer(updated),
    metadata: { method: "legacy_complete_profile", replacedPlaceholder: isPlaceholderOrganizerMobile(before.mobile) },
  });

  res.json({ success: true, organizer: organizerToJson(updated) });
});

// ─── Organizer Account: Update profile (name/email/photo — not mobile) ────────

router.patch("/auth/organizer-account/profile", async (req, res) => {
  if (!req.jwtUser.organizerAccountId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const body = z.object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().optional().nullable(),
    mobile: z.string().min(7).optional(),
    photoUrl: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .refine(
        (v) => v == null || v === "" || v.startsWith("https://"),
        "Photo URL must be a valid HTTPS URL",
      ),
    photoPublicId: z.string().optional().nullable(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid profile data." }); return; }

  const { name, email, mobile, photoUrl, photoPublicId } = body.data;

  if (mobile !== undefined) {
    res.status(400).json({
      error: "Mobile number must be verified via OTP. Use the Complete Profile flow.",
      code: "PHONE_OTP_REQUIRED",
    });
    return;
  }

  const [existingOrganizer] = await db
    .select()
    .from(organizersTable)
    .where(eq(organizersTable.id, req.jwtUser.organizerAccountId));
  if (!existingOrganizer) { res.status(404).json({ error: "Account not found." }); return; }

  if (email) {
    const emailExists = await db.select().from(organizersTable)
      .where(eq(organizersTable.email, email));
    if (emailExists.length > 0 && emailExists[0].id !== req.jwtUser.organizerAccountId) {
      res.status(409).json({ error: "This email is already registered to another account." });
      return;
    }
  }

  const updates: Partial<typeof organizersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;

  const photoChanged = photoUrl !== undefined || photoPublicId !== undefined;
  if (photoChanged) {
    updates.photoUrl = photoUrl || null;
    updates.photoPublicId = photoPublicId || null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update." });
    return;
  }

  let updated!: typeof organizersTable.$inferSelect;
  const persistOrganizerUpdate = async () => {
    const organizerAccountId = req.jwtUser?.organizerAccountId;
    if (organizerAccountId == null) throw new Error("ORGANIZER_NOT_FOUND");
    const [row] = await db.update(organizersTable)
      .set(updates)
      .where(eq(organizersTable.id, organizerAccountId))
      .returning();
    if (!row) throw new Error("ORGANIZER_NOT_FOUND");
    updated = row;
  };

  if (photoChanged) {
    await commitCloudinaryImageWrite({
      previous: {
        url: existingOrganizer.photoUrl,
        publicId: existingOrganizer.photoPublicId,
      },
      next: {
        url: photoUrl || null,
        publicId: photoPublicId || null,
      },
      persist: persistOrganizerUpdate,
      logger: req.log,
      context: { route: "auth.organizerProfile", organizerId: req.jwtUser.organizerAccountId },
    });
  } else {
    await persistOrganizerUpdate();
  }

  res.json({ success: true, organizer: organizerToJson(updated) });
});

// ─── Organizer Account: Change password ───────────────────────────────────────

router.post("/auth/organizer-account/change-password", authLimiter, async (req, res) => {
  if (!req.jwtUser.organizerAccountId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const body = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Current password and a new password (min 6 chars) are required." }); return; }

  const [organizer] = await db.select().from(organizersTable)
    .where(eq(organizersTable.id, req.jwtUser.organizerAccountId));
  if (!organizer) { res.status(404).json({ error: "Account not found." }); return; }
  if (!organizer.passwordHash) {
    res.status(400).json({ error: "No password set on this account. Use set-password instead." });
    return;
  }

  const isMatch = await verifyPassword(body.data.currentPassword, organizer.passwordHash);
  if (!isMatch) { res.status(401).json({ error: "Current password is incorrect." }); return; }

  const isSame = await verifyPassword(body.data.newPassword, organizer.passwordHash);
  if (isSame) { res.status(400).json({ error: "New password cannot be the same as your current password." }); return; }

  const newSalt = randomBytes(16).toString("hex");
  const newHash = (await scryptAsync(body.data.newPassword, newSalt, 64) as Buffer).toString("hex");
  const [updated] = await db.update(organizersTable)
    .set({ passwordHash: `${newHash}:${newSalt}` })
    .where(eq(organizersTable.id, req.jwtUser.organizerAccountId))
    .returning();

  res.json({ success: true, organizer: organizerToJson(updated) });
});

// ─── Admin: Set tournament license status ─────────────────────────────────────

router.post("/auth/admin/tournaments/:id/set-license-status", async (req, res) => {
  if (req.jwtUser.adminLevel !== "master") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  const tournamentId = Number(req.params.id);
  if (isNaN(tournamentId)) { res.status(400).json({ error: "Invalid tournament ID" }); return; }

  const body = z.object({
    status: z.enum(["trial", "active", "completed"]),
    reason: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Status must be trial, active, or completed" }); return; }

  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }

  const [before] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!before) { res.status(404).json({ error: "Tournament not found" }); return; }

  const [updated] = await db.update(tournamentsTable)
    .set({
      licenseStatus: body.data.status,
      licenseGrantedAt: body.data.status === "active" ? new Date() : undefined,
      licenseGrantedBy: body.data.status === "active" ? (req.jwtUser.adminLevel ?? undefined) : undefined,
    })
    .where(eq(tournamentsTable.id, tournamentId))
    .returning();

  auditLog(req, {
    category: "admin",
    action: "tournament.license_status_set",
    summary: `License status set to "${body.data.status}" for tournament "${before.name}"`,
    severity: "critical",
    reason: reasonResult.reason,
    tournamentId,
    resource: { type: "tournament", id: tournamentId },
    before: snapshotTournament(before),
    after: updated ? snapshotTournament(updated) : null,
    alertKey: "license_status_changed",
  });

  res.json({ success: true });
});

// ─── Google OAuth: complete profile (collect + OTP-verify mobile) ─────────────

router.get("/auth/google/complete-profile/status", (req, res) => {
  const pending = req.oauthState.pendingGoogleProfile;
  if (!pending) {
    res.json({ ready: false, reason: "session_expired" });
    return;
  }
  res.json({
    ready: true,
    email: pending.email,
    step: req.oauthState.pendingGoogleMobile ? "otp" : "mobile",
    mobile: req.oauthState.pendingGoogleMobile ?? null,
  });
});

router.post("/auth/google/complete-profile", otpSendLimiter, async (req, res) => {
  try {
    const pending = req.oauthState.pendingGoogleProfile;
    if (!pending) {
      res.status(401).json({ error: "Your sign-in session expired. Please sign in with Google again." });
      return;
    }

    const body = z.object({ mobile: z.string().min(1) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Mobile number is required" }); return; }

    const mobileParsed = parseIndianMobile(body.data.mobile);
    if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
    const mobile = mobileParsed.normalized;

    if (await organizerNormalizedMobileTaken(mobile)) {
      res.status(409).json({ error: "This mobile number is already registered to another account." });
      return;
    }

    // Persist mobile before SMS send so OTP verify still works if the provider succeeds but our response fails.
    setOAuthCookie(res, { ...req.oauthState, pendingGoogleMobile: mobile });

    const result = await bulkSmsOtpSend(mobile, "complete_profile");
    if (!result.success) {
      res.status(503).json({ error: result.error ?? "Unable to send OTP right now. Please try again in a moment." });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "complete-profile send OTP error");
    res.status(500).json({ error: "Something went wrong while sending the OTP. Please try again." });
  }
});

router.post("/auth/google/complete-profile/verify", otpVerifyLimiter, async (req, res) => {
  const pending = req.oauthState.pendingGoogleProfile;
  const mobile = req.oauthState.pendingGoogleMobile;
  if (!pending || !mobile) {
    res.status(401).json({ error: "Your sign-in session expired. Please sign in with Google again." });
    return;
  }

  const schema = z.object({ otp: z.string().length(6).regex(/^\d{6}$/) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "OTP must be 6 digits" }); return; }

  try {
    const result = await bulkSmsOtpVerify(mobile, parsed.data.otp, "complete_profile");
    if (!result.success) {
      res.status(400).json({ error: result.error ?? "Invalid or expired OTP" });
      return;
    }

    if (await organizerNormalizedMobileTaken(mobile)) {
      res.status(409).json({
        error: "This mobile number is already registered. Sign in with your existing account or use a different number.",
      });
      return;
    }

    let organizer = (
      await db.select().from(organizersTable).where(eq(organizersTable.googleId, pending.googleId))
    )[0];

    if (!organizer) {
      const [existingByEmail] = await db
        .select()
        .from(organizersTable)
        .where(eq(organizersTable.email, pending.email));
      if (existingByEmail) {
        const [linked] = await db.update(organizersTable)
          .set({
            googleId: pending.googleId,
            googleEmail: pending.googleEmail,
            mobile,
            ...verifiedPhoneFields(),
          })
          .where(eq(organizersTable.id, existingByEmail.id))
          .returning();
        organizer = linked;
      } else {
        try {
          [organizer] = await db.insert(organizersTable).values({
            name: pending.name,
            email: pending.email,
            mobile,
            googleId: pending.googleId,
            googleEmail: pending.googleEmail,
            licenseStatus: "active",
            maxTournaments: 1,
            ...verifiedPhoneFields(),
          }).returning();
          triggerOrganiserRegisteredNotification(organizer);
        } catch (insertErr) {
          if (isUniqueViolation(insertErr)) {
            res.status(409).json({
              error: "An account with this email or mobile already exists. Please sign in instead.",
            });
            return;
          }
          throw insertErr;
        }
      }
    } else if (
      organizerNeedsPhoneVerification({
        mobile: organizer.mobile,
        phoneVerified: organizer.phoneVerified,
      })
    ) {
      const [updated] = await db.update(organizersTable)
        .set({ mobile, ...verifiedPhoneFields() })
        .where(eq(organizersTable.id, organizer.id))
        .returning();
      organizer = updated;
    }

    if (!organizer) {
      res.status(500).json({ error: "Failed to create your account. Please try again." });
      return;
    }

    clearOAuthCookie(res);
    await issueOrganizerAuthCookie(req, res, organizer.id);
    auditLog(req, {
      category: "auth",
      action: "auth.organizer_phone_verified",
      summary: `Organizer "${organizer.name}" verified mobile via Google complete-profile`,
      actor: { type: "organizer_account", id: String(organizer.id), label: organizer.name },
      after: snapshotOrganizer(organizer),
      metadata: { method: "google_complete_profile" },
    });
    res.json({ success: true, organizer: organizerToJson(organizer) });
  } catch (err) {
    req.log.error({ err, email: pending.email, mobile }, "complete-profile verify error");
    res.status(503).json({
      error: "Could not complete registration. Your code may already be verified — tap Verify again or use Resend.",
    });
  }
});

// Dev-only: allows Google OAuth users to skip mobile verification (BYPASS_OTP=true required)
// Creates incomplete profile — must complete phone OTP before product use (phased placeholder retirement).
router.post("/auth/google/complete-profile/skip", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return;
  }
  if (process.env.BYPASS_OTP !== "true") {
    res.status(503).json({ error: "Mobile verification is required" }); return;
  }
  const pending = req.oauthState.pendingGoogleProfile;
  if (!pending) {
    res.status(400).json({ error: "No pending Google profile — please sign in with Google first" });
    return;
  }

  const [organizer] = await db.insert(organizersTable).values({
    name: pending.name,
    email: pending.email,
    mobile: `gid_${pending.googleId}`,
    googleId: pending.googleId,
    googleEmail: pending.googleEmail,
    licenseStatus: "active",
    maxTournaments: 1,
    phoneVerified: false,
    phoneVerifiedAt: null,
  }).returning();

  clearOAuthCookie(res);
  setAuthCookie(res, { ...req.jwtUser, organizerAccountId: organizer.id, organizer: { ...(req.jwtUser.organizer ?? {}) } });
  triggerOrganiserRegisteredNotification(organizer);
  auditLog(req, {
    category: "auth",
    action: "auth.organizer_registered",
    summary: `Dev skip: organizer "${organizer.name}" created without phone verification`,
    severity: "warning",
    after: snapshotOrganizer(organizer),
    metadata: { method: "complete_profile_skip", phoneVerified: false },
  });
  res.json({ success: true, organizer: organizerToJson(organizer) });
});

export default router;
