import { Router } from "express";
import {
  canAccessPrivateTournamentData,
  requireTournamentOrganizer,
} from "../middleware/require-organizer";
import {
  checkVerifyAccessAllowed,
  clearAllTeamAccessLockouts,
  clearVerifyAccessFailures,
  getTeamAccessLockoutStatus,
  getVerifyAccessGuardStatus,
  recordVerifyAccessFailure,
} from "../lib/verify-access-guard";
import { publicTeamSerializer, privateTeamSerializer } from "../lib/serializers/team";
import { db } from "@workspace/db";
import { teamsTable, tournamentsTable, organizersTable, playersTable, categoriesTable, auctionSessionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { computeAllTeamPurseProtections } from "../lib/purse-protection";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import { parseIndianMobile, mobilesMatch } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { buildPublicUrl } from "../lib/runtime-env";
import { auditLog } from "../lib/audit-service";
import { defaultTeamPatchReason, resolveAuditReasonWithDefault } from "../lib/audit-reason";
import { snapshotTeam } from "../lib/audit-snapshots";
import { notifyAsync } from "../lib/notifications";
import { recoverJobsForTeamEmailUpdate } from "../lib/communication/recovery.js";

const cloudinaryLogoUrl = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.startsWith("https://res.cloudinary.com/"),
    "Logo URL must be a Cloudinary HTTPS URL (https://res.cloudinary.com/...)",
  );

const router = Router();

function genAccessCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const DUPLICATE_OWNER_MOBILE_ERROR =
  "This mobile number is already assigned to another team in this tournament.";

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === "23505";
}

async function findDuplicateOwnerMobileTeam(
  tournamentId: number,
  normalizedMobile: string,
  excludeTeamId?: number,
) {
  const teams = await db
    .select({ id: teamsTable.id, ownerMobile: teamsTable.ownerMobile })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  for (const team of teams) {
    if (excludeTeamId !== undefined && team.id === excludeTeamId) continue;
    const other = parseIndianMobile(team.ownerMobile);
    if (other.ok && other.normalized === normalizedMobile) return team;
  }
  return null;
}

const teamToJson = privateTeamSerializer;
const teamToPublicJson = publicTeamSerializer;

router.get("/tournaments/:tournamentId/teams", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const isOrganizer = await canAccessPrivateTournamentData(req, tid);
  const serializer = isOrganizer ? teamToJson : teamToPublicJson;
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid))
    .orderBy(teamsTable.createdAt);
  res.json(
    teams.map((t) => {
      const base = serializer(t);
      if (!isOrganizer) return base;
      return { ...base, ...getTeamAccessLockoutStatus(tid, t.id) };
    }),
  );
});

router.post("/tournaments/:tournamentId/teams", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const schema = z.object({
    name: z.string().min(1),
    shortCode: z.string().min(1).max(5),
    ownerName: z.string().min(1),
    ownerMobile: z.string().min(1, "Owner mobile is required for communication features"),
    ownerEmail: z.string().optional(),
    ownerPhotoUrl: cloudinaryLogoUrl,
    color: z.string().optional(),
    logoUrl: cloudinaryLogoUrl,
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" }); return; }
  const d = parsed.data;

  const mobileParsed = parseIndianMobile(d.ownerMobile);
  if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
  const ownerMobile = mobileParsed.normalized;

  const ownerEmailParsed = parseOptionalEmail(d.ownerEmail);
  if (!ownerEmailParsed.ok) {
    res.status(400).json({ error: ownerEmailParsed.error, field: "ownerEmail" });
    return;
  }

  const existing = await db.select().from(teamsTable).where(and(eq(teamsTable.tournamentId, tid), eq(teamsTable.shortCode, d.shortCode.toUpperCase())));
  if (existing.length > 0) { res.status(400).json({ error: `Short code "${d.shortCode.toUpperCase()}" is already used by another team` }); return; }

  // Duplicate team name check (case-insensitive) within the same tournament
  const [dupName] = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(and(eq(teamsTable.tournamentId, tid), sql`lower(${teamsTable.name}) = lower(${d.name})`));
  if (dupName) { res.status(400).json({ error: `A team named "${d.name}" is already registered in this tournament.` }); return; }

  // Block organizer from using their own mobile as team owner mobile
  const orgAccountId = req.jwtUser?.organizerAccountId;
  if (orgAccountId) {
    const [org] = await db.select({ mobile: organizersTable.mobile }).from(organizersTable).where(eq(organizersTable.id, orgAccountId));
    if (org?.mobile && mobilesMatch(org.mobile, ownerMobile)) {
      res.status(400).json({ error: "You cannot use the organizer's own mobile number as a team owner mobile." }); return;
    }
  }

  const dupMobile = await findDuplicateOwnerMobileTeam(tid, ownerMobile);
  if (dupMobile) {
    res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  let team: typeof teamsTable.$inferSelect;
  try {
    [team] = await db
      .insert(teamsTable)
      .values({
        tournamentId: tid,
        name: d.name,
        shortCode: d.shortCode.toUpperCase(),
        ownerName: d.ownerName,
        ownerMobile,
        ownerEmail: ownerEmailParsed.email,
        ownerPhotoUrl: d.ownerPhotoUrl || null,
        color: d.color ?? "#3B82F6",
        logoUrl: d.logoUrl ?? null,
        purse: tournament.basePurse,
        purseUsed: 0,
        isBiddingEnabled: true,
        accessCode: genAccessCode(),
      })
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
      return;
    }
    throw err;
  }

  // DLT SMS: notify team owner about their access code (fire-and-forget, live tournaments only)
  const accessCode = team.accessCode;
  if (tournament.licenseStatus === "active" && ownerMobile && accessCode) {
    void (async () => {
      try {
        const { smsNotificationSettingsTable } = await import("@workspace/db");
        const { sendDltSms, teamOwnerTemplateId } = await import("../lib/fast2sms");
        const [settings] = await db.select().from(smsNotificationSettingsTable).limit(1);
        const templateId = teamOwnerTemplateId() || settings?.teamOwnerTemplateId;
        if (settings?.dltEnabled && settings.teamOwnerEnabled && templateId) {
          const ownerUrl = buildPublicUrl(ownerJoinPath(tid, team.id));
          await sendDltSms(
            [ownerMobile],
            templateId,
            [tournament.name, team.name, accessCode, ownerUrl],
          );
        }
      } catch (err) { logger.error({ err, teamId: team.id }, "DLT team-owner SMS failed"); }
    })();
  }

  notifyAsync("TEAM_OWNER_REGISTERED", {
    teamId: team.id,
    teamName: team.name,
    ownerName: team.ownerName,
    email: ownerEmailParsed.email ?? "",
    ownerPhotoUrl: team.ownerPhotoUrl,
    tournamentId: tid,
    tournamentName: tournament.name,
    tournamentLogoUrl: tournament.logoUrl ?? null,
  });

  auditLog(req, {
    category: "team",
    action: "team.created",
    summary: `Team "${team.name}" created`,
    tournamentId: tid,
    teamId: team.id,
    resource: { type: "team", id: team.id },
    after: snapshotTeam(team),
  });

  res.status(201).json(teamToJson(team));
});

// Scout endpoint — returns all teams with purse/squad data + unsold players.
// Must appear before the /:teamId route so "scout" isn't matched as a teamId.
router.get("/tournaments/:tournamentId/teams/scout", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [teams, allPlayers, categories] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid)).orderBy(teamsTable.createdAt),
    db.select({
      id: playersTable.id,
      name: playersTable.name,
      role: playersTable.role,
      status: playersTable.status,
      teamId: playersTable.teamId,
      categoryId: playersTable.categoryId,
      basePrice: playersTable.basePrice,
      soldPrice: playersTable.soldPrice,
      isNonPlayingMember: playersTable.isNonPlayingMember,
    }).from(playersTable).where(eq(playersTable.tournamentId, tid)),
    db.select({ id: categoriesTable.id, name: categoriesTable.name, colorCode: categoriesTable.colorCode, sortOrder: categoriesTable.sortOrder })
      .from(categoriesTable).where(eq(categoriesTable.tournamentId, tid)).orderBy(categoriesTable.sortOrder),
  ]);

  const purseMap = await computeAllTeamPurseProtections(tid, teams.map(t => ({ id: t.id, purse: t.purse, purseUsed: t.purseUsed })));
  const catMap   = new Map(categories.map(c => [c.id, c]));

  const scoutTeams = teams.map(team => {
    const p = purseMap.get(team.id) ?? {
      originalPurse: team.purse,
      boosterTotal: 0,
      effectiveCapacity: team.purse,
      purseRemaining: team.purse - team.purseUsed,
      reservePurse: 0,
      spendablePurse: team.purse - team.purseUsed,
      slotsRequired: 0,
      maximumSquadSize: 0,
      lowestBasePrice: 0,
    };
    const squadPlayers = allPlayers.filter(pl => pl.teamId === team.id && (pl.status === "sold" || pl.status === "retained"));
    const playersBought = squadPlayers.filter(pl => !pl.isNonPlayingMember).length;
    const maxBidCapacity = p.slotsRequired > 0 ? Math.floor(p.spendablePurse / p.slotsRequired) : p.spendablePurse;
    return {
      id: team.id, name: team.name, shortCode: team.shortCode, color: team.color, logoUrl: team.logoUrl,
      originalPurse: p.originalPurse,
      boosterTotal: p.boosterTotal,
      effectiveCapacity: p.effectiveCapacity,
      purse: p.effectiveCapacity,
      purseRemaining: p.purseRemaining,
      reservePurse: p.reservePurse,
      spendablePurse: p.spendablePurse,
      slotsRequired: p.slotsRequired,
      playersBought, maximumSquadSize: p.maximumSquadSize, maxBidCapacity,
      players: squadPlayers.map(pl => ({ id: pl.id, name: pl.name, role: pl.role, status: pl.status, soldPrice: pl.soldPrice, isNonPlayingMember: pl.isNonPlayingMember })),
    };
  });

  const unsoldPlayers = allPlayers
    .filter(pl => pl.status === "unsold")
    .map(pl => {
      const cat = pl.categoryId ? catMap.get(pl.categoryId) : null;
      return { id: pl.id, name: pl.name, role: pl.role, basePrice: pl.basePrice, categoryId: pl.categoryId ?? null, categoryName: cat?.name ?? null, categoryColor: cat?.colorCode ?? null, _sort: (cat?.sortOrder ?? 999) * 1e9 + pl.name.charCodeAt(0) };
    })
    .sort((a, b) => a._sort - b._sort || a.name.localeCompare(b.name))
    .map(({ _sort: _, ...rest }) => rest);

  res.json({ teams: scoutTeams, unsoldPlayers });
});

// GET single team — organizers get full data; unauthenticated callers get the
// public serializer (no accessCode, no ownerMobile) with requiresAccessCode boolean.
router.get("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Not found" }); return; }
  const isOrganizer = await canAccessPrivateTournamentData(req, tid);
  const base = isOrganizer ? teamToJson(team) : teamToPublicJson(team);
  res.json(isOrganizer ? { ...base, ...getTeamAccessLockoutStatus(tid, team.id) } : base);
});

router.patch("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const schema = z.object({
    name: z.string().optional(),
    shortCode: z.string().optional(),
    ownerName: z.string().optional(),
    ownerMobile: z.string().min(1).optional(),
    ownerEmail: z.string().optional(),
    ownerPhotoUrl: cloudinaryLogoUrl,
    color: z.string().optional(),
    logoUrl: cloudinaryLogoUrl,
    purse: z.number().int().optional(),
    isBiddingEnabled: z.boolean().optional(),
    regenerateCode: z.boolean().optional(),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }
  const d = parsed.data;

  const [beforeTeam] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!beforeTeam) { res.status(404).json({ error: "Not found" }); return; }

  if (d.purse !== undefined && d.purse !== beforeTeam.purse) {
    const [session] = await db
      .select({ status: auctionSessionsTable.status })
      .from(auctionSessionsTable)
      .where(eq(auctionSessionsTable.tournamentId, tid));
    const liveStatuses = new Set(["active", "paused", "idle"]);
    if (session && liveStatuses.has(session.status)) {
      res.status(403).json({
        error: "Direct purse edits are not allowed during live auction. Use Purse Booster from the Operator Panel.",
      });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) updates.name = d.name;
  if (d.shortCode !== undefined) updates.shortCode = d.shortCode;
  if (d.ownerName !== undefined) updates.ownerName = d.ownerName;
  let normalizedOwnerMobile: string | undefined;
  if (d.ownerMobile !== undefined) {
    const mobileParsed = parseIndianMobile(d.ownerMobile);
    if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
    normalizedOwnerMobile = mobileParsed.normalized;
    updates.ownerMobile = normalizedOwnerMobile;
  }
  if (d.ownerEmail !== undefined) {
    const ownerEmailParsed = parseOptionalEmail(d.ownerEmail);
    if (!ownerEmailParsed.ok) {
      res.status(400).json({ error: ownerEmailParsed.error, field: "ownerEmail" });
      return;
    }
    updates.ownerEmail = ownerEmailParsed.email;
  }
  if (d.ownerPhotoUrl !== undefined) updates.ownerPhotoUrl = d.ownerPhotoUrl || null;
  if (d.color !== undefined) updates.color = d.color;
  if (d.logoUrl !== undefined) updates.logoUrl = d.logoUrl || null;
  if (d.purse !== undefined) updates.purse = d.purse;
  if (d.isBiddingEnabled !== undefined) updates.isBiddingEnabled = d.isBiddingEnabled;
  if (d.regenerateCode) updates.accessCode = genAccessCode();

  if (normalizedOwnerMobile !== undefined) {
    const orgAccountId = req.jwtUser?.organizerAccountId;
    if (orgAccountId) {
      const [org] = await db.select({ mobile: organizersTable.mobile }).from(organizersTable).where(eq(organizersTable.id, orgAccountId));
      if (org?.mobile && mobilesMatch(org.mobile, normalizedOwnerMobile)) {
        res.status(400).json({ error: "You cannot use the organizer's own mobile number as a team owner mobile." });
        return;
      }
    }

    const dupMobile = await findDuplicateOwnerMobileTeam(tid, normalizedOwnerMobile, teamId);
    if (dupMobile) {
      res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
      return;
    }
  }

  let team: typeof teamsTable.$inferSelect;
  try {
    [team] = await db
      .update(teamsTable)
      .set(updates)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)))
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
      return;
    }
    throw err;
  }
  if (!team) { res.status(404).json({ error: "Not found" }); return; }

  if (d.ownerEmail !== undefined) {
    void recoverJobsForTeamEmailUpdate(teamId, team.ownerEmail).catch(() => {});
  }

  const reasonResult = resolveAuditReasonWithDefault(
    req.body,
    defaultTeamPatchReason(d),
  );
  if (!reasonResult.ok) {
    res.status(400).json({ error: reasonResult.error });
    return;
  }
  const reason = reasonResult.reason;
  const beforeSnap = snapshotTeam(beforeTeam);
  const afterSnap = snapshotTeam(team);

  let action = "team.updated";
  let alertKey: string | null = null;
  let severity: "info" | "warning" | "critical" = "info";
  if (d.purse !== undefined && d.purse !== beforeTeam.purse) {
    action = "team.purse_updated";
    alertKey = "purse_manual_edit";
    severity = "critical";
  } else if (
    d.ownerName !== undefined ||
    d.ownerMobile !== undefined ||
    d.ownerEmail !== undefined
  ) {
    action = "team.owner_changed";
    alertKey = "team_owner_changed";
    severity = "critical";
  } else if (d.regenerateCode) {
    action = "team.access_code_regenerated";
    alertKey = "access_code_regenerated";
    severity = "warning";
  }

  auditLog(req, {
    category: d.purse !== undefined ? "finance" : "team",
    action,
    summary: `Team "${team.name}" updated`,
    severity,
    reason,
    tournamentId: tid,
    teamId: team.id,
    resource: { type: "team", id: team.id },
    before: beforeSnap,
    after: afterSnap,
    alertKey,
  });

  res.json(teamToJson(team));
});

/** IP-scoped lockout status for owner-app polling after organiser unlock. */
router.get("/tournaments/:tournamentId/teams/:teamId/owner-access-lockout", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [team] = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Not found" }); return; }

  const status = getVerifyAccessGuardStatus(req, tid, teamId);
  res.json({
    locked: status.locked,
    lockoutRemainingSec: status.lockoutRemainingSec,
  });
});

router.post("/tournaments/:tournamentId/teams/:teamId/verify-access", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const guard = checkVerifyAccessAllowed(req, tid, teamId);
  if (!guard.allowed) {
    res.status(guard.status).json({ error: guard.error, lockoutRemainingSec: guard.lockoutRemainingSec });
    return;
  }

  const body = z.object({ code: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Not found" }); return; }
  const valid = !team.accessCode || team.accessCode.toUpperCase() === body.data.code.toUpperCase();
  if (!valid) {
    recordVerifyAccessFailure(req, tid, teamId);
  } else {
    clearVerifyAccessFailures(req, tid, teamId);
  }
  auditLog(req, {
    category: "auth",
    action: valid ? "team.access_code_verified" : "team.access_code_denied",
    summary: valid
      ? `Owner access verified for team "${team.name}"`
      : `Failed owner access attempt for team "${team.name}"`,
    outcome: valid ? "success" : "denied",
    severity: valid ? "info" : "warning",
    tournamentId: tid,
    teamId: team.id,
    resource: { type: "team", id: team.id },
    actor: { type: "team_owner", id: String(teamId), label: team.ownerName },
  });
  res.json({ valid });
});

router.post("/tournaments/:tournamentId/teams/:teamId/reset-access-lockout", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Not found" }); return; }

  const cleared = clearAllTeamAccessLockouts(tid, teamId);
  const organizerId = req.jwtUser?.organizerAccountId ?? null;
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  auditLog(req, {
    category: "auth",
    action: "OWNER_ACCESS_LOCKOUT_RESET",
    summary: `Owner access lockout cleared for team "${team.name}"`,
    outcome: "success",
    severity: "info",
    tournamentId: tid,
    teamId: team.id,
    resource: { type: "team", id: team.id },
    metadata: { organizerId, teamId, tournamentId: tid, ip, clearedEntries: cleared },
  });

  logger.info(
    { organizerId, teamId, tournamentId: tid, ip, cleared, timestamp: new Date().toISOString() },
    "OWNER_ACCESS_LOCKOUT_RESET",
  );

  res.json({ success: true, message: "Owner access lockout cleared" });
});

router.delete("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const [beforeTeam] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!beforeTeam) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [{ assignedCount }] = await db
    .select({ assignedCount: sql<number>`cast(count(*) as int)` })
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tid), eq(playersTable.teamId, teamId)));

  if (assignedCount > 0) {
    res.status(409).json({
      error: "This team has players assigned and cannot be deleted. Reassign or remove those players first.",
      code: "TEAM_HAS_PLAYERS",
      playerCount: assignedCount,
    });
    return;
  }

  await db.delete(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  auditLog(req, {
    category: "team",
    action: "team.deleted",
    summary: `Team "${beforeTeam.name}" deleted`,
    severity: "warning",
    tournamentId: tid,
    teamId,
    resource: { type: "team", id: teamId },
    before: snapshotTeam(beforeTeam),
  });
  res.status(204).send();
});

export default router;
