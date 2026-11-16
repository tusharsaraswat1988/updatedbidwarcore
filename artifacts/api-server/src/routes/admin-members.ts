import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../middleware/require-admin.js";
import {
  listMembers,
  getMemberDetail,
  updateMemberContact,
  getMemberKpis,
  reconcileAllPlatformMembers,
} from "../lib/members/member-directory-service.js";
import { pool, db, playersTable, teamsTable, membersTable, memberIdentityLinksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { parseIndianMobile } from "@workspace/api-base/mobile";

const router = Router();

/**
 * GET /auth/admin/members
 * Super Admin directory listing with KPIs, search, multi-role filter, sport filter,
 * tournament filter, contact quality status, and pagination.
 */
router.get("/auth/admin/members", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || "1"), 10);
    const limit = parseInt(String(req.query.limit || "25"), 10);
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "all").trim();
    const sport = String(req.query.sport || "all").trim();
    const contactStatus = String(req.query.contactStatus || "all") as
      | "all"
      | "missing_phone"
      | "verified"
      | "with_phone";
    const tournamentId = req.query.tournamentId ? parseInt(String(req.query.tournamentId), 10) : undefined;

    const [kpis, listResult] = await Promise.all([
      getMemberKpis(),
      listMembers({
        page,
        limit,
        search,
        role,
        sport,
        contactStatus,
        tournamentId,
      }),
    ]);

    res.json({
      success: true,
      kpis,
      members: listResult.members,
      pagination: {
        total: listResult.total,
        page: listResult.page,
        limit: listResult.limit,
        totalPages: listResult.totalPages,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin members list");
    res.status(500).json({ error: "Failed to retrieve members directory" });
  }
});

/**
 * GET /auth/admin/members/:id
 * Retrieve 360-degree deep-dive detail of a single member.
 */
router.get("/auth/admin/members/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const memberId = String(req.params.id || "");
    if (!memberId) {
      res.status(400).json({ error: "Member ID is required" });
      return;
    }

    const detail = await getMemberDetail(memberId);
    if (!detail) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    res.json({ success: true, member: detail });
  } catch (err) {
    req.log.error({ err, id: String(req.params.id) }, "Failed to fetch member details");
    res.status(500).json({ error: "Failed to retrieve member details" });
  }
});

/**
 * PATCH /auth/admin/members/:id
 * Update member contact information (mobile, email, display name, city, status)
 * and cascade updates to all linked player/owner/organizer records.
 */
router.patch("/auth/admin/members/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const memberId = String(req.params.id || "");
    const { primaryMobile, primaryEmail, displayName, city, accountStatus } = req.body || {};

    const result = await updateMemberContact(memberId, {
      primaryMobile,
      primaryEmail,
      displayName,
      city,
      accountStatus,
    });

    if (!result.success) {
      res.status(400).json({ error: result.error || "Failed to update member" });
      return;
    }

    res.json({ success: true, member: result.member });
  } catch (err) {
    req.log.error({ err, id: String(req.params.id) }, "Failed to update member contact");
    res.status(500).json({ error: "Failed to update member" });
  }
});

/**
 * POST /auth/admin/members/sync
 * Manually trigger canonical identity reconciliation across all legacy tables
 * (Team owners, organizers, scorers, players).
 */
router.post("/auth/admin/members/sync", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await reconcileAllPlatformMembers(pool);
    res.json({ success: true, result });
  } catch (err) {
    req.log.error({ err }, "Failed to execute identity reconciliation");
    res.status(500).json({ error: "Identity reconciliation failed" });
  }
});

/**
 * PATCH /auth/admin/communicate/contacts/player/:id
 * Direct bridge for the Communication Center "Contact Quality & Missing Mobile Resolver".
 * Updates the player's mobile number directly and syncs to canonical member.
 */
router.patch("/auth/admin/communicate/contacts/player/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(String(req.params.id), 10);
    const { mobile } = req.body || {};
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const parsed = parseIndianMobile(String(mobile || ""));
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    await db
      .update(playersTable)
      .set({ mobileNumber: parsed.normalized })
      .where(eq(playersTable.id, playerId));

    // Cascade to linked member record if present
    const linkRes = await pool.query<{ member_id: string }>(
      "SELECT member_id FROM member_identity_links WHERE source_table = 'players' AND source_record_id = $1 LIMIT 1",
      [String(playerId)],
    );

    if (linkRes.rows[0]?.member_id) {
      await db
        .update(membersTable)
        .set({ primaryMobile: parsed.normalized, isMobileVerified: true, updatedAt: new Date() })
        .where(eq(membersTable.id, linkRes.rows[0].member_id));
    }

    res.json({ success: true, mobile: parsed.normalized });
  } catch (err) {
    req.log.error({ err, id: String(req.params.id) }, "Failed to update player contact");
    res.status(500).json({ error: "Failed to update player contact" });
  }
});

/**
 * PATCH /auth/admin/communicate/contacts/team/:id
 * Direct bridge for the Communication Center "Contact Quality & Missing Mobile Resolver" for team owners.
 */
router.patch("/auth/admin/communicate/contacts/team/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    const { mobile } = req.body || {};
    if (isNaN(teamId)) {
      res.status(400).json({ error: "Invalid team ID" });
      return;
    }

    const parsed = parseIndianMobile(String(mobile || ""));
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    await db
      .update(teamsTable)
      .set({ ownerMobile: parsed.normalized })
      .where(eq(teamsTable.id, teamId));

    // Cascade to linked member record if present
    const linkRes = await pool.query<{ member_id: string }>(
      "SELECT member_id FROM member_identity_links WHERE source_table = 'teams' AND source_record_id = $1 LIMIT 1",
      [String(teamId)],
    );

    if (linkRes.rows[0]?.member_id) {
      await db
        .update(membersTable)
        .set({ primaryMobile: parsed.normalized, isMobileVerified: true, updatedAt: new Date() })
        .where(eq(membersTable.id, linkRes.rows[0].member_id));
    }

    res.json({ success: true, mobile: parsed.normalized });
  } catch (err) {
    req.log.error({ err, id: String(req.params.id) }, "Failed to update team owner contact");
    res.status(500).json({ error: "Failed to update team owner contact" });
  }
});

export default router;
