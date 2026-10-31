/**
 * Communication routes — admin-only.
 * - POST /auth/admin/communicate/send      — blast messages (master admin)
 * - GET  /auth/admin/communicate/logs      — message history
 * - GET  /auth/admin/communicate/logs/:id  — single log entry
 * - GET  /auth/admin/communicate/blasts    — automated blast history
 * - POST /consent/generate                 — create consent token + send SMS (admin/organizer only)
 * - POST /consent/:token/confirm           — web fallback consent confirm
 * - GET  /consent/:token                   — resolve token metadata (landing page)
 * - POST /auth/admin/communicate/consent-declare — organizer declaration (scoped to their tournaments)
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  playersTable,
  teamsTable,
  organizersTable,
  consentTokensTable,
  commLogsTable,
  consentBlastLogTable,
  waConsentEventsTable,
  waTemplatesTable,
  smsNotificationSettingsTable,
  scorerAccountsTable,
  scorerTournamentAssignmentsTable,
} from "@workspace/db";
import { eq, and, desc, gte, lte, sql, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { CURRENT_CONSENT_NOTICE_VERSION, CONSENT_NOTICE_V1 } from "@workspace/api-base";
import { recordConsentGranted } from "../lib/communication/consent-service";
import { sendSms, sendWhatsApp, buildWaMeLink, buildConsentSms, isTournamentLicensedForComm } from "../lib/comm-sender";
import { resolveTournamentFeatures } from "@workspace/platform-core/tournament-features";
import { isMobileRevoked } from "../lib/communication/policy-engine";
import { sendDltSms, playerSoldTemplateId } from "../lib/fast2sms";
import { getPublicOrigin } from "../lib/runtime-env";
import { logger } from "../lib/logger";
import { resolveWhatsAppProviderId, getWhatsAppProvider } from "../lib/communication/providers/index.js";
import {
  resolvePlayerSoldImageUrl,
  META_AUCTION_PLAYER_SOLD_TEMPLATE,
  META_AUCTION_PLAYER_SOLD_LANGUAGE,
  META_AUCTION_PLAYER_SOLD_CATEGORY,
  META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE,
  META_ORGANISER_ONBOARDING_WELCOME_LANGUAGE,
  META_ORGANISER_ONBOARDING_WELCOME_CATEGORY,
  META_TEAM_OWNER_WELCOME_TEMPLATE,
  META_TEAM_OWNER_WELCOME_LANGUAGE,
  META_TEAM_OWNER_WELCOME_CATEGORY,
} from "../lib/whatsapp";
import { generateAndHostPlayerSoldPoster } from "../lib/poster/player-sold-poster-service.js";
import { formatAuctionAmount, normalizeAuctionUnit, type AuctionUnit } from "@workspace/auction/auction-unit";
import {
  VERIFIED_APPROVED_TEMPLATES,
  DEV_UNAPPROVED_TEMPLATES,
  BIDWAR_APPROVED_TEMPLATE_ALLOWLIST,
  normalizeTemplateKey,
  isMetaApprovedTemplate,
  validateTemplateDispatchEligibility,
  getOperationalApprovedTemplates,
  getAllTemplatesForAdminAudit,
} from "../lib/communication/template-registry";

const router = Router();

// ─── Authoritative WhatsApp Template Definitions & Helpers ───────────────────

export interface CanonicalWaTemplate {
  templateName: string;
  title: string;
  category: "utility" | "marketing" | "authentication";
  description: string;
  body: string;
  language?: string;
  headerType?: "image" | "text" | "video" | "document" | "none";
  headerImageUrl?: string;
  metaApproved?: boolean;
  variables: Array<{ key: string; label: string; placeholder: string; description?: string }>;
  sampleArgs: string[];
}

export const CANONICAL_WA_TEMPLATES: Record<string, CanonicalWaTemplate> = {
  auction_player_sold: {
    templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
    title: "🏏 Player Sold Celebration",
    category: "utility",
    description: "Meta-approved celebratory announcement with image header sent when a player is sold to a team",
    language: "en",
    headerType: "image",
    headerImageUrl: resolvePlayerSoldImageUrl(),
    metaApproved: true,
    body: "🏏 PLAYER SOLD!\n\nCongratulations, {{1}}! 🎉\n\nYou have been sold to *{{2}}* for *{{3}}* in the *{{4}}* auction.\n\nWishing you and your team great success in the tournament!\n\nBIDWAR | From Auction to Champions",
    variables: [
      { key: "1", label: "Player Name", placeholder: "e.g. Virat Kohli" },
      { key: "2", label: "Winning Team", placeholder: "e.g. Royal Challengers" },
      { key: "3", label: "Sold Amount", placeholder: "e.g. ₹25,00,000" },
      { key: "4", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
    ],
    sampleArgs: ["Virat Kohli", "Royal Challengers", "₹25,00,000", "Premier League 2026"],
  },
  organiser_onboarding_welcome: {
    templateName: META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE,
    title: "🏏 Organiser Onboarding Welcome",
    category: "marketing",
    description: "Meta-approved onboarding welcome message sent to tournament organisers upon registration or manually via admin",
    language: "en",
    headerType: "none",
    metaApproved: true,
    body: "🏏 Welcome to BIDWAR, {{1}}!\n\nThank you for joining BIDWAR as a Tournament Organiser.\n\nBIDWAR helps you manage your tournament activities, including team registration, fixtures, live scoring and player auctions — all in one place.\n\nWe're excited to be part of your sporting journey!\n\nNeed help getting started? Our team is here to assist you.\n\nBIDWAR | From Auction to Champions",
    variables: [
      { key: "1", label: "Organiser Name", placeholder: "e.g. Rajesh" },
    ],
    sampleArgs: ["Rajesh"],
  },
  team_owner_welcome_login: {
    templateName: META_TEAM_OWNER_WELCOME_TEMPLATE,
    title: "🏏 Team Owner Welcome",
    category: "utility",
    description: "Meta-approved welcome notification sent to Team Owners upon team registration in live tournaments",
    language: "en",
    headerType: "none",
    metaApproved: true,
    body: "🏏 Welcome to BIDWAR, {{1}}!\n\nYou have been successfully registered as a Team Owner for {{2}}.\n\nYour login details will be shared with you before the auction starts.\n\nStay tuned, and get ready for an exciting tournament!\n\nBest Wishes !",
    variables: [
      { key: "1", label: "Team Owner Name", placeholder: "e.g. Tushar" },
      { key: "2", label: "Tournament Name", placeholder: "e.g. Bidwar Premier League" },
    ],
    sampleArgs: ["Tushar", "Bidwar Premier League"],
  },
  player_sold: {
    templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
    title: "🏏 Player Sold Celebration",
    category: "utility",
    description: "Meta-approved celebratory announcement with image header sent when a player is sold to a team (alias for auction_player_sold)",
    language: "en",
    headerType: "image",
    headerImageUrl: resolvePlayerSoldImageUrl(),
    metaApproved: true,
    body: "🏏 PLAYER SOLD!\n\nCongratulations, {{1}}! 🎉\n\nYou have been sold to *{{2}}* for *{{3}}* in the *{{4}}* auction.\n\nWishing you and your team great success in the tournament!\n\nBIDWAR | From Auction to Champions",
    variables: [
      { key: "1", label: "Player Name", placeholder: "e.g. Virat Kohli" },
      { key: "2", label: "Winning Team", placeholder: "e.g. Royal Challengers" },
      { key: "3", label: "Sold Amount", placeholder: "e.g. ₹25,00,000" },
      { key: "4", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
    ],
    sampleArgs: ["Virat Kohli", "Royal Challengers", "₹25,00,000", "Premier League 2026"],
  },
  welcome_invite: {
    templateName: "welcome_invite",
    title: "🎉 Welcome & Tournament Invite",
    category: "utility",
    description: "Official invitation to participate in a tournament",
    body: "*Welcome to BidWar Auction!*\n\nYou are invited to participate in *{{1}}*.\n\n📅 Date: {{2}}\n📍 Venue/Mode: {{3}}\n\nClick below to view details and live rosters.",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Date & Time", placeholder: "e.g. 24 Sep 2026, 6:00 PM" },
      { key: "3", label: "Venue / Mode", placeholder: "e.g. Live Arena" },
    ],
    sampleArgs: ["Premier League 2026", "24 Sep 2026, 6:00 PM", "Live Arena"],
  },
  auction_reminder: {
    templateName: "auction_reminder",
    title: "🚨 Live Auction Countdown Alert",
    category: "utility",
    description: "Urgent countdown notification before auction commences",
    body: "*🚨 Live Auction Starting Soon!*\n\nThe player auction for *{{1}}* begins in *{{2}} minutes*.\n\nTap the link below to enter the live bidding arena right now:\n{{3}}",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Minutes Remaining", placeholder: "e.g. 15" },
      { key: "3", label: "Live Auction Link", placeholder: "e.g. https://bidwar.in/live/742" },
    ],
    sampleArgs: ["Premier League 2026", "15", "https://bidwar.in/live/742"],
  },
  consent_optin: {
    templateName: "consent_optin",
    title: "📲 WhatsApp Consent Opt-In Request",
    category: "utility",
    description: "Request recipient to opt in for WhatsApp notifications",
    body: "*BidWar Instant Alerts*\n\nTo receive real-time bid updates, sale notifications, and squad announcements directly on WhatsApp, please confirm your opt-in:\n\n{{1}}",
    variables: [
      { key: "1", label: "Consent Verification Link", placeholder: "e.g. https://bidwar.in/wa-consent/token981" },
    ],
    sampleArgs: ["https://bidwar.in/wa-consent/token981"],
  },
  credentials_share: {
    templateName: "credentials_share",
    title: "🔑 Team Owner Credentials",
    category: "authentication",
    description: "Private PIN and dashboard link sent to team owners",
    body: "*BidWar Team Pass*\n\nYour owner access for *{{1}}* (Team *{{2}}*) is ready.\n\n🔑 PIN: *{{3}}*\n🌐 App: {{4}}\n\nDo not share this PIN with anyone.",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Team Name", placeholder: "e.g. Super Kings" },
      { key: "3", label: "Access PIN", placeholder: "e.g. 4921" },
      { key: "4", label: "Platform URL", placeholder: "e.g. https://bidwar.in/owner" },
    ],
    sampleArgs: ["Premier League 2026", "Super Kings", "4921", "https://bidwar.in/owner"],
  },
};

/** Ensure default canonical templates are seeded into wa_templates table without falsely approving unverified dev templates */
export async function ensureCanonicalTemplatesSeeded(): Promise<void> {
  try {
    const q = db
      .select({ templateName: waTemplatesTable.templateName, status: waTemplatesTable.status })
      .from(waTemplatesTable);
    const existing = typeof (q as any)?.then === "function" ? await q : (Array.isArray(q) ? q : []);
    const existingList = Array.isArray(existing) ? existing : [];
    const existingMap = new Map(existingList.map((t) => [t.templateName, t.status]));

    // 1. Ensure the genuine Meta-approved template exists and has approved status
    // 1. Ensure genuine Meta-approved templates exist and have approved status
    for (const approvedTpl of Object.values(VERIFIED_APPROVED_TEMPLATES)) {
      if (!existingMap.has(approvedTpl.templateName)) {
        if (typeof db?.insert === "function") {
          await db
            .insert(waTemplatesTable)
            .values({
              templateName: approvedTpl.templateName,
              category: approvedTpl.category,
              description: approvedTpl.description,
              status: "approved",
            })
            .onConflictDoNothing();
        }
      } else if (existingMap.get(approvedTpl.templateName) !== "approved") {
        if (typeof db?.update === "function") {
          try {
            await db
              .update(waTemplatesTable)
              .set({ status: "approved" })
              .where(eq(waTemplatesTable.templateName, approvedTpl.templateName));
          } catch {
            // Non-fatal
          }
        }
      }
    }
    // 2. Data Safety: Do NOT delete historical records, but normalize any dev templates
    // that were previously hardcoded as "approved" back to "unapproved" / "duplicate"
    for (const [devName, devTpl] of Object.entries(DEV_UNAPPROVED_TEMPLATES)) {
      if (existingMap.has(devName)) {
        const curStatus = existingMap.get(devName);
        if (curStatus === "approved" && typeof db?.update === "function") {
          try {
            await db
              .update(waTemplatesTable)
              .set({ status: devTpl.status })
              .where(eq(waTemplatesTable.templateName, devName));
          } catch {
            // Non-fatal
          }
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "ensureCanonicalTemplatesSeeded: database seed warning");
  }
}

/** Interpolate placeholders {{1}}, {{2}} or {{key}} with values */
export function interpolateTemplateVariables(
  templateBody: string,
  variables: Record<string, string>,
): string {
  let result = templateBody;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(`{{${key}}}`).join(value ?? "");
  }
  return result;
}

/** Server-side recipient mobile validation & normalization */
export function validateAndNormalizeMobile(raw: unknown): { valid: boolean; normalized?: string; error?: string } {
  if (typeof raw !== "string") {
    return { valid: false, error: "Recipient mobile must be a valid string" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: "Recipient mobile cannot be empty" };
  }
  // Check for invalid characters (only digits, plus, hyphen, space, parens allowed)
  if (/[^\d\s\-+()]/.test(trimmed)) {
    return { valid: false, error: `Recipient mobile "${trimmed}" contains invalid characters` };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10) {
    return { valid: false, error: `Recipient mobile "${trimmed}" has too few digits (minimum 10 required)` };
  }
  if (digits.length > 15) {
    return { valid: false, error: `Recipient mobile "${trimmed}" exceeds maximum allowed length (15 digits)` };
  }

  // Domestic Indian format normalization:
  // 10 digits -> keep 10 digits
  if (digits.length === 10) {
    return { valid: true, normalized: digits };
  }
  // 11 digits with leading 0 -> strip 0
  if (digits.length === 11 && digits.startsWith("0")) {
    return { valid: true, normalized: digits.slice(1) };
  }
  // 12 digits with 91 -> strip 91 for Indian 10-digit standard
  if (digits.length === 12 && digits.startsWith("91")) {
    return { valid: true, normalized: digits.slice(2) };
  }

  return { valid: true, normalized: digits };
}

/** Normalize free-text / dropdown template names to a canonical key. */
function normalizeCommTemplateName(name: string | undefined | null): string | null {
  if (!name?.trim()) return null;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "player_sold" || key === "playersold" || key === "auction_player_sold") {
    return META_AUCTION_PLAYER_SOLD_TEMPLATE;
  }
  if (key === "organizer_onboarding_welcome" || key === "organiser_onboarding_welcome") {
    return META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE;
  }
  if (key === "team_owner_welcome" || key === "welcome_team_owner" || key === "team_owner_welcome_login") {
    return META_TEAM_OWNER_WELCOME_TEMPLATE;
  }
  return name.trim();
}

function buildPlayerSoldWaMessage(opts: {
  playerName: string;
  teamName: string;
  amount: number | string;
  tournamentName: string;
  auctionUnit?: AuctionUnit | null;
}): string {
  const unit = normalizeAuctionUnit(opts.auctionUnit);
  let amt: string;
  if (typeof opts.amount === "number") {
    amt = formatAuctionAmount(opts.amount, unit);
  } else {
    const str = String(opts.amount ?? "").trim();
    if (unit === "points") {
      if (str.endsWith("Pt.") && !str.startsWith("₹")) {
        amt = str;
      } else {
        const parsed = parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
        amt = formatAuctionAmount(parsed, "points");
      }
    } else {
      if (str.startsWith("₹") && !str.endsWith("Pt.")) {
        amt = str;
      } else {
        const parsed = parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
        amt = formatAuctionAmount(parsed, "rupee");
      }
    }
  }

  return (
    `🏏 PLAYER SOLD!\n\n` +
    `Congratulations, ${opts.playerName}! 🎉\n\n` +
    `You have been sold to *${opts.teamName}* for *${amt}* in the *${opts.tournamentName}* auction.\n\n` +
    `Wishing you and your team great success in the tournament!\n\n` +
    `BIDWAR | From Auction to Champions`
  );
}

function buildPlayerSoldSmsPreview(opts: {
  playerName: string;
  teamName: string;
  amount: number;
  appUrl: string;
}): string {
  return `Player Sold: ${opts.playerName} → ${opts.teamName} for ${opts.amount} | ${opts.appUrl}`;
}

function isMasterAdmin(req: import("express").Request): boolean {
  return !!req.jwtUser.isAdmin && req.jwtUser.adminLevel === "master";
}

function isAdminOrOrganizer(req: import("express").Request): boolean {
  return !!(req.jwtUser.isAdmin || req.jwtUser.organizerAccountId);
}

function newToken(): string {
  return randomBytes(16).toString("hex");
}

function generateBlastId(): string {
  return `blast_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

// ─── Bot Link (public — must be BEFORE /:token param route) ─────────────────

router.get("/consent/wa-link", (_req, res) => {
  const waNumber = (
    process.env.KV_TECHMEDIA_WHATSAPP_NUMBER ??
    process.env.META_WHATSAPP_PHONE_NUMBER ??
    process.env.TWILIO_WHATSAPP_FROM ??
    ""
  ).replace("whatsapp:", "").replace("+", "").trim();
  const link = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent("hello")}` : null;
  res.json({ link, configured: !!waNumber });
});

// ─── Consent Token: Generate + Send SMS (requires admin or organizer auth) ───

router.post("/consent/generate", async (req, res) => {
  if (!isAdminOrOrganizer(req)) {
    res.status(403).json({ error: "Admin or organizer login required" });
    return;
  }

  const schema = z.object({
    recipientType: z.enum(["player", "team_owner", "organizer", "scorer"]),
    recipientId: z.number().int(),
    mobile: z.string().min(7),
    tournamentId: z.number().int(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { recipientType, recipientId, mobile, tournamentId } = parsed.data;

  // Organizer callers may only generate tokens for their own tournament
  if (!req.jwtUser.isAdmin && req.jwtUser.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t || t.organizerId !== req.jwtUser.organizerAccountId) {
      res.status(403).json({ error: "Not authorized for this tournament" });
      return;
    }
  }

  const [tournament] = await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  // Recipient integrity: verify the recipient exists in this tournament and
  // the supplied mobile matches what is stored in the DB for that entity.
  // This prevents an organizer from minting tokens for unrelated recipient IDs.
  let dbMobile: string | null = null;
  if (recipientType === "player") {
    const [p] = await db.select({ tournamentId: playersTable.tournamentId, mobileNumber: playersTable.mobileNumber })
      .from(playersTable).where(eq(playersTable.id, recipientId));
    if (!p || p.tournamentId !== tournamentId) {
      res.status(403).json({ error: "Player does not belong to this tournament" }); return;
    }
    dbMobile = p.mobileNumber || null;
  } else if (recipientType === "team_owner") {
    const [tm] = await db.select({ tournamentId: teamsTable.tournamentId, ownerMobile: teamsTable.ownerMobile })
      .from(teamsTable).where(eq(teamsTable.id, recipientId));
    if (!tm || tm.tournamentId !== tournamentId) {
      res.status(403).json({ error: "Team does not belong to this tournament" }); return;
    }
    dbMobile = tm.ownerMobile || null;
  } else if (recipientType === "organizer") {
    // Bind organizer recipientId to the tournament's actual organizerId
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t?.organizerId) { res.status(400).json({ error: "Tournament has no linked organizer" }); return; }
    if (t.organizerId !== recipientId) {
      res.status(400).json({ error: "recipientId must match the tournament's organizerId for organizer tokens" }); return;
    }
    const [o] = await db.select({ id: organizersTable.id, mobile: organizersTable.mobile })
      .from(organizersTable).where(eq(organizersTable.id, recipientId));
    if (!o) { res.status(404).json({ error: "Organizer not found" }); return; }
    dbMobile = o.mobile || null;
  } else if (recipientType === "scorer") {
    const [s] = await db
      .select({ id: scorerAccountsTable.id, mobile: scorerAccountsTable.mobile })
      .from(scorerAccountsTable)
      .where(eq(scorerAccountsTable.id, recipientId));
    if (!s) { res.status(404).json({ error: "Scorer not found" }); return; }
    if (!req.jwtUser.isAdmin && req.jwtUser.organizerAccountId) {
      const [assignment] = await db
        .select({ id: scorerTournamentAssignmentsTable.id })
        .from(scorerTournamentAssignmentsTable)
        .where(
          and(
            eq(scorerTournamentAssignmentsTable.scorerId, recipientId),
            eq(scorerTournamentAssignmentsTable.tournamentId, tournamentId),
          ),
        );
      if (!assignment) {
        res.status(403).json({ error: "Scorer is not assigned to this tournament" });
        return;
      }
    }
    dbMobile = s.mobile || null;
  }
  // Ensure the supplied mobile matches the stored record (strip leading +/spaces for comparison)
  const normalize = (m: string) => m.replace(/\D/g, "");
  if (dbMobile && normalize(dbMobile) !== normalize(mobile)) {
    res.status(400).json({ error: "Supplied mobile number does not match the record on file for this recipient" });
    return;
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
  await db.insert(consentTokensTable).values({ token, recipientType, recipientId, mobile, tournamentId, expiresAt });

  const waLink = buildWaMeLink(token);
  const smsBody = buildConsentSms(tournament.name, waLink);
  const result = await sendSms(mobile, smsBody);

  res.json({ success: true, token, waLink, sent: result });
});

// ─── Consent Token: Resolve (landing page) ────────────────────────────────────

router.get("/consent/:token", async (req, res) => {
  const [ct] = await db.select().from(consentTokensTable).where(eq(consentTokensTable.token, req.params.token));
  if (!ct) { res.status(404).json({ error: "Token not found or expired" }); return; }
  const [tournament] = await db.select({ id: tournamentsTable.id, name: tournamentsTable.name, logoUrl: tournamentsTable.logoUrl }).from(tournamentsTable).where(eq(tournamentsTable.id, ct.tournamentId));
  const waLink = buildWaMeLink(ct.token);
  res.json({
    token: ct.token,
    mobile: ct.mobile.replace(/\d(?=\d{4})/g, "*"),
    recipientType: ct.recipientType,
    tournamentName: tournament?.name ?? "",
    tournamentLogoUrl: tournament?.logoUrl ?? null,
    waLink,
    used: ct.used,
    expired: new Date() > ct.expiresAt,
    noticeVersion: CURRENT_CONSENT_NOTICE_VERSION,
    notice: CONSENT_NOTICE_V1.content.en,
  });
});

// ─── Consent Token: Web Fallback Confirm ─────────────────────────────────────

class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

router.post("/consent/:token/confirm", async (req, res) => {
  const tokenRaw = req.params.token;
  if (!tokenRaw || typeof tokenRaw !== "string" || !tokenRaw.trim()) {
    res.status(404).json({ error: "Token not found" });
    return;
  }
  const token = tokenRaw.trim();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;

  try {
    const runTx = async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
      if (typeof db.transaction === "function") {
        return await db.transaction(fn);
      }
      return await fn(db);
    };

    const outcome = await runTx(async (tx) => {
      // 1. Atomic conditional consumption: UPDATE ... WHERE token = ? AND used = false RETURNING ...
      const [consumed] = await tx
        .update(consentTokensTable)
        .set({ used: true })
        .where(
          and(
            eq(consentTokensTable.token, token),
            eq(consentTokensTable.used, false),
          ),
        )
        .returning();

      if (consumed) {
        // Enforce 72-hour expiration on the consumed token
        if (new Date() > consumed.expiresAt) {
          throw new TokenExpiredError();
        }

        // Successfully and exclusively consumed — record affirmative consent
        await recordConsentGranted({
          recipientType: consumed.recipientType as any,
          recipientId: consumed.recipientId,
          mobile: consumed.mobile,
          tournamentId: consumed.tournamentId,
          noticeVersion: CURRENT_CONSENT_NOTICE_VERSION,
          consentScope: "tournament_operational",
          source: "consent_link",
          tokenUsed: consumed.token,
          ip,
          tx,
        });

        await tx.insert(commLogsTable).values({
          tournamentId: consumed.tournamentId,
          recipientType: consumed.recipientType,
          recipientId: consumed.recipientId,
          recipientMobile: consumed.mobile,
          channel: "web",
          messageContent: `Web consent link confirmed (${CURRENT_CONSENT_NOTICE_VERSION})`,
          deliveryStatus: "delivered",
        });

        return { status: 200, body: { success: true } };
      }

      // 2. If update did not match, inspect existing token for idempotent replay or errors
      const [existing] = await tx
        .select()
        .from(consentTokensTable)
        .where(eq(consentTokensTable.token, token))
        .limit(1);

      if (!existing) {
        return { status: 404, body: { error: "Token not found" } };
      }

      if (existing.used) {
        return { status: 200, body: { success: true, alreadyConfirmed: true } };
      }

      if (new Date() > existing.expiresAt) {
        return { status: 410, body: { error: "Token expired" } };
      }

      return { status: 400, body: { error: "Unable to confirm consent token" } };
    });

    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(410).json({ error: "Token expired" });
      return;
    }
    logger.error({ err, token }, "Failed to confirm consent token");
    res.status(500).json({ error: "Failed to confirm consent" });
  }
});

// ─── Organizer Declaration (Decommissioned P0-A) ──────────────────────────────

router.post("/auth/admin/communicate/consent-declare", async (req, res) => {
  if (!req.jwtUser.isAdmin && !req.jwtUser.organizerAccountId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  // P0-A: Decommissioned third-party consent declaration
  res.status(403).json({
    error: "Third-party WhatsApp consent declaration is prohibited. Each recipient must opt in individually via verifiable affirmative action.",
    code: "THIRD_PARTY_CONSENT_PROHIBITED",
  });
});

// ─── Send Message ─────────────────────────────────────────────────────────────

router.post("/auth/admin/communicate/send", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Master admin required" }); return; }

  const schema = z.object({
    tournamentId: z.number().int().optional(),
    recipientGroup: z.enum([
      "all_players",
      "sold_players",
      "unsold_players",
      "all_owners",
      "organizer",
      "manual",
      "custom",
    ]),
    specificTeamId: z.number().int().optional(),
    channel: z.enum(["whatsapp", "sms", "both"]),
    templateName: z.string().optional(),
    messageContent: z.string().max(4096).optional().default(""),
    manualMobiles: z.union([z.array(z.string()), z.string()]).optional(),
    customMobile: z.string().optional(),
    templateVariables: z.record(z.string()).optional(),
    playerId: z.number().int().optional(),
    playerPhotoUrl: z.string().optional(),
    playerRole: z.string().optional(),
    teamId: z.number().int().optional(),
    teamLogoUrl: z.string().optional(),
    teamShortCode: z.string().optional(),
    teamColor: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const d = parsed.data;
  const canonicalTemplate = normalizeCommTemplateName(d.templateName);
  const isPlayerSoldTemplate =
    canonicalTemplate === META_AUCTION_PLAYER_SOLD_TEMPLATE ||
    canonicalTemplate === "player_sold";
  const isCustomOrFreeform = !canonicalTemplate || canonicalTemplate === "custom";

  // Ensure canonical templates are registered in wa_templates
  await ensureCanonicalTemplatesSeeded();

  let resolvedTemplateSid: string | undefined;

  // Validate approved template against authoritative database registry
  if (!isCustomOrFreeform) {
    const candidateRows = await db
      .select({
        templateName: waTemplatesTable.templateName,
        templateSid: waTemplatesTable.templateSid,
        status: waTemplatesTable.status,
      })
      .from(waTemplatesTable)
      .where(
        isPlayerSoldTemplate
          ? or(
              eq(waTemplatesTable.templateName, META_AUCTION_PLAYER_SOLD_TEMPLATE),
              eq(waTemplatesTable.templateName, "player_sold"),
            )
          : eq(waTemplatesTable.templateName, canonicalTemplate!),
      );

    // Prefer the canonical approved template if multiple alias rows exist
    const dbTmpl =
      candidateRows.find((t) => t.status === "approved" && t.templateName === META_AUCTION_PLAYER_SOLD_TEMPLATE) ??
      candidateRows.find((t) => t.status === "approved") ??
      candidateRows[0];

    if (!dbTmpl || dbTmpl.status !== "approved") {
      res.status(400).json({ error: `Template "${d.templateName}" is not approved.` });
      return;
    }
    resolvedTemplateSid = dbTmpl.templateSid ?? undefined;

    // Validate variables if template definition specifies them
    const canonicalDef =
      CANONICAL_WA_TEMPLATES[canonicalTemplate!] ??
      CANONICAL_WA_TEMPLATES[META_AUCTION_PLAYER_SOLD_TEMPLATE];
    if (canonicalDef && canonicalDef.variables.length > 0) {
      const isAutoDbPlayerSold = isPlayerSoldTemplate && d.tournamentId && (d.recipientGroup === "sold_players" || d.recipientGroup === "all_players");
      if (!isAutoDbPlayerSold) {
        const suppliedVars = d.templateVariables ?? {};
        const missingVars: string[] = [];
        for (const v of canonicalDef.variables) {
          const val = suppliedVars[v.key] ?? suppliedVars[v.label];
          if (!val || !val.trim()) {
            missingVars.push(`${v.label} ({{${v.key}}})`);
          }
        }
        if (missingVars.length > 0) {
          res.status(400).json({ error: `Missing required template variable(s): ${missingVars.join(", ")}` });
          return;
        }
        d.messageContent = interpolateTemplateVariables(canonicalDef.body, suppliedVars);
      }
    } else if (canonicalDef) {
      if (!d.messageContent.trim()) {
        d.messageContent = canonicalDef.body;
      }
    }
  } else {
    // Custom message requires non-empty message content
    if (!d.messageContent.trim()) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }
  }

  // Early recipient validation for manual/custom before DB queries
  if (d.recipientGroup === "manual" || d.recipientGroup === "custom" || (d.recipientGroup === "organizer" && (Boolean(d.customMobile) || Boolean(d.manualMobiles)))) {
    const rawMobiles: string[] = [];
    if (typeof d.customMobile === "string" && d.customMobile.trim()) {
      rawMobiles.push(d.customMobile.trim());
    }
    if (Array.isArray(d.manualMobiles)) {
      for (const m of d.manualMobiles) {
        if (typeof m === "string" && m.trim()) rawMobiles.push(m.trim());
      }
    } else if (typeof d.manualMobiles === "string" && d.manualMobiles.trim()) {
      rawMobiles.push(...d.manualMobiles.split(",").map((s) => s.trim()).filter(Boolean));
    }

    const uniqueRawMobiles = Array.from(new Set(rawMobiles.map((s) => s.trim()).filter(Boolean)));
    if (uniqueRawMobiles.length === 0) {
      res.status(400).json({ error: "At least one recipient mobile number is required" });
      return;
    }

    for (const raw of uniqueRawMobiles) {
      const normResult = validateAndNormalizeMobile(raw);
      if (!normResult.valid || !normResult.normalized) {
        res.status(400).json({ error: normResult.error || `Invalid mobile number: "${raw}"` });
        return;
      }
    }
  }

  // Player Sold template: personalized DLT SMS (+ optional WA) to sold players
  if (isPlayerSoldTemplate && (d.recipientGroup === "sold_players" || d.recipientGroup === "all_players")) {
    if (!d.tournamentId) {
      res.status(400).json({ error: "tournamentId is required for the player_sold template" });
      return;
    }
    if (d.recipientGroup !== "sold_players" && d.recipientGroup !== "all_players") {
      res.status(400).json({
        error: "player_sold template only supports sold_players (or all_players, which is filtered to sold)",
      });
      return;
    }

    const tid = d.tournamentId;
    const [tournament] = await db
      .select({
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        licenseStatus: tournamentsTable.licenseStatus,
        adminLocked: tournamentsTable.adminLocked,
        scoringEnabled: tournamentsTable.scoringEnabled,
        scoringPhase: tournamentsTable.scoringPhase,
        licenseGrantedAt: tournamentsTable.licenseGrantedAt,
        featuresJson: tournamentsTable.featuresJson,
        auctionUnit: tournamentsTable.auctionUnit,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid));
    if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

    if (d.channel === "whatsapp" || d.channel === "both") {
      if (!isTournamentLicensedForComm(tournament)) {
        const rawFeatures = tournament.featuresJson;
        const features = rawFeatures ? resolveTournamentFeatures(rawFeatures) : null;
        const errMsg = features?.whatsappNotifications === false
          ? "WhatsApp messaging has been disabled for this tournament by an administrator"
          : "WhatsApp messaging requires a live license and unlocked tournament";
        res.status(403).json({ error: errMsg });
        return;
      }
    }

    // Resolve DLT template ID (env takes priority, same as auction auto-send)
    const [smsSettings] = await db.select().from(smsNotificationSettingsTable).limit(1);
    const envTemplateId = playerSoldTemplateId();
    const dltTemplateId = envTemplateId || smsSettings?.playerSoldTemplateId || null;

    // SMS path (direct or WA→SMS consent fallback) needs the DLT template ID
    if ((d.channel === "sms" || d.channel === "both") && !dltTemplateId) {
      res.status(400).json({
        error: "Player Sold DLT template ID is not configured. Set BULKSMS_PLAYER_SOLD_TEMPLATE_ID or configure it in SMS settings.",
      });
      return;
    }

    const soldPlayers = await db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        mobileNumber: playersTable.mobileNumber,
        soldPrice: playersTable.soldPrice,
        teamId: playersTable.teamId,
        whatsappConsent: playersTable.whatsappConsent,
      })
      .from(playersTable)
      .where(and(
        eq(playersTable.tournamentId, tid),
        eq(playersTable.status, "sold"),
        sql`${playersTable.mobileNumber} IS NOT NULL AND ${playersTable.mobileNumber} != ''`,
      ));

    if (soldPlayers.length === 0) {
      res.status(400).json({ error: "No sold players with mobile numbers found for this tournament" });
      return;
    }

    const teamIds = [...new Set(soldPlayers.map(p => p.teamId).filter((id): id is number => id != null))];
    const teamRows = teamIds.length > 0
      ? await db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable).where(inArray(teamsTable.id, teamIds))
      : [];
    const teamNameById = new Map(teamRows.map(t => [t.id, t.name]));

    const appUrl = process.env.APP_URL?.trim() || getPublicOrigin();
    const blastId = generateBlastId();
    const results: Array<{ mobile: string; channel: string; success: boolean; stub?: boolean; error?: string; blocked?: boolean }> = [];
    const logTemplateName = META_AUCTION_PLAYER_SOLD_TEMPLATE;

    logger.info({
      tournamentId: tid,
      soldCount: soldPlayers.length,
      channel: d.channel,
      dltTemplateId,
      templateIdSource: envTemplateId ? "env" : "db",
    }, "Admin communicate: auction_player_sold blast starting");

    const tournUnit = normalizeAuctionUnit(tournament.auctionUnit);

    for (const player of soldPlayers) {
      const mobile = player.mobileNumber!;
      const playerName = player.name ?? "Player";
      const teamName = (player.teamId != null ? teamNameById.get(player.teamId) : null) ?? "Team";
      const amount = player.soldPrice ?? 0;
      const amtFormatted = formatAuctionAmount(amount, tournUnit);
      const shouldSendWa = (d.channel === "whatsapp" || d.channel === "both");
      const shouldSendSms = (d.channel === "sms" || d.channel === "both");

      if (shouldSendWa) {
        const waBody = buildPlayerSoldWaMessage({
          playerName,
          teamName,
          amount: amtFormatted,
          tournamentName: tournament.name,
          auctionUnit: tournUnit,
        });

        const isRevoked = await isMobileRevoked(mobile);
        if (!player.whatsappConsent || isRevoked) {
          const err = isRevoked
            ? "Recipient has revoked WhatsApp updates (opted-out via STOP/declined)"
            : "Recipient has no WhatsApp consent (missing_or_unverified_consent)";
          await db.insert(commLogsTable).values({
            tournamentId: tid,
            recipientType: "player",
            recipientId: player.id,
            recipientMobile: mobile,
            channel: "whatsapp",
            templateName: logTemplateName,
            messageContent: waBody,
            sentByAdminId: "master_admin",
            blastId,
            deliveryStatus: "failed",
            metaMessageId: null,
            errorMessage: err,
          });
          results.push({ mobile, channel: "whatsapp", success: false, blocked: true, error: err });
        } else {
          const playerSoldComponents = [
            {
              type: "header" as const,
              parameters: [
                {
                  type: "image" as const,
                  image: { link: resolvePlayerSoldImageUrl() },
                },
              ],
            },
            {
              type: "body" as const,
              parameters: [
                { type: "text" as const, text: playerName },
                { type: "text" as const, text: teamName },
                { type: "text" as const, text: amtFormatted },
                { type: "text" as const, text: tournament.name },
              ],
            },
          ];

          const waResult = await sendWhatsApp(mobile, waBody, resolvedTemplateSid, {
            type: "template",
            templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
            templateLanguage: META_AUCTION_PLAYER_SOLD_LANGUAGE,
            templateComponents: playerSoldComponents,
          });
          await db.insert(commLogsTable).values({
            tournamentId: tid,
            recipientType: "player",
            recipientId: player.id,
            recipientMobile: mobile,
            channel: "whatsapp",
            templateName: logTemplateName,
            messageContent: waBody,
            sentByAdminId: "master_admin",
            blastId,
            deliveryStatus: waResult.success ? "sent" : "failed",
            metaMessageId: waResult.messageSid ?? null,
            errorMessage: waResult.error ?? null,
          });
          results.push({ mobile, channel: "whatsapp", success: waResult.success, stub: waResult.stub, error: waResult.error });
        }
      }

      if (shouldSendSms) {
        if (!dltTemplateId) {
          const err = "Player Sold DLT template ID is not configured";
          await db.insert(commLogsTable).values({
            tournamentId: tid,
            recipientType: "player",
            recipientId: player.id,
            recipientMobile: mobile,
            channel: "sms",
            templateName: logTemplateName,
            messageContent: buildPlayerSoldSmsPreview({ playerName, teamName, amount, appUrl }),
            sentByAdminId: "master_admin",
            blastId,
            deliveryStatus: "failed",
            metaMessageId: null,
            errorMessage: err,
          });
          results.push({ mobile, channel: "sms", success: false, error: err });
        } else {
          // DLT vars must match approved sample: 1=player, 2=team, 3=amount, 4=app URL
          const smsResult = await sendDltSms(
            [mobile],
            dltTemplateId,
            [playerName, teamName, String(amount), appUrl],
          );
          const preview = buildPlayerSoldSmsPreview({ playerName, teamName, amount, appUrl });
          await db.insert(commLogsTable).values({
            tournamentId: tid,
            recipientType: "player",
            recipientId: player.id,
            recipientMobile: mobile,
            channel: "sms",
            templateName: logTemplateName,
            messageContent: preview,
            sentByAdminId: "master_admin",
            blastId,
            deliveryStatus: smsResult.success ? "sent" : "failed",
            metaMessageId: null,
            errorMessage: smsResult.error ?? null,
          });
          results.push({ mobile, channel: "sms", success: smsResult.success, error: smsResult.error });
        }
      }
    }

    const sentCount = results.filter(r => r.success).length;
    const blockedCount = results.filter(r => (r as any).blocked || (!r.success && r.error?.includes("consent"))).length;
    const failedCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      blastId,
      template: "player_sold",
      total: results.length,
      sent: sentCount,
      blocked: blockedCount,
      failed: failedCount,
      stub: results.some(r => r.stub),
      results,
    });
    return;
  }

  // License gate for WhatsApp — "active" is the licensed status in this system.
  // All WhatsApp sends (including manual/custom) require a tournamentId so the
  // license can be verified; no anonymous/license-free WA blasts allowed.
  if (d.channel === "whatsapp" || d.channel === "both") {
    const isPlatformOnboarding = canonicalTemplate === META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE;
    if (!d.tournamentId && !isPlatformOnboarding) {
      res.status(400).json({ error: "tournamentId is required for WhatsApp sends to enforce license gating" });
      return;
    }
    if (d.tournamentId) {
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
        .where(eq(tournamentsTable.id, d.tournamentId));
      if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }
      if (!isTournamentLicensedForComm(t)) {
        const rawFeatures = t.featuresJson;
        const features = rawFeatures ? resolveTournamentFeatures(rawFeatures) : null;
        const errMsg = features?.whatsappNotifications === false
          ? "WhatsApp messaging has been disabled for this tournament by an administrator"
          : "WhatsApp messaging requires a live license and unlocked tournament";
        res.status(403).json({ error: errMsg });
        return;
      }
    }
  }

  // Build recipient list
  type Recipient = { mobile: string; recipientType: string; recipientId: number | null; whatsappConsent: boolean };
  const recipients: Recipient[] = [];
  const seenRecipients = new Set<string>();

  if (d.recipientGroup === "manual" || d.recipientGroup === "custom" || (d.recipientGroup === "organizer" && (Boolean(d.customMobile) || Boolean(d.manualMobiles)))) {
    const rawMobiles: string[] = [];
    if (typeof d.customMobile === "string" && d.customMobile.trim()) {
      rawMobiles.push(d.customMobile.trim());
    }
    if (Array.isArray(d.manualMobiles)) {
      for (const m of d.manualMobiles) {
        if (typeof m === "string" && m.trim()) rawMobiles.push(m.trim());
      }
    } else if (typeof d.manualMobiles === "string" && d.manualMobiles.trim()) {
      rawMobiles.push(...d.manualMobiles.split(",").map((s) => s.trim()).filter(Boolean));
    }

    const seenRaw = new Set<string>();
    const uniqueRawMobiles: string[] = [];
    for (const raw of rawMobiles) {
      const trimmed = raw.trim();
      if (trimmed && !seenRaw.has(trimmed)) {
        seenRaw.add(trimmed);
        uniqueRawMobiles.push(trimmed);
      }
    }

    if (uniqueRawMobiles.length === 0) {
      res.status(400).json({ error: "At least one recipient mobile number is required" });
      return;
    }

    for (const raw of uniqueRawMobiles) {
      const normResult = validateAndNormalizeMobile(raw);
      if (!normResult.valid || !normResult.normalized) {
        res.status(400).json({ error: normResult.error || `Invalid mobile number: "${raw}"` });
        return;
      }
      const mobile = normResult.normalized;
      const revoked = await isMobileRevoked(mobile);
      let consent = false;
      let recipientType = "manual";
      let recipientId: number | null = null;

      if (!revoked) {
        // P0-C: Must resolve to an attributable verified recipient with explicit affirmative opt-in
        const norm = mobile.replace(/\D/g, "").replace(/^0/, "91");
        const tenDigit = norm.length === 12 && norm.startsWith("91") ? norm.slice(2) : norm;

        // Try players
        const playerConds = [
          or(
            eq(playersTable.mobileNumber, mobile),
            eq(playersTable.mobileNumber, norm),
            eq(playersTable.mobileNumber, tenDigit),
            sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`,
          ),
        ];
        if (d.tournamentId) {
          playerConds.push(eq(playersTable.tournamentId, d.tournamentId));
        }
        const pQ = db
          .select({ id: playersTable.id, whatsappConsent: playersTable.whatsappConsent })
          .from(playersTable)
          .where(and(...playerConds));
        const pRows = typeof (pQ as any)?.limit === "function" ? await (pQ as any).limit(1) : await pQ;
        const p = Array.isArray(pRows) ? pRows[0] : null;

        if (p && p.whatsappConsent) {
          consent = true;
          recipientType = "player";
          recipientId = p.id;
        } else if (!p) {
          // Try team owners
          const teamConds = [
            or(
              eq(teamsTable.ownerMobile, mobile),
              eq(teamsTable.ownerMobile, norm),
              eq(teamsTable.ownerMobile, tenDigit),
              sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`,
            ),
          ];
          if (d.tournamentId) {
            teamConds.push(eq(teamsTable.tournamentId, d.tournamentId));
          }
          const tQ = db
            .select({ id: teamsTable.id, whatsappConsent: teamsTable.whatsappConsent })
            .from(teamsTable)
            .where(and(...teamConds));
          const tRows = typeof (tQ as any)?.limit === "function" ? await (tQ as any).limit(1) : await tQ;
          const tm = Array.isArray(tRows) ? tRows[0] : null;

          if (tm && tm.whatsappConsent) {
            consent = true;
            recipientType = "team_owner";
            recipientId = tm.id;
          } else if (!tm) {
            // Try organizers
            const oQ = db
              .select({ id: organizersTable.id, whatsappConsent: organizersTable.whatsappConsent })
              .from(organizersTable)
              .where(
                or(
                  eq(organizersTable.mobile, mobile),
                  eq(organizersTable.mobile, norm),
                  eq(organizersTable.mobile, tenDigit),
                ),
              );
            const oRows = typeof (oQ as any)?.limit === "function" ? await (oQ as any).limit(1) : await oQ;
            const org = Array.isArray(oRows) ? oRows[0] : null;

            if (org && org.whatsappConsent) {
              consent = true;
              recipientType = "organizer";
              recipientId = org.id;
            }
          }
        }
      }

      const normKey = mobile.replace(/\D/g, "").replace(/^0/, "91");
      if (!seenRecipients.has(normKey)) {
        seenRecipients.add(normKey);
        recipients.push({
          mobile,
          recipientType,
          recipientId,
          whatsappConsent: consent,
        });
      }
    }
  } else if (d.recipientGroup === "organizer") {
    if (d.tournamentId) {
      const [t] = await db.select({ organizerMobile: tournamentsTable.organizerMobile, organizerId: tournamentsTable.organizerId }).from(tournamentsTable).where(eq(tournamentsTable.id, d.tournamentId));
      if (t?.organizerMobile) {
        let orgConsent = false;
        if (t.organizerId) {
          const [org] = await db.select({ whatsappConsent: organizersTable.whatsappConsent })
            .from(organizersTable).where(eq(organizersTable.id, t.organizerId));
          orgConsent = org?.whatsappConsent ?? false;
        }
        const isRevoked = await isMobileRevoked(t.organizerMobile);
        const normKey = t.organizerMobile.replace(/\D/g, "").replace(/^0/, "91");
        if (!seenRecipients.has(normKey)) {
          seenRecipients.add(normKey);
          recipients.push({ mobile: t.organizerMobile, recipientType: "organizer", recipientId: t.organizerId, whatsappConsent: Boolean(orgConsent && !isRevoked) });
        }
      }
    } else if (d.customMobile) {
      const normResult = validateAndNormalizeMobile(d.customMobile);
      if (normResult.valid && normResult.normalized) {
        const mobile = normResult.normalized;
        const norm = mobile.replace(/\D/g, "").replace(/^0/, "91");
        const tenDigit = norm.length === 12 && norm.startsWith("91") ? norm.slice(2) : norm;
        const orgRows = await db.select({ id: organizersTable.id, whatsappConsent: organizersTable.whatsappConsent })
          .from(organizersTable)
          .where(or(eq(organizersTable.mobile, mobile), eq(organizersTable.mobile, norm), eq(organizersTable.mobile, tenDigit)));
        const org = Array.isArray(orgRows) ? orgRows[0] : null;
        const isRevoked = await isMobileRevoked(mobile);
        recipients.push({
          mobile,
          recipientType: "organizer",
          recipientId: org?.id ?? null,
          whatsappConsent: Boolean((org?.whatsappConsent ?? true) && !isRevoked),
        });
      }
    }
  } else if (d.tournamentId) {
    const tid = d.tournamentId;
    if (d.recipientGroup === "all_players" || d.recipientGroup === "sold_players" || d.recipientGroup === "unsold_players") {
      const conds = [eq(playersTable.tournamentId, tid), sql`${playersTable.mobileNumber} IS NOT NULL AND ${playersTable.mobileNumber} != ''`];
      if (d.recipientGroup === "sold_players") conds.push(eq(playersTable.status, "sold"));
      if (d.recipientGroup === "unsold_players") conds.push(eq(playersTable.status, "unsold"));
      const players = await db.select({ id: playersTable.id, mobileNumber: playersTable.mobileNumber, whatsappConsent: playersTable.whatsappConsent }).from(playersTable).where(and(...conds));
      for (const p of players) {
        if (p.mobileNumber) {
          const normKey = p.mobileNumber.replace(/\D/g, "").replace(/^0/, "91");
          if (!seenRecipients.has(normKey)) {
            seenRecipients.add(normKey);
            const isRevoked = await isMobileRevoked(p.mobileNumber);
            recipients.push({ mobile: p.mobileNumber, recipientType: "player", recipientId: p.id, whatsappConsent: Boolean(p.whatsappConsent && !isRevoked) });
          }
        }
      }
    } else if (d.recipientGroup === "all_owners") {
      const teamConds = [eq(teamsTable.tournamentId, tid), sql`${teamsTable.ownerMobile} IS NOT NULL AND ${teamsTable.ownerMobile} != ''`];
      if (d.specificTeamId) teamConds.push(eq(teamsTable.id, d.specificTeamId));
      const teams = await db.select({ id: teamsTable.id, ownerMobile: teamsTable.ownerMobile, whatsappConsent: teamsTable.whatsappConsent }).from(teamsTable).where(and(...teamConds));
      for (const t of teams) {
        if (t.ownerMobile) {
          const normKey = t.ownerMobile.replace(/\D/g, "").replace(/^0/, "91");
          if (!seenRecipients.has(normKey)) {
            seenRecipients.add(normKey);
            const isRevoked = await isMobileRevoked(t.ownerMobile);
            recipients.push({ mobile: t.ownerMobile, recipientType: "team_owner", recipientId: t.id, whatsappConsent: Boolean(t.whatsappConsent && !isRevoked) });
          }
        }
      }
    }
  }

  if (recipients.length === 0) { res.status(400).json({ error: "No recipients found" }); return; }

  const blastId = generateBlastId();
  const results: Array<{ mobile: string; channel: string; success: boolean; stub?: boolean; error?: string; blocked?: boolean }> = [];
  const dispatchedMobiles = new Set<string>();

  for (const r of recipients) {
    const normRecipientKey = r.mobile.replace(/\D/g, "").replace(/^0/, "91");
    if (dispatchedMobiles.has(normRecipientKey)) {
      logger.info({ mobile: r.mobile }, "comm/send: skipping duplicate recipient in same broadcast batch");
      continue;
    }
    dispatchedMobiles.add(normRecipientKey);

    const shouldSendWa = (d.channel === "whatsapp" || d.channel === "both");
    const shouldSendSms = (d.channel === "sms" || d.channel === "both");

    if (shouldSendWa) {
      const isSoldTmpl =
        canonicalTemplate === META_AUCTION_PLAYER_SOLD_TEMPLATE ||
        d.templateName === "player_sold" ||
        d.templateName === META_AUCTION_PLAYER_SOLD_TEMPLATE;

      const effectiveWaTemplateName = isSoldTmpl
        ? META_AUCTION_PLAYER_SOLD_TEMPLATE
        : (d.templateName ?? null);

      if (!r.whatsappConsent) {
        const err = "Recipient has no WhatsApp consent or opted out (STOP / missing_or_unverified_consent)";
        await db.insert(commLogsTable).values({
          tournamentId: d.tournamentId ?? null,
          recipientType: r.recipientType,
          recipientId: r.recipientId,
          recipientMobile: r.mobile,
          channel: "whatsapp",
          templateName: effectiveWaTemplateName,
          messageContent: d.messageContent,
          sentByAdminId: "master_admin",
          blastId,
          deliveryStatus: "failed",
          metaMessageId: null,
          errorMessage: err,
        });
        results.push({ mobile: r.mobile, channel: "whatsapp", success: false, blocked: true, error: err });
      } else {
        let templateComponents: any = undefined;
        let loggedContent = d.messageContent;
        if (isSoldTmpl) {
          const suppliedVars = d.templateVariables ?? {};
          const rawAmt = suppliedVars["3"] ?? suppliedVars["Sold Amount"] ?? suppliedVars["Sold Amount (₹)"] ?? suppliedVars["Sold Amount (Pt.)"] ?? "0";
          const trimmedRaw = String(rawAmt).trim();
          let tournUnit: AuctionUnit = trimmedRaw.startsWith("₹") ? "rupee" : "points";
          if (d.tournamentId) {
            try {
              const [tRow] = await db
                .select({ auctionUnit: tournamentsTable.auctionUnit })
                .from(tournamentsTable)
                .where(eq(tournamentsTable.id, d.tournamentId))
                .limit(1);
              if (tRow?.auctionUnit) {
                tournUnit = normalizeAuctionUnit(tRow.auctionUnit);
              }
            } catch {
              // fallback
            }
          }

          const var1 = suppliedVars["1"] ?? suppliedVars["Player Name"] ?? "Player";
          const var2 = suppliedVars["2"] ?? suppliedVars["Winning Team"] ?? suppliedVars["Team Name"] ?? "Team";
          const parsedAmt = parseFloat(String(rawAmt).replace(/[^0-9.]/g, "")) || 0;
          let var3: string;
          if (tournUnit === "points") {
            if (trimmedRaw.endsWith("Pt.") && !trimmedRaw.startsWith("₹")) {
              var3 = trimmedRaw;
            } else {
              var3 = formatAuctionAmount(parsedAmt, "points");
            }
          } else {
            if (trimmedRaw.startsWith("₹") && !trimmedRaw.endsWith("Pt.")) {
              var3 = trimmedRaw;
            } else {
              var3 = formatAuctionAmount(parsedAmt, "rupee");
            }
          }
          const var4 = suppliedVars["4"] ?? suppliedVars["Tournament Name"] ?? "Auction";
          loggedContent = buildPlayerSoldWaMessage({
            playerName: var1,
            teamName: var2,
            amount: var3,
            tournamentName: var4,
            auctionUnit: tournUnit,
          });

          let dynamicHeaderUrl = resolvePlayerSoldImageUrl();
          try {
            const posterRes = await generateAndHostPlayerSoldPoster({
              tournamentId: d.tournamentId || 0,
              playerId: d.playerId || (r.recipientType === "player" ? r.recipientId : undefined),
              playerName: var1,
              playerPhotoUrl: d.playerPhotoUrl,
              playerRole: d.playerRole,
              teamId: d.teamId || d.specificTeamId,
              teamName: var2,
              teamLogoUrl: d.teamLogoUrl,
              teamShortCode: d.teamShortCode,
              teamColor: d.teamColor,
              amount: parsedAmt,
              auctionUnit: tournUnit,
              tournamentName: var4,
            });
            if (posterRes?.publicUrl) {
              dynamicHeaderUrl = posterRes.publicUrl;
            }
          } catch (pErr) {
            logger.warn({ err: pErr }, "comm/send: dynamic poster generation fell back to resolved URL");
          }

          templateComponents = [
            {
              type: "header" as const,
              parameters: [
                {
                  type: "image" as const,
                  image: { link: dynamicHeaderUrl },
                },
              ],
            },
            {
              type: "body" as const,
              parameters: [
                { type: "text" as const, text: var1 },
                { type: "text" as const, text: var2 },
                { type: "text" as const, text: var3 },
                { type: "text" as const, text: var4 },
              ],
            },
          ];
        }

        const isOrgWelcome = canonicalTemplate === META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE;
        if (isOrgWelcome && !templateComponents) {
          const suppliedVars = d.templateVariables ?? {};
          const var1 = suppliedVars["1"] ?? suppliedVars["Organiser Name"] ?? suppliedVars["Organizer Name"] ?? "Organiser";
          templateComponents = [
            {
              type: "body" as const,
              parameters: [{ type: "text" as const, text: var1 }],
            },
          ];
        }

        const waResult = await sendWhatsApp(
          r.mobile,
          d.messageContent,
          resolvedTemplateSid,
          (isSoldTmpl || isOrgWelcome)
            ? {
                type: "template",
                templateName: isSoldTmpl ? META_AUCTION_PLAYER_SOLD_TEMPLATE : META_ORGANISER_ONBOARDING_WELCOME_TEMPLATE,
                templateLanguage: isSoldTmpl ? META_AUCTION_PLAYER_SOLD_LANGUAGE : META_ORGANISER_ONBOARDING_WELCOME_LANGUAGE,
                templateComponents,
              }
            : undefined,
        );

        await db.insert(commLogsTable).values({
          tournamentId: d.tournamentId ?? null,
          recipientType: r.recipientType,
          recipientId: r.recipientId,
          recipientMobile: r.mobile,
          channel: "whatsapp",
          templateName: effectiveWaTemplateName,
          messageContent: loggedContent,
          sentByAdminId: "master_admin",
          blastId,
          deliveryStatus: waResult.success ? "sent" : "failed",
          metaMessageId: waResult.messageSid ?? null,
          errorMessage: waResult.error ?? null,
        });
        results.push({ mobile: r.mobile, channel: "whatsapp", success: waResult.success, stub: waResult.stub, error: waResult.error });
      }
    }

    if (shouldSendSms) {
      const smsResult = await sendSms(r.mobile, d.messageContent);
      await db.insert(commLogsTable).values({
        tournamentId: d.tournamentId ?? null,
        recipientType: r.recipientType,
        recipientId: r.recipientId,
        recipientMobile: r.mobile,
        channel: "sms",
        templateName: d.templateName ?? null,
        messageContent: d.messageContent,
        sentByAdminId: "master_admin",
        blastId,
        deliveryStatus: smsResult.success ? "sent" : "failed",
        metaMessageId: smsResult.messageSid ?? null,
        errorMessage: smsResult.error ?? null,
      });
      results.push({ mobile: r.mobile, channel: "sms", success: smsResult.success, stub: smsResult.stub, error: smsResult.error });
    }
  }

  const sentCount = results.filter(r => r.success).length;
  const blockedCount = results.filter(r => (r as any).blocked || (!r.success && r.error?.includes("consent"))).length;
  const failedCount = results.filter(r => !r.success).length;

  res.json({
    success: true,
    blastId,
    total: results.length,
    sent: sentCount,
    blocked: blockedCount,
    failed: failedCount,
    stub: results.some(r => r.stub),
    results,
  });
});

// ─── WhatsApp Provider Status (admin-managed, read-only) ───────────────────────

router.get("/auth/admin/communicate/provider-status", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const providerId = resolveWhatsAppProviderId();
  const provider = getWhatsAppProvider(providerId);
  const validation = provider.validateConfig();

  const isConfigured = providerId !== "none";
  let status: "unconfigured" | "invalid_config" | "configured" | "mock";
  if (providerId === "none") {
    status = "unconfigured";
  } else if (providerId === "mock") {
    status = "mock";
  } else if (!validation.valid) {
    status = "invalid_config";
  } else {
    status = "configured";
  }

  const providerDisplayNames: Record<string, string> = {
    kv_techmedia: "KV TechMedia",
    twilio: "Twilio WhatsApp",
    meta_direct: "Meta Direct Cloud API",
    mock: "Mock Provider (Test/Dev Only)",
    none: "Not Configured",
  };

  // Query recent delivery logs for WhatsApp channel to give truthful health metrics without pinging live provider
  let recentHealth = {
    totalLogged: 0,
    deliveredCount: 0,
    failedCount: 0,
    lastDispatchedAt: null as string | null,
    lastDeliveryStatus: null as string | null,
  };

  try {
    const recentLogs = await db
      .select({
        id: commLogsTable.id,
        deliveryStatus: commLogsTable.deliveryStatus,
        sentAt: commLogsTable.sentAt,
      })
      .from(commLogsTable)
      .where(eq(commLogsTable.channel, "whatsapp"))
      .orderBy(desc(commLogsTable.sentAt))
      .limit(50);

    if (Array.isArray(recentLogs) && recentLogs.length > 0) {
      recentHealth.totalLogged = recentLogs.length;
      recentHealth.deliveredCount = recentLogs.filter((l) =>
        ["sent", "delivered", "read"].includes(l.deliveryStatus || "")
      ).length;
      recentHealth.failedCount = recentLogs.filter(
        (l) => l.deliveryStatus === "failed"
      ).length;
      recentHealth.lastDispatchedAt = recentLogs[0].sentAt
        ? new Date(recentLogs[0].sentAt).toISOString()
        : null;
      recentHealth.lastDeliveryStatus = recentLogs[0].deliveryStatus ?? null;
    }
  } catch (err) {
    logger.warn({ err }, "provider-status: unable to query commLogsTable");
  }

  res.json({
    provider: providerId,
    displayName: providerDisplayNames[providerId] || providerId,
    configured: isConfigured,
    configValid: validation.valid,
    configErrors: validation.errors,
    status,
    verifiedConnectivity: false,
    connectivityNote: "Live connectivity not verified via live ping to conserve provider quota and prevent accidental billing",
    environment: process.env.NODE_ENV || "development",
    isProduction: process.env.NODE_ENV === "production",
    deliveryHealth: recentHealth,
  });
});

// ─── WhatsApp Template Config (admin-managed) ─────────────────────────────────

router.get("/auth/admin/communicate/templates", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  await ensureCanonicalTemplatesSeeded();
  const templates = await db.select().from(waTemplatesTable).orderBy(waTemplatesTable.templateName);
  const approvedOnly = req.query.approved_only === "true" || req.query.approvedOnly === "true";

  const enriched = templates.map((t) => {
    const isAllowlisted = isMetaApprovedTemplate(t.templateName);
    const verifiedTpl = isAllowlisted ? VERIFIED_APPROVED_TEMPLATES[normalizeTemplateKey(t.templateName)!] : undefined;
    const devTpl = !isAllowlisted ? DEV_UNAPPROVED_TEMPLATES[t.templateName] : undefined;
    const canonical = verifiedTpl || CANONICAL_WA_TEMPLATES[t.templateName];

    // Authoritative status resolution: a template is only approved if confirmed by Meta evidence
    const authoritativeStatus = isAllowlisted ? "approved" : (t.status === "approved" ? "unapproved" : t.status);

    return {
      id: t.id,
      templateName: t.templateName,
      metaTemplateName: isAllowlisted ? (verifiedTpl?.metaTemplateName || t.templateName) : (devTpl?.metaTemplateName || null),
      templateSid: t.templateSid,
      category: verifiedTpl?.category || t.category || canonical?.category || "utility",
      description: verifiedTpl?.description || devTpl?.description || t.description || canonical?.description || "",
      status: authoritativeStatus,
      title: verifiedTpl?.title || devTpl?.title || canonical?.title || t.templateName,
      displayName: verifiedTpl?.displayName || devTpl?.title || canonical?.title || t.templateName,
      body: verifiedTpl?.body || devTpl?.body || canonical?.body || "",
      language: verifiedTpl?.language || canonical?.language || "en",
      headerType: verifiedTpl?.headerType || canonical?.headerType || "none",
      headerImageUrl: verifiedTpl?.headerImageUrl || canonical?.headerImageUrl || null,
      metaApproved: isAllowlisted,
      isUsableInBidwar: isAllowlisted,
      variables: verifiedTpl?.variables || devTpl?.variables || canonical?.variables || [],
      sampleArgs: verifiedTpl?.sampleArgs || devTpl?.sampleArgs || canonical?.sampleArgs || [],
      evidenceSource: isAllowlisted
        ? (verifiedTpl?.evidenceSource || "Meta WhatsApp Business Manager (WABA) Confirmed Template Registry")
        : "None (development placeholder)",
      evidenceTimestamp: isAllowlisted ? (verifiedTpl?.evidenceTimestamp || "2026-10-29T00:00:00Z") : null,
      liveSyncAvailable: false,
      liveSyncNote: isAllowlisted
        ? "Live Meta Graph API sync unavailable without direct Meta credentials; serving previously verified approval evidence."
        : "Template is not approved in Meta; live sync not applicable.",
      connectedEvents: verifiedTpl?.connectedEvents || devTpl?.connectedEvents || [],
      exclusionReason: isAllowlisted
        ? null
        : (devTpl?.reason || "Not an approved Meta template on the BIDWAR allowlist"),
    };
  });

  if (approvedOnly) {
    res.json(enriched.filter((t) => t.metaApproved && t.isUsableInBidwar));
    return;
  }

  res.json(enriched);
});

router.post("/auth/admin/communicate/templates", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Master admin required" }); return; }
  const schema = z.object({
    templateName: z.string().min(1),
    templateSid: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [created] = await db.insert(waTemplatesTable)
    .values({ ...parsed.data, status: "approved" })
    .onConflictDoUpdate({ target: waTemplatesTable.templateName, set: { templateSid: parsed.data.templateSid ?? null, category: parsed.data.category ?? null, description: parsed.data.description ?? null, status: "approved" } })
    .returning();
  res.status(201).json(created);
});

router.patch("/auth/admin/communicate/templates/:id", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Master admin required" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    status: z.enum(["approved", "paused", "rejected"]).optional(),
    templateSid: z.string().optional(),
    description: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.templateSid !== undefined) updates.templateSid = parsed.data.templateSid;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  const [updated] = await db.update(waTemplatesTable).set(updates).where(eq(waTemplatesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(updated);
});

router.delete("/auth/admin/communicate/templates/:id", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Master admin required" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(waTemplatesTable).where(eq(waTemplatesTable.id, id));
  res.json({ success: true });
});

// ─── Communication Logs ────────────────────────────────────────────────────────

router.get("/auth/admin/communicate/logs", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

  const tournamentId = req.query.tournamentId ? parseInt(String(req.query.tournamentId)) : null;
  const channel = String(req.query.channel || "");
  const status = String(req.query.status || "");
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  const limit = Math.min(parseInt(String(req.query.limit || "100")), 500);
  const offset = parseInt(String(req.query.offset || "0"));

  const conds = [];
  if (tournamentId && !isNaN(tournamentId)) conds.push(eq(commLogsTable.tournamentId, tournamentId));
  if (channel) conds.push(eq(commLogsTable.channel, channel));
  if (status) conds.push(eq(commLogsTable.deliveryStatus, status));
  if (from) conds.push(gte(commLogsTable.sentAt, from));
  if (to) conds.push(lte(commLogsTable.sentAt, to));

  const logs = await db.select().from(commLogsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(commLogsTable.sentAt))
    .limit(limit)
    .offset(offset);

  res.json(logs);
});

router.get("/auth/admin/communicate/logs/:id", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [log] = await db.select().from(commLogsTable).where(eq(commLogsTable.id, id));
  if (!log) { res.status(404).json({ error: "Not found" }); return; }
  res.json(log);
});

// ─── Simulate WhatsApp Delivery Receipt (Admin / Dev / QA) ────────────────────

router.post("/auth/admin/communicate/simulate-receipt", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const { commLogId, metaMessageId, status, errorMessage } = req.body ?? {};
  if (!status || !["sent", "delivered", "read", "failed"].includes(status)) {
    res.status(400).json({ error: "Invalid status. Allowed: 'sent', 'delivered', 'read', 'failed'" });
    return;
  }

  let targetRow;
  if (commLogId) {
    const id = parseInt(String(commLogId), 10);
    const [row] = await db.select().from(commLogsTable).where(eq(commLogsTable.id, id)).limit(1);
    targetRow = row;
  } else if (metaMessageId) {
    const [row] = await db.select().from(commLogsTable).where(eq(commLogsTable.metaMessageId, String(metaMessageId))).limit(1);
    targetRow = row;
  } else {
    res.status(400).json({ error: "Either commLogId or metaMessageId is required" });
    return;
  }

  if (!targetRow) {
    res.status(404).json({ error: "Communication log not found" });
    return;
  }

  const STATUS_RANK: Record<string, number> = {
    pending: 0,
    submitted: 10,
    sent: 20,
    delivered: 30,
    read: 40,
    failed: 50,
  };

  const currentRank = STATUS_RANK[targetRow.deliveryStatus] ?? 0;
  const newRank = STATUS_RANK[status] ?? 0;

  if (newRank >= currentRank || status === "failed") {
    const updateData: {
      deliveryStatus: string;
      deliveryUpdatedAt: Date;
      errorMessage?: string | null;
    } = {
      deliveryStatus: status,
      deliveryUpdatedAt: new Date(),
    };
    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }
    await db.update(commLogsTable).set(updateData).where(eq(commLogsTable.id, targetRow.id));
    const [updated] = await db.select().from(commLogsTable).where(eq(commLogsTable.id, targetRow.id));
    res.json({ success: true, log: updated, updated: true });
    return;
  }

  res.json({
    success: false,
    message: "Out of order status ignored by monotonic guard",
    log: targetRow,
    updated: false,
  });
});

// ─── Automated Blast History ───────────────────────────────────────────────────

router.get("/auth/admin/communicate/blasts", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const tournamentId = req.query.tournamentId ? parseInt(String(req.query.tournamentId)) : null;
  const conds = tournamentId ? [eq(consentBlastLogTable.tournamentId, tournamentId)] : [];
  const entries = await db.select().from(consentBlastLogTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(consentBlastLogTable.sentAt))
    .limit(200);
  res.json(entries);
});

// ─── Missing Contacts (players/teams with no mobile) ─────────────────────────

router.get("/auth/admin/communicate/missing-contacts/:tournamentId", async (req, res) => {
  if (!req.jwtUser.isAdmin && !req.jwtUser.organizerAccountId) { res.status(403).json({ error: "Not authorized" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!req.jwtUser.isAdmin && req.jwtUser.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId }).from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    if (!t || t.organizerId !== req.jwtUser.organizerAccountId) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  const missingPlayers = await db
    .select({ id: playersTable.id, name: playersTable.name, role: playersTable.role })
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tid), sql`${playersTable.mobileNumber} IS NULL OR ${playersTable.mobileNumber} = ''`));

  const missingOwners = await db
    .select({ id: teamsTable.id, name: teamsTable.name, ownerName: teamsTable.ownerName })
    .from(teamsTable)
    .where(and(eq(teamsTable.tournamentId, tid), sql`${teamsTable.ownerMobile} IS NULL OR ${teamsTable.ownerMobile} = ''`));

  res.json({ missingPlayers, missingOwners });
});

// ─── Bulk In-Person Consent Declaration (Decommissioned P0-A) ────────────────

router.post("/auth/admin/communicate/consent-declare-bulk", async (req, res) => {
  if (!req.jwtUser.isAdmin && !req.jwtUser.organizerAccountId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  // P0-A: Decommissioned bulk third-party consent declaration
  res.status(403).json({
    error: "Third-party WhatsApp consent declaration is prohibited. Each recipient must opt in individually via verifiable affirmative action.",
    code: "THIRD_PARTY_CONSENT_PROHIBITED",
  });
});

// ─── Consent Status for a Tournament ─────────────────────────────────────────

router.get("/auth/admin/communicate/consent-status/:tournamentId", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [playerStats] = await db.select({
    total: sql<number>`count(*)::int`,
    consented: sql<number>`sum(case when whatsapp_consent then 1 else 0 end)::int`,
    hasMobile: sql<number>`sum(case when mobile_number is not null and mobile_number != '' then 1 else 0 end)::int`,
  }).from(playersTable).where(eq(playersTable.tournamentId, tid));

  const [ownerStats] = await db.select({
    total: sql<number>`count(*)::int`,
    consented: sql<number>`sum(case when whatsapp_consent then 1 else 0 end)::int`,
    hasMobile: sql<number>`sum(case when owner_mobile is not null and owner_mobile != '' then 1 else 0 end)::int`,
  }).from(teamsTable).where(eq(teamsTable.tournamentId, tid));

  res.json({ players: playerStats, owners: ownerStats });
});

// ─── Recent Sales for Communication Preview ─────────────────────────────────

router.get("/auth/admin/communicate/recent-sales/:tournamentId", async (req, res) => {
  if (!req.jwtUser || (!req.jwtUser.isAdmin && !req.jwtUser.organizerAccountId)) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [tourn] = await db
      .select({
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        sport: tournamentsTable.sport,
        auctionUnit: tournamentsTable.auctionUnit,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid))
      .limit(1);

    if (!tourn) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const soldPlayers = await db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        photoUrl: playersTable.photoUrl,
        role: playersTable.role,
        soldPrice: playersTable.soldPrice,
        teamId: playersTable.teamId,
      })
      .from(playersTable)
      .where(and(eq(playersTable.tournamentId, tid), eq(playersTable.status, "sold")))
      .orderBy(desc(playersTable.soldPrice))
      .limit(30);

    const teamIds = Array.from(new Set(soldPlayers.map((p) => p.teamId).filter(Boolean))) as number[];
    const teams = teamIds.length > 0
      ? await db
          .select({
            id: teamsTable.id,
            name: teamsTable.name,
            logoUrl: teamsTable.logoUrl,
            shortCode: teamsTable.shortCode,
            color: teamsTable.color,
          })
          .from(teamsTable)
          .where(inArray(teamsTable.id, teamIds))
      : [];

    const teamMap = new Map(teams.map((t) => [t.id, t]));

    const sales = soldPlayers.map((p) => {
      const t = p.teamId ? teamMap.get(p.teamId) : null;
      const amt = p.soldPrice ?? 0;
      const unit = normalizeAuctionUnit(tourn.auctionUnit);
      return {
        id: p.id,
        playerName: p.name,
        playerPhotoUrl: p.photoUrl ?? null,
        playerRole: p.role ?? null,
        teamId: p.teamId,
        teamName: t?.name ?? "Team",
        teamLogoUrl: t?.logoUrl ?? null,
        teamShortCode: t?.shortCode ?? null,
        teamColor: t?.color ?? null,
        amount: amt,
        formattedAmount: formatAuctionAmount(amt, unit),
        tournamentName: tourn.name,
        tournamentSport: tourn.sport ?? "Cricket",
        auctionUnit: unit,
      };
    });

    res.json({ tournament: tourn, sales });
  } catch (err) {
    logger.error({ err, tid }, "Failed to fetch recent sales for communicate");
    res.status(500).json({ error: "Failed to fetch recent sales" });
  }
});

export default router;
