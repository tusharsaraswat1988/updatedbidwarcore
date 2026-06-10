import { Router } from "express";
import { db } from "@workspace/db";
import { sportsTable, sportRolesTable, roleSpecGroupsTable, roleSpecOptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { isScoringFeatureEnabled } from "../lib/scoring-feature";

const router = Router();

const DEFAULT_SPORTS = [
  { name: "Cricket", slug: "cricket" },
  { name: "Football", slug: "football" },
  { name: "Kabaddi", slug: "kabaddi" },
  { name: "Badminton", slug: "badminton" },
  { name: "Volleyball", slug: "volleyball" },
  { name: "E-Sports", slug: "esports" },
  { name: "Other", slug: "other" },
] as const;

function visibleSports<T extends { slug: string }>(sports: T[]): T[] {
  if (isScoringFeatureEnabled()) return sports;
  return sports.filter((s) => s.slug !== "badminton");
}

// ─── GET /sports ─────────────────────────────────────────────────────────────
// List all active sports (public — used by registration forms, tournament creation)
router.get("/sports", async (_req, res) => {
  const sports = await db
    .select()
    .from(sportsTable)
    .where(eq(sportsTable.active, true))
    .orderBy(sportsTable.name);

  if (sports.length === 0) {
    res.json(visibleSports([...DEFAULT_SPORTS]));
    return;
  }

  res.json(visibleSports(sports));
});

// ─── GET /sports/:sportId/roles ───────────────────────────────────────────────
// Roles for a given sport, ordered for display
router.get("/sports/:sportId/roles", async (req, res) => {
  const sportId = parseInt(req.params.sportId);
  if (isNaN(sportId)) { res.status(400).json({ error: "Invalid sport ID" }); return; }
  const roles = await db
    .select()
    .from(sportRolesTable)
    .where(and(eq(sportRolesTable.sportId, sportId), eq(sportRolesTable.active, true)))
    .orderBy(sportRolesTable.displayOrder, sportRolesTable.roleName);
  res.json(roles);
});

// ─── GET /sports/by-slug/:slug/roles ─────────────────────────────────────────
// Roles by sport slug (convenient for forms that have the sport text value)
router.get("/sports/by-slug/:slug/roles", async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const [sport] = await db
    .select()
    .from(sportsTable)
    .where(and(eq(sportsTable.slug, slug), eq(sportsTable.active, true)));
  if (!sport) {
    // Unknown sport — return generic "Player" role
    res.json([{ id: 0, sportId: 0, roleName: "Player", displayOrder: 0, active: true }]);
    return;
  }
  const roles = await db
    .select()
    .from(sportRolesTable)
    .where(and(eq(sportRolesTable.sportId, sport.id), eq(sportRolesTable.active, true)))
    .orderBy(sportRolesTable.displayOrder, sportRolesTable.roleName);
  res.json(roles);
});

// ─── GET /sports/roles/:roleId/specs ─────────────────────────────────────────
// Full spec groups + options for a role (used by dynamic registration form)
router.get("/sports/roles/:roleId/specs", async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  if (isNaN(roleId)) { res.status(400).json({ error: "Invalid role ID" }); return; }

  const groups = await db
    .select()
    .from(roleSpecGroupsTable)
    .where(and(eq(roleSpecGroupsTable.roleId, roleId), eq(roleSpecGroupsTable.active, true)))
    .orderBy(roleSpecGroupsTable.displayOrder);

  const groupsWithOptions = await Promise.all(
    groups.map(async (group) => {
      const options = await db
        .select()
        .from(roleSpecOptionsTable)
        .where(and(eq(roleSpecOptionsTable.groupId, group.id), eq(roleSpecOptionsTable.active, true)))
        .orderBy(roleSpecOptionsTable.displayOrder);
      return { ...group, options };
    }),
  );

  res.json(groupsWithOptions);
});

// ─── Admin: PATCH /auth/admin/sports/:sportId ─────────────────────────────────
router.patch("/auth/admin/sports/:sportId", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const sportId = parseInt(req.params.sportId);
  if (isNaN(sportId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({ name: z.string().optional(), active: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db
    .update(sportsTable)
    .set(parsed.data)
    .where(eq(sportsTable.id, sportId))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ─── Admin: POST /auth/admin/sports/:sportId/roles ────────────────────────────
router.post("/auth/admin/sports/:sportId/roles", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const sportId = parseInt(req.params.sportId);
  if (isNaN(sportId)) { res.status(400).json({ error: "Invalid sport ID" }); return; }
  const schema = z.object({ roleName: z.string().min(1), displayOrder: z.number().int().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [role] = await db
    .insert(sportRolesTable)
    .values({ sportId, roleName: parsed.data.roleName, displayOrder: parsed.data.displayOrder ?? 0 })
    .returning();
  res.status(201).json(role);
});

// ─── Admin: PATCH /auth/admin/sport-roles/:roleId ─────────────────────────────
router.patch("/auth/admin/sport-roles/:roleId", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const roleId = parseInt(req.params.roleId);
  if (isNaN(roleId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({ roleName: z.string().optional(), displayOrder: z.number().int().optional(), active: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db
    .update(sportRolesTable)
    .set(parsed.data)
    .where(eq(sportRolesTable.id, roleId))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ─── Admin: POST /auth/admin/sport-roles/:roleId/spec-groups ─────────────────
router.post("/auth/admin/sport-roles/:roleId/spec-groups", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const roleId = parseInt(req.params.roleId);
  if (isNaN(roleId)) { res.status(400).json({ error: "Invalid role ID" }); return; }
  const schema = z.object({
    groupName: z.string().min(1),
    displayOrder: z.number().int().optional(),
    optional: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [group] = await db
    .insert(roleSpecGroupsTable)
    .values({ roleId, groupName: parsed.data.groupName, displayOrder: parsed.data.displayOrder ?? 0, optional: parsed.data.optional ?? true })
    .returning();
  res.status(201).json(group);
});

// ─── Admin: POST /auth/admin/spec-groups/:groupId/options ────────────────────
router.post("/auth/admin/spec-groups/:groupId/options", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }
  const schema = z.object({ optionName: z.string().min(1), displayOrder: z.number().int().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [option] = await db
    .insert(roleSpecOptionsTable)
    .values({ groupId, optionName: parsed.data.optionName, displayOrder: parsed.data.displayOrder ?? 0 })
    .returning();
  res.status(201).json(option);
});

// ─── Admin: GET /auth/admin/sports-full ──────────────────────────────────────
// Full sport hierarchy: sports → roles → spec groups → options (admin only)
router.get("/auth/admin/sports-full", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const sports = await db.select().from(sportsTable).orderBy(sportsTable.name);
  const result = await Promise.all(sports.map(async (sport) => {
    const roles = await db
      .select().from(sportRolesTable)
      .where(eq(sportRolesTable.sportId, sport.id))
      .orderBy(sportRolesTable.displayOrder, sportRolesTable.roleName);
    const rolesWithSpecs = await Promise.all(roles.map(async (role) => {
      const groups = await db
        .select().from(roleSpecGroupsTable)
        .where(eq(roleSpecGroupsTable.roleId, role.id))
        .orderBy(roleSpecGroupsTable.displayOrder);
      const groupsWithOptions = await Promise.all(groups.map(async (group) => {
        const options = await db
          .select().from(roleSpecOptionsTable)
          .where(eq(roleSpecOptionsTable.groupId, group.id))
          .orderBy(roleSpecOptionsTable.displayOrder);
        return { ...group, options };
      }));
      return { ...role, specGroups: groupsWithOptions };
    }));
    return { ...sport, roles: rolesWithSpecs };
  }));
  res.json(result);
});

// ─── Admin: DELETE /auth/admin/spec-options/:optionId ────────────────────────
router.delete("/auth/admin/spec-options/:optionId", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const optionId = parseInt(req.params.optionId);
  if (isNaN(optionId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.update(roleSpecOptionsTable).set({ active: false }).where(eq(roleSpecOptionsTable.id, optionId));
  res.json({ ok: true });
});

// ─── Admin: DELETE /auth/admin/spec-groups/:groupId ──────────────────────────
router.delete("/auth/admin/spec-groups/:groupId", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.update(roleSpecGroupsTable).set({ active: false }).where(eq(roleSpecGroupsTable.id, groupId));
  res.json({ ok: true });
});

// ─── Admin: DELETE /auth/admin/sport-roles/:roleId ───────────────────────────
router.delete("/auth/admin/sport-roles/:roleId", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const roleId = parseInt(req.params.roleId);
  if (isNaN(roleId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.update(sportRolesTable).set({ active: false }).where(eq(sportRolesTable.id, roleId));
  res.json({ ok: true });
});

export default router;
