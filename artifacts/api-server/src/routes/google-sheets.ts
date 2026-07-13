import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { buildPublicUrl } from "../lib/runtime-env.js";
import {
  googleSheetsOwnerKey,
  setGoogleSheetsOAuthCookie,
} from "../lib/google-sheets-oauth.js";
import {
  GOOGLE_SHEETS_SCOPES,
  GoogleSheetsNotConnectedError,
} from "../lib/google-sheets-service.js";
import { GOOGLE_OAUTH_CALLBACK_PATH } from "../lib/google-sheets-oauth-callback.js";
import { requireTournamentOrganizer } from "../middleware/require-organizer.js";
import {
  connectAndSyncTournamentGoogleSheet,
  disconnectTournamentGoogleSheet,
  getTournamentGoogleSheetStatus,
} from "../lib/google-sheets-sync-service.js";
import { runGoogleSheetSyncNow } from "../lib/google-sheets-sync-queue.js";
import type { Request } from "express";

/** Safe post-OAuth redirect — blocks auth/setup pages that would loop. */
function sanitizeSheetsOAuthNext(raw: string | undefined): string | undefined {
  if (!raw?.startsWith("/")) return undefined;
  const blocked = new Set(["/complete-profile", "/organizer", "/api"]);
  if (blocked.has(raw) || raw.startsWith("/complete-profile?") || raw.startsWith("/api/")) {
    return undefined;
  }
  return raw;
}

const router = Router();

const tournamentIdQuerySchema = z.object({
  tournamentId: z.coerce.number().int().positive(),
});

const tournamentIdBodySchema = z.object({
  tournamentId: z.number().int().positive(),
});

function resolveOwnerKey(req: Request): string | null {
  return googleSheetsOwnerKey(req.jwtUser?.organizerAccountId, !!req.jwtUser?.isAdmin);
}

async function resolveOrganizerId(req: Request, tournamentId: number): Promise<number | null> {
  if (req.jwtUser?.organizerAccountId) return req.jwtUser.organizerAccountId;
  const [tournament] = await db
    .select({ organizerId: tournamentsTable.organizerId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  return tournament?.organizerId ?? null;
}

/** GET /google/sheets/status?tournamentId= — OAuth + sheet sync status */
router.get("/google/sheets/status", async (req, res) => {
  const parsed = tournamentIdQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "tournamentId required" });
    return;
  }
  const tid = parsed.data.tournamentId;
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const status = await getTournamentGoogleSheetStatus(
    tid,
    req.jwtUser?.organizerAccountId,
    !!req.jwtUser?.isAdmin,
  );
  res.json(status);
});

/** GET /google/sheets/connect?next=&tournamentId= — start Google OAuth */
router.get("/google/sheets/connect", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google integration not configured" });
    return;
  }

  const ownerKey = resolveOwnerKey(req);
  if (!ownerKey) {
    res.status(403).json({ error: "Authentication required" });
    return;
  }

  const next = sanitizeSheetsOAuthNext(req.query.next as string | undefined);
  const state = randomBytes(32).toString("hex");
  setGoogleSheetsOAuthCookie(res, { state, next, ownerKey, purpose: "sheets" });

  const redirectUri = buildPublicUrl(GOOGLE_OAUTH_CALLBACK_PATH);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SHEETS_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

/** POST /google/sheets/sync — create sheet if needed, or regenerate existing */
router.post("/google/sheets/sync", async (req, res) => {
  const parsed = tournamentIdBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const tid = parsed.data.tournamentId;
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const organizerId = await resolveOrganizerId(req, tid);
  if (!organizerId) {
    res.status(403).json({ error: "Organizer account required", needsGoogleAuth: true });
    return;
  }

  try {
    const result = await connectAndSyncTournamentGoogleSheet(tid, organizerId, req.log);
    res.json({
      success: true,
      created: result.created,
      spreadsheetUrl: result.spreadsheetUrl,
      spreadsheetId: result.spreadsheetId,
      playerCount: result.playerCount,
    });
  } catch (err) {
    if (err instanceof GoogleSheetsNotConnectedError) {
      res.status(401).json({ error: "Google account not connected", needsGoogleAuth: true });
      return;
    }
    req.log.error({ err, tournamentId: tid }, "Google Sheets sync failed");
    const message = err instanceof Error ? err.message : "Sync failed";
    res.status(502).json({ error: message });
  }
});

/** POST /google/sheets/sync-now — force immediate sync of existing sheet */
router.post("/google/sheets/sync-now", async (req, res) => {
  const parsed = tournamentIdBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const tid = parsed.data.tournamentId;
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  try {
    const result = await runGoogleSheetSyncNow(tid, req.log);
    if (!result) {
      res.status(404).json({ error: "No Google Sheet configured for this tournament" });
      return;
    }
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof GoogleSheetsNotConnectedError) {
      res.status(401).json({ error: "Google account not connected", needsGoogleAuth: true, syncStatus: "DISCONNECTED" });
      return;
    }
    req.log.error({ err, tournamentId: tid }, "Google Sheets sync-now failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Sync failed" });
  }
});

/** DELETE /google/sheets/disconnect — remove sheet link (does not delete Google file) */
router.delete("/google/sheets/disconnect", async (req, res) => {
  const parsed = tournamentIdBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const tid = parsed.data.tournamentId;
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  await disconnectTournamentGoogleSheet(tid);
  res.json({ success: true });
});

/** GET /google/sheets/open?tournamentId= — return spreadsheet URL */
router.get("/google/sheets/open", async (req, res) => {
  const parsed = tournamentIdQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "tournamentId required" });
    return;
  }
  const tid = parsed.data.tournamentId;
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const status = await getTournamentGoogleSheetStatus(tid, req.jwtUser?.organizerAccountId, !!req.jwtUser?.isAdmin);
  if (!status.spreadsheetUrl) {
    res.status(404).json({ error: "No Google Sheet linked" });
    return;
  }
  res.json({ spreadsheetUrl: status.spreadsheetUrl });
});

export default router;
