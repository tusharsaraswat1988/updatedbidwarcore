import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import {
  purseBoostersTable,
  teamsTable,
  auctionSessionsTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { isOrganizerOrAdmin } from "../middleware/require-organizer";
import { parseAuditReason } from "../lib/audit-reason";
import { auditLog, resolveActor } from "../lib/audit-service";
import {
  computeEffectiveCapacity,
  getActiveBoosterTotal,
  validateCancelBooster,
} from "../lib/purse-capacity";
import { broadcastState, getOrCreateSession } from "./auction";

const router = Router();

function boosterToOrganizerJson(b: typeof purseBoostersTable.$inferSelect) {
  return {
    id: b.id,
    localUuid: b.localUuid,
    tournamentId: b.tournamentId,
    teamId: b.teamId,
    amount: b.amount,
    reason: b.reason,
    status: b.status,
    createdByLabel: b.createdByLabel,
    createdAt: b.createdAt.toISOString(),
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    cancelReason: b.cancelReason,
    previousCapacity: b.previousCapacity,
    newCapacity: b.newCapacity,
  };
}

function boosterToPublicJson(b: typeof purseBoostersTable.$inferSelect) {
  return {
    id: b.id,
    teamId: b.teamId,
    amount: b.amount,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    previousCapacity: b.previousCapacity,
    newCapacity: b.newCapacity,
  };
}

function capacitySnapshot(originalPurse: number, boosterTotal: number, purseUsed: number) {
  const effectiveCapacity = computeEffectiveCapacity(originalPurse, boosterTotal);
  return {
    originalPurse,
    boosterTotal,
    effectiveCapacity,
    purseUsed,
    purseRemaining: effectiveCapacity - purseUsed,
  };
}

// GET all boosters (organizer — includes reason)
router.get("/tournaments/:tournamentId/purse-boosters", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

  const teamIdParam = req.query.teamId;
  const statusParam = typeof req.query.status === "string" ? req.query.status : undefined;

  const conditions = [eq(purseBoostersTable.tournamentId, tid)];
  if (teamIdParam != null && teamIdParam !== "") {
    const parsedTeamId = parseInt(String(teamIdParam));
    if (!isNaN(parsedTeamId)) conditions.push(eq(purseBoostersTable.teamId, parsedTeamId));
  }
  if (statusParam) conditions.push(eq(purseBoostersTable.status, statusParam));

  const rows = await db
    .select()
    .from(purseBoostersTable)
    .where(and(...conditions))
    .orderBy(desc(purseBoostersTable.createdAt));

  res.json(rows.map(boosterToOrganizerJson));
});

// GET team boosters — public/owner view (no reason)
router.get("/tournaments/:tournamentId/teams/:teamId/purse-boosters", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const rows = await db
    .select()
    .from(purseBoostersTable)
    .where(and(eq(purseBoostersTable.tournamentId, tid), eq(purseBoostersTable.teamId, teamId)))
    .orderBy(desc(purseBoostersTable.createdAt));

  const isOrganizer = isOrganizerOrAdmin(req, tid);
  res.json(isOrganizer ? rows.map(boosterToOrganizerJson) : rows.map(boosterToPublicJson));
});

// POST apply purse booster(s)
router.post("/tournaments/:tournamentId/purse-boosters", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

  const schema = z.object({
    target: z.enum(["single", "all"]),
    teamId: z.number().int().optional(),
    amount: z.number().int().positive("Amount must be greater than zero"),
    reason: z.string(),
    showOnLed: z.boolean().optional().default(true),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }

  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) {
    res.status(400).json({ error: reasonResult.error });
    return;
  }

  const { target, amount, showOnLed } = parsed.data;
  if (target === "single" && !parsed.data.teamId) {
    res.status(400).json({ error: "teamId is required when target is single" });
    return;
  }

  let targetTeams: Array<typeof teamsTable.$inferSelect>;
  if (target === "all") {
    targetTeams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid));
    if (targetTeams.length === 0) {
      res.status(400).json({ error: "No teams in tournament" });
      return;
    }
  } else {
    const [team] = await db
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, parsed.data.teamId!), eq(teamsTable.tournamentId, tid)));
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    targetTeams = [team];
  }

  const actor = resolveActor(req, tid)!;
  const applied: Array<{
    boosterId: number;
    teamId: number;
    teamName: string;
    amount: number;
    previousCapacity: number;
    newCapacity: number;
  }> = [];

  let lastNotification: {
    id: number;
    teamId: number;
    teamName: string;
    amount: number;
    previousCapacity: number;
    newCapacity: number;
    appliedAt: string;
  } | null = null;

  let ledToast: { teamName: string; expiresAt: string } | null = null;

  for (const team of targetTeams) {
    const boosterTotal = await getActiveBoosterTotal(tid, team.id);
    const previousCapacity = computeEffectiveCapacity(team.purse, boosterTotal);
    const newCapacity = previousCapacity + amount;
    const beforeSnap = capacitySnapshot(team.purse, boosterTotal, team.purseUsed);
    const afterSnap = capacitySnapshot(team.purse, boosterTotal + amount, team.purseUsed);

    const [inserted] = await db
      .insert(purseBoostersTable)
      .values({
        localUuid: randomUUID(),
        tournamentId: tid,
        teamId: team.id,
        amount,
        reason: reasonResult.reason!,
        status: "active",
        createdByType: actor.type,
        createdById: actor.id,
        createdByLabel: actor.label,
        previousCapacity,
        newCapacity,
        origin: "cloud",
        syncState: "synced",
      })
      .returning();

    auditLog(req, {
      category: "finance",
      action: "finance.purse_booster_added",
      summary: `Purse booster +₹${amount.toLocaleString("en-IN")} applied to ${team.name}`,
      severity: "critical",
      reason: reasonResult.reason,
      tournamentId: tid,
      teamId: team.id,
      resource: { type: "purse_booster", id: inserted.id },
      before: beforeSnap,
      after: afterSnap,
      metadata: { amount, target, localUuid: inserted.localUuid },
      alertKey: "purse_booster",
    });

    applied.push({
      boosterId: inserted.id,
      teamId: team.id,
      teamName: team.name,
      amount,
      previousCapacity,
      newCapacity,
    });

    lastNotification = {
      id: inserted.id,
      teamId: team.id,
      teamName: team.name,
      amount,
      previousCapacity,
      newCapacity,
      appliedAt: inserted.createdAt.toISOString(),
    };

    if (showOnLed && target === "single") {
      ledToast = {
        teamName: team.name,
        expiresAt: new Date(Date.now() + 5000).toISOString(),
      };
    }
  }

  if (showOnLed && target === "all") {
    ledToast = {
      teamName: "All Teams",
      expiresAt: new Date(Date.now() + 5000).toISOString(),
    };
  }

  await getOrCreateSession(tid);
  await db
    .update(auctionSessionsTable)
    .set({
      lastPurseBoosterJson: lastNotification ? JSON.stringify(lastNotification) : null,
      lastLedToastJson: ledToast ? JSON.stringify(ledToast) : null,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  await broadcastState(tid, ["purses", "auction_state"]);

  res.status(201).json({ applied, totalTeamsAffected: applied.length });
});

// POST cancel booster
router.post("/tournaments/:tournamentId/purse-boosters/:boosterId/cancel", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const boosterId = parseInt(req.params.boosterId);
  if (isNaN(tid) || isNaN(boosterId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

  const cancelReasonResult = parseAuditReason(req.body, true);
  if (!cancelReasonResult.ok) {
    res.status(400).json({ error: cancelReasonResult.error });
    return;
  }

  const [booster] = await db
    .select()
    .from(purseBoostersTable)
    .where(and(eq(purseBoostersTable.id, boosterId), eq(purseBoostersTable.tournamentId, tid)));
  if (!booster) { res.status(404).json({ error: "Booster not found" }); return; }
  if (booster.status !== "active") {
    res.status(400).json({ error: "Booster is already cancelled" });
    return;
  }

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, booster.teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const validation = await validateCancelBooster(
    tid,
    team.id,
    team.purse,
    team.purseUsed,
    booster.amount,
  );
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const boosterTotal = await getActiveBoosterTotal(tid, team.id);
  const beforeSnap = capacitySnapshot(team.purse, boosterTotal, team.purseUsed);
  const afterSnap = capacitySnapshot(team.purse, boosterTotal - booster.amount, team.purseUsed);

  const actor = resolveActor(req, tid)!;
  const now = new Date();

  const [updated] = await db
    .update(purseBoostersTable)
    .set({
      status: "cancelled",
      cancelledByType: actor.type,
      cancelledById: actor.id,
      cancelledByLabel: actor.label,
      cancelledAt: now,
      cancelReason: cancelReasonResult.reason,
    })
    .where(eq(purseBoostersTable.id, boosterId))
    .returning();

  auditLog(req, {
    category: "finance",
    action: "finance.purse_booster_cancelled",
    summary: `Purse booster +₹${booster.amount.toLocaleString("en-IN")} cancelled for ${team.name}`,
    severity: "critical",
    reason: cancelReasonResult.reason,
    tournamentId: tid,
    teamId: team.id,
    resource: { type: "purse_booster", id: boosterId },
    before: beforeSnap,
    after: afterSnap,
    metadata: { amount: booster.amount, localUuid: booster.localUuid },
    alertKey: "purse_booster",
  });

  await broadcastState(tid, ["purses"]);

  res.json(boosterToOrganizerJson(updated));
});

export default router;
