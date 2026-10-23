import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, tournamentsTable } from "@workspace/db";
import { tryBeginAuctionCleanup } from "./auction-cleanup-lock";
import { auditLog } from "./audit-service";
import { snapshotTournament } from "./audit-snapshots";
import { invalidateIntelCacheForTournament } from "./intelligence-cache";
import { invalidateTournamentInsightsCache } from "./tournament-insights";
import {
  DemoResetConflictError,
  DemoResetForbiddenError,
  LicenseTournamentNotFoundError,
  grantTournamentLiveLicense,
  type AuctionDbTransaction,
} from "./auction-demo-reset";

export type LicenseStatusValue = "trial" | "active" | "completed";

export async function commitAdminLicenseTransition(
  req: Request,
  input: {
    tournamentId: number;
    nextStatus: LicenseStatusValue;
    grantedBy: string | null;
    recordGrant: boolean;
    scoringEnabled?: boolean;
    touchUpdatedAt?: boolean;
    reason?: string | null;
    auditAction: string;
    auditSummary: (tournamentName: string) => string;
    alertKey: string | null;
    afterWrite?: (tx: AuctionDbTransaction) => Promise<void>;
  },
): Promise<
  | { ok: true; tournament: typeof tournamentsTable.$inferSelect; demoRemoved: boolean }
  | { ok: false; status: number; body: { error: string; conflicts?: unknown } }
> {
  const [before] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, input.tournamentId));
  if (!before) return { ok: false, status: 404, body: { error: "Tournament not found" } };

  const trialToLive = before.licenseStatus === "trial" && input.nextStatus === "active";
  const cleanupLock = trialToLive ? tryBeginAuctionCleanup(input.tournamentId) : null;
  if (trialToLive && !cleanupLock) {
    return {
      ok: false,
      status: 409,
      body: { error: "A reset is cleaning up this tournament. Try again in a moment." },
    };
  }

  try {
    const outcome = await grantTournamentLiveLicense({
      tournamentId: input.tournamentId,
      nextStatus: input.nextStatus,
      grantedBy: input.grantedBy,
      actorLabel: "super_admin",
      authorized: true,
      recordGrant: input.recordGrant,
      scoringEnabled: input.scoringEnabled,
      touchUpdatedAt: input.touchUpdatedAt,
      afterWrite: input.afterWrite,
    });
    if (!outcome.tournament) {
      return { ok: false, status: 404, body: { error: "Tournament not found" } };
    }

    const unchanged = outcome.previousStatus === input.nextStatus && !outcome.demoRemoved;
    if (!unchanged) {
      auditLog(req, {
        category: "admin",
        action: input.auditAction,
        summary: input.auditSummary(before.name),
        severity: "critical",
        reason: input.reason ?? undefined,
        tournamentId: input.tournamentId,
        resource: { type: "tournament", id: input.tournamentId },
        before: snapshotTournament(before),
        after: snapshotTournament(outcome.tournament),
        alertKey: input.alertKey,
      });
    }
    if (outcome.demoRemoved && outcome.plan) {
      auditLog(req, {
        category: "auction",
        action: "auction.reset_demo",
        summary: `Demo session ${outcome.demoSessionId} removed while granting a live license`,
        severity: "critical",
        outcome: "success",
        reason: input.reason ?? undefined,
        tournamentId: input.tournamentId,
        resource: { type: "tournament", id: input.tournamentId },
        metadata: {
          source: "trial_to_live",
          demoSessionId: outcome.demoSessionId,
          removedMediaUrls: outcome.removedMediaUrls,
          deletedPlayers: outcome.plan.deletePlayerIds.length,
          deletedTeams: outcome.plan.deleteTeamIds.length,
          deletedMasterSponsors: outcome.plan.deleteMasterSponsorIds.length,
          deletedCategories: outcome.plan.deleteCategoryIds.length,
        },
        alertKey: "auction_reset_demo",
      });
      invalidateIntelCacheForTournament(input.tournamentId);
      invalidateTournamentInsightsCache(input.tournamentId);
    }
    if (trialToLive) {
      try {
        const { broadcastState } = await import("../routes/auction");
        await broadcastState(input.tournamentId, ["bids", "purses", "players", "teams"]);
      } catch (err) {
        req.log?.warn({ err, tournamentId: input.tournamentId }, "live license broadcast failed");
      }
    }
    return { ok: true, tournament: outcome.tournament, demoRemoved: outcome.demoRemoved };
  } catch (err) {
    if (err instanceof DemoResetConflictError) {
      auditLog(req, {
        category: "auction",
        action: "auction.reset_demo",
        summary: `Live license blocked because demo data for tournament ${input.tournamentId} could not be removed`,
        severity: "critical",
        outcome: "failure",
        reason: err.message,
        tournamentId: input.tournamentId,
        resource: { type: "tournament", id: input.tournamentId },
        metadata: { source: "trial_to_live", conflicts: err.conflicts },
        alertKey: "auction_reset_demo",
      });
      return { ok: false, status: 409, body: { error: err.message, conflicts: err.conflicts } };
    }
    if (err instanceof DemoResetForbiddenError) {
      auditLog(req, {
        category: "admin",
        action: input.auditAction,
        summary: `Live license denied for tournament ${input.tournamentId}`,
        severity: "warning",
        outcome: "denied",
        reason: err.message,
        tournamentId: input.tournamentId,
        resource: { type: "tournament", id: input.tournamentId },
        alertKey: input.alertKey,
      });
      return { ok: false, status: 403, body: { error: err.message } };
    }
    if (err instanceof LicenseTournamentNotFoundError) {
      return { ok: false, status: 404, body: { error: err.message } };
    }
    throw err;
  } finally {
    cleanupLock?.release();
  }
}
