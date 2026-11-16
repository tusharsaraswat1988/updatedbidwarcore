import { pool, db } from "@workspace/db";
import {
  membersTable,
  memberRolesTable,
  memberSportProfilesTable,
  tournamentParticipationsTable,
  memberIdentityLinksTable,
  playersTable,
  teamsTable,
  tournamentsTable,
  organizersTable,
  scorerAccountsTable,
  globalPlayersTable,
} from "@workspace/db";
import { eq, and, sql, or, desc, inArray } from "drizzle-orm";
import { parseIndianMobile } from "@workspace/api-base/mobile";
import { applyIdentityLinkingProposal } from "@workspace/db/identity-linking";

export interface MemberListItem {
  id: string; // mem_*
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  primaryMobile: string | null;
  isMobileVerified: boolean;
  primaryEmail: string | null;
  isEmailVerified: boolean;
  city: string | null;
  avatarUrl: string | null;
  accountStatus: string;
  createdAt: string;
  roles: Array<{
    role: string;
    scope: string;
    tournamentId: number | null;
    tournamentName: string | null;
    teamId: number | null;
    teamName: string | null;
  }>;
  roleTypes: string[]; // ["player", "team_owner", "organizer", "scorer", etc.]
  teams: Array<{
    teamId: number;
    teamName: string;
    teamShortCode: string | null;
    tournamentId: number;
    tournamentName: string;
    roleInTeam: string; // "player" | "team_owner" | "coach"
    soldPrice: number | null;
    status: string | null;
    jerseyNumber: string | null;
  }>;
  sportProfiles: Array<{
    sportSlug: string;
    primaryRole: string | null;
    secondaryRole: string | null;
    handedness: string | null;
  }>;
  tournamentsCount: number;
  teamsCount: number;
  whatsappConsent: boolean;
}

export interface MemberDirectoryFilter {
  search?: string;
  role?: string; // "all" | "player" | "team_owner" | "organizer" | "scorer" | "multi_role"
  sport?: string; // "all" | "cricket" | "badminton"
  tournamentId?: number;
  contactStatus?: "all" | "missing_phone" | "verified" | "with_phone";
  page?: number;
  limit?: number;
}

export interface MemberKpis {
  totalMembers: number;
  activePlayers: number;
  franchiseOwners: number;
  scorersAndOfficials: number;
  missingPhone: number;
}

export interface MemberDetail extends MemberListItem {
  dob: string | null;
  gender: string | null;
  country: string | null;
  state: string | null;
  linkedIdentities: Array<{
    sourceTable: string;
    sourceRecordId: string;
    linkType: string;
    confidenceScore: number;
    status: string;
  }>;
}

/**
 * Ensure canonical member sync has been executed at least once so legacy records
 * (players, team owners, organizers, scorers) are present in membersTable.
 */
let hasCheckedInitialSync = false;

export async function ensureMembersSynchronized(): Promise<void> {
  if (hasCheckedInitialSync) return;
  try {
    const memberCountRes = await pool.query<{ c: string }>("SELECT COUNT(*) as c FROM members");
    const memberCount = parseInt(memberCountRes.rows[0]?.c || "0", 10);

    const legacyPlayersRes = await pool.query<{ c: string }>("SELECT COUNT(*) as c FROM players");
    const legacyPlayersCount = parseInt(legacyPlayersRes.rows[0]?.c || "0", 10);

    // If members table is empty or drastically lower than legacy players, run auto-sync
    if (memberCount === 0 || memberCount < legacyPlayersCount / 2) {
      await applyIdentityLinkingProposal(pool);
    }
  } catch (err) {
    console.warn("[member-directory-service] Background sync check warning:", err);
  } finally {
    hasCheckedInitialSync = true;
  }
}

/**
 * Fetch KPI summary counts for the directory header.
 */
export async function getMemberKpis(): Promise<MemberKpis> {
  await ensureMembersSynchronized();

  try {
    const totalRes = await pool.query<{ c: string }>("SELECT COUNT(*) as c FROM members");
    const totalMembers = parseInt(totalRes.rows[0]?.c || "0", 10);

    const missingPhoneRes = await pool.query<{ c: string }>(
      "SELECT COUNT(*) as c FROM members WHERE primary_mobile IS NULL OR primary_mobile = ''",
    );
    const missingPhone = parseInt(missingPhoneRes.rows[0]?.c || "0", 10);

    const rolesRes = await pool.query<{ role: string; c: string }>(
      "SELECT role, COUNT(DISTINCT member_id) as c FROM member_roles GROUP BY role",
    );

    let activePlayers = 0;
    let franchiseOwners = 0;
    let scorersAndOfficials = 0;

    for (const row of rolesRes.rows) {
      const count = parseInt(row.c || "0", 10);
      if (row.role === "player") activePlayers += count;
      else if (row.role === "team_owner") franchiseOwners += count;
      else if (["scorer", "umpire", "referee", "match_official"].includes(row.role)) {
        scorersAndOfficials += count;
      }
    }

    return {
      totalMembers,
      activePlayers,
      franchiseOwners,
      scorersAndOfficials,
      missingPhone,
    };
  } catch (err) {
    console.error("[member-directory-service] getMemberKpis error:", err);
    return {
      totalMembers: 0,
      activePlayers: 0,
      franchiseOwners: 0,
      scorersAndOfficials: 0,
      missingPhone: 0,
    };
  }
}

/**
 * List members with search, filters, pagination, and enriched role/team associations.
 */
export async function listMembers(
  filter: MemberDirectoryFilter = {},
): Promise<{ members: MemberListItem[]; total: number; page: number; limit: number; totalPages: number }> {
  await ensureMembersSynchronized();

  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 25));
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  // Search filter (name, phone, email, id)
  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    params.push(`%${q}%`);
    const pIdx = params.length;
    conditions.push(`(
      LOWER(m.display_name) LIKE $${pIdx} OR
      LOWER(COALESCE(m.first_name, '')) LIKE $${pIdx} OR
      LOWER(COALESCE(m.last_name, '')) LIKE $${pIdx} OR
      LOWER(COALESCE(m.primary_email, '')) LIKE $${pIdx} OR
      COALESCE(m.primary_mobile, '') LIKE $${pIdx} OR
      LOWER(m.id) LIKE $${pIdx}
    )`);
  }

  // Contact status filter
  if (filter.contactStatus === "missing_phone") {
    conditions.push("(m.primary_mobile IS NULL OR m.primary_mobile = '')");
  } else if (filter.contactStatus === "with_phone") {
    conditions.push("(m.primary_mobile IS NOT NULL AND m.primary_mobile != '')");
  } else if (filter.contactStatus === "verified") {
    conditions.push("m.is_mobile_verified = true");
  }

  // Role filter
  if (filter.role && filter.role !== "all") {
    if (filter.role === "multi_role") {
      conditions.push(`(
        SELECT COUNT(DISTINCT mr_sub.role)
        FROM member_roles mr_sub
        WHERE mr_sub.member_id = m.id
      ) > 1`);
    } else {
      params.push(filter.role);
      const rIdx = params.length;
      conditions.push(`EXISTS (
        SELECT 1 FROM member_roles mr_sub
        WHERE mr_sub.member_id = m.id AND mr_sub.role = $${rIdx}
      )`);
    }
  }

  // Sport filter
  if (filter.sport && filter.sport !== "all") {
    params.push(filter.sport.toLowerCase());
    const sIdx = params.length;
    conditions.push(`EXISTS (
      SELECT 1 FROM member_sport_profiles msp_sub
      WHERE msp_sub.member_id = m.id AND LOWER(msp_sub.sport_slug) = $${sIdx}
    )`);
  }

  // Tournament filter
  if (filter.tournamentId && !isNaN(filter.tournamentId)) {
    params.push(filter.tournamentId);
    const tIdx = params.length;
    conditions.push(`EXISTS (
      SELECT 1 FROM tournament_participations tp_sub
      WHERE tp_sub.member_id = m.id AND tp_sub.tournament_id = $${tIdx}
    )`);
  }

  const whereClause = conditions.join(" AND ");

  // Total count query
  const countQuery = `
    SELECT COUNT(*) as c
    FROM members m
    WHERE ${whereClause}
  `;
  const countRes = await pool.query<{ c: string }>(countQuery, params);
  const total = parseInt(countRes.rows[0]?.c || "0", 10);
  const totalPages = Math.ceil(total / limit) || 1;

  if (total === 0) {
    return { members: [], total: 0, page, limit, totalPages: 0 };
  }

  // Paginated member list query
  const listQuery = `
    SELECT
      m.id,
      m.display_name,
      m.first_name,
      m.last_name,
      m.primary_mobile,
      m.is_mobile_verified,
      m.primary_email,
      m.is_email_verified,
      m.city,
      m.avatar_url,
      m.account_status,
      m.created_at
    FROM members m
    WHERE ${whereClause}
    ORDER BY m.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const listParams = [...params, limit, offset];
  const listRes = await pool.query<{
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    primary_mobile: string | null;
    is_mobile_verified: boolean;
    primary_email: string | null;
    is_email_verified: boolean;
    city: string | null;
    avatar_url: string | null;
    account_status: string;
    created_at: Date;
  }>(listQuery, listParams);

  const memberIds = listRes.rows.map((r) => r.id);

  // Batch query roles for these members
  const rolesQuery = `
    SELECT
      mr.member_id,
      mr.role,
      mr.scope,
      mr.tournament_id,
      t.name as tournament_name,
      mr.team_id,
      tm.name as team_name
    FROM member_roles mr
    LEFT JOIN tournaments t ON t.id = mr.tournament_id
    LEFT JOIN teams tm ON tm.id = mr.team_id
    WHERE mr.member_id = ANY($1)
    ORDER BY mr.id ASC
  `;
  const rolesRes = await pool.query<{
    member_id: string;
    role: string;
    scope: string;
    tournament_id: number | null;
    tournament_name: string | null;
    team_id: number | null;
    team_name: string | null;
  }>(rolesQuery, [memberIds]);

  const rolesByMember = new Map<string, MemberListItem["roles"]>();
  const roleTypesByMember = new Map<string, Set<string>>();

  for (const r of rolesRes.rows) {
    const list = rolesByMember.get(r.member_id) || [];
    list.push({
      role: r.role,
      scope: r.scope,
      tournamentId: r.tournament_id,
      tournamentName: r.tournament_name,
      teamId: r.team_id,
      teamName: r.team_name,
    });
    rolesByMember.set(r.member_id, list);

    const typeSet = roleTypesByMember.get(r.member_id) || new Set();
    typeSet.add(r.role);
    roleTypesByMember.set(r.member_id, typeSet);
  }

  // Batch query associated teams across tournaments
  const teamsQuery = `
    SELECT DISTINCT
      tp.member_id,
      tm.id as team_id,
      tm.name as team_name,
      tm.short_code as team_short_code,
      t.id as tournament_id,
      t.name as tournament_name,
      tp.role as role_in_team,
      p.sold_price,
      p.status as player_status,
      p.jersey_number
    FROM tournament_participations tp
    JOIN teams tm ON tm.id = tp.team_id
    JOIN tournaments t ON t.id = tp.tournament_id
    LEFT JOIN member_identity_links mil ON mil.member_id = tp.member_id AND mil.source_table = 'players'
    LEFT JOIN players p ON p.id::text = mil.source_record_id AND p.team_id = tm.id
    WHERE tp.member_id = ANY($1) AND tp.team_id IS NOT NULL
    ORDER BY tm.id DESC
  `;
  const teamsRes = await pool.query<{
    member_id: string;
    team_id: number;
    team_name: string;
    team_short_code: string | null;
    tournament_id: number;
    tournament_name: string;
    role_in_team: string;
    sold_price: number | null;
    player_status: string | null;
    jersey_number: string | null;
  }>(teamsQuery, [memberIds]);

  const teamsByMember = new Map<string, MemberListItem["teams"]>();
  for (const row of teamsRes.rows) {
    const list = teamsByMember.get(row.member_id) || [];
    list.push({
      teamId: row.team_id,
      teamName: row.team_name,
      teamShortCode: row.team_short_code,
      tournamentId: row.tournament_id,
      tournamentName: row.tournament_name,
      roleInTeam: row.role_in_team,
      soldPrice: row.sold_price,
      status: row.player_status,
      jerseyNumber: row.jersey_number,
    });
    teamsByMember.set(row.member_id, list);
  }

  // Batch query sport profiles
  const sportsQuery = `
    SELECT
      member_id,
      sport_slug,
      primary_role,
      secondary_role,
      handedness
    FROM member_sport_profiles
    WHERE member_id = ANY($1)
  `;
  const sportsRes = await pool.query<{
    member_id: string;
    sport_slug: string;
    primary_role: string | null;
    secondary_role: string | null;
    handedness: string | null;
  }>(sportsQuery, [memberIds]);

  const sportsByMember = new Map<string, MemberListItem["sportProfiles"]>();
  for (const s of sportsRes.rows) {
    const list = sportsByMember.get(s.member_id) || [];
    list.push({
      sportSlug: s.sport_slug,
      primaryRole: s.primary_role,
      secondaryRole: s.secondary_role,
      handedness: s.handedness,
    });
    sportsByMember.set(s.member_id, list);
  }

  // Tournament count per member
  const tournamentsCountQuery = `
    SELECT member_id, COUNT(DISTINCT tournament_id) as c
    FROM (
      SELECT member_id, tournament_id FROM tournament_participations WHERE tournament_id IS NOT NULL
      UNION
      SELECT member_id, tournament_id FROM member_roles WHERE tournament_id IS NOT NULL
    ) sub
    WHERE member_id = ANY($1)
    GROUP BY member_id
  `;
  const tCountRes = await pool.query<{ member_id: string; c: string }>(tournamentsCountQuery, [memberIds]);
  const tournamentCountMap = new Map<string, number>();
  for (const r of tCountRes.rows) {
    tournamentCountMap.set(r.member_id, parseInt(r.c || "0", 10));
  }

  // Check WhatsApp consent status via player or organizer link
  const waConsentQuery = `
    SELECT mil.member_id, bool_or(COALESCE(p.whatsapp_consent, false)) as consented
    FROM member_identity_links mil
    JOIN players p ON p.id::text = mil.source_record_id AND mil.source_table = 'players'
    WHERE mil.member_id = ANY($1)
    GROUP BY mil.member_id
  `;
  const waConsentRes = await pool.query<{ member_id: string; consented: boolean }>(waConsentQuery, [memberIds]);
  const waConsentMap = new Map<string, boolean>();
  for (const r of waConsentRes.rows) {
    waConsentMap.set(r.member_id, Boolean(r.consented));
  }

  const members: MemberListItem[] = listRes.rows.map((row) => {
    const roles = rolesByMember.get(row.id) || [];
    const roleTypes = Array.from(roleTypesByMember.get(row.id) || []);
    const teams = teamsByMember.get(row.id) || [];
    const sportProfiles = sportsByMember.get(row.id) || [];
    const tournamentsCount = tournamentCountMap.get(row.id) || 0;
    const whatsappConsent = waConsentMap.get(row.id) || false;

    return {
      id: row.id,
      displayName: row.display_name,
      firstName: row.first_name,
      lastName: row.last_name,
      primaryMobile: row.primary_mobile,
      isMobileVerified: row.is_mobile_verified,
      primaryEmail: row.primary_email,
      isEmailVerified: row.is_email_verified,
      city: row.city,
      avatarUrl: row.avatar_url,
      accountStatus: row.account_status,
      createdAt: row.created_at.toISOString(),
      roles,
      roleTypes: roleTypes.length > 0 ? roleTypes : ["player"],
      teams,
      sportProfiles,
      tournamentsCount,
      teamsCount: teams.length,
      whatsappConsent,
    };
  });

  return {
    members,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Get detailed 360° profile of a single Member by their canonical member ID.
 */
export async function getMemberDetail(memberId: string): Promise<MemberDetail | null> {
  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, memberId))
    .limit(1);

  if (!member) return null;

  // Roles
  const roles = await db
    .select({
      role: memberRolesTable.role,
      scope: memberRolesTable.scope,
      tournamentId: memberRolesTable.tournamentId,
      tournamentName: tournamentsTable.name,
      teamId: memberRolesTable.teamId,
      teamName: teamsTable.name,
    })
    .from(memberRolesTable)
    .leftJoin(tournamentsTable, eq(tournamentsTable.id, memberRolesTable.tournamentId))
    .leftJoin(teamsTable, eq(teamsTable.id, memberRolesTable.teamId))
    .where(eq(memberRolesTable.memberId, memberId));

  const roleTypes = Array.from(new Set(roles.map((r) => r.role)));

  // Teams
  const teamsRes = await pool.query<{
    team_id: number;
    team_name: string;
    team_short_code: string | null;
    tournament_id: number;
    tournament_name: string;
    role_in_team: string;
    sold_price: number | null;
    player_status: string | null;
    jersey_number: string | null;
  }>(
    `SELECT DISTINCT
       tm.id as team_id,
       tm.name as team_name,
       tm.short_code as team_short_code,
       t.id as tournament_id,
       t.name as tournament_name,
       tp.role as role_in_team,
       p.sold_price,
       p.status as player_status,
       p.jersey_number
     FROM tournament_participations tp
     JOIN teams tm ON tm.id = tp.team_id
     JOIN tournaments t ON t.id = tp.tournament_id
     LEFT JOIN member_identity_links mil ON mil.member_id = tp.member_id AND mil.source_table = 'players'
     LEFT JOIN players p ON p.id::text = mil.source_record_id AND p.team_id = tm.id
     WHERE tp.member_id = $1 AND tp.team_id IS NOT NULL
     ORDER BY tm.id DESC`,
    [memberId],
  );

  const teams = teamsRes.rows.map((row) => ({
    teamId: row.team_id,
    teamName: row.team_name,
    teamShortCode: row.team_short_code,
    tournamentId: row.tournament_id,
    tournamentName: row.tournament_name,
    roleInTeam: row.role_in_team,
    soldPrice: row.sold_price,
    status: row.player_status,
    jerseyNumber: row.jersey_number,
  }));

  // Sport Profiles
  const sports = await db
    .select({
      sportSlug: memberSportProfilesTable.sportSlug,
      primaryRole: memberSportProfilesTable.primaryRole,
      secondaryRole: memberSportProfilesTable.secondaryRole,
      handedness: memberSportProfilesTable.handedness,
    })
    .from(memberSportProfilesTable)
    .where(eq(memberSportProfilesTable.memberId, memberId));

  // Linked identities
  const linked = await db
    .select({
      sourceTable: memberIdentityLinksTable.sourceTable,
      sourceRecordId: memberIdentityLinksTable.sourceRecordId,
      linkType: memberIdentityLinksTable.linkType,
      confidenceScore: memberIdentityLinksTable.confidenceScore,
      status: memberIdentityLinksTable.status,
    })
    .from(memberIdentityLinksTable)
    .where(eq(memberIdentityLinksTable.memberId, memberId));

  const tCountRes = await pool.query<{ c: string }>(
    `SELECT COUNT(DISTINCT tournament_id) as c
     FROM (
       SELECT tournament_id FROM tournament_participations WHERE member_id = $1 AND tournament_id IS NOT NULL
       UNION
       SELECT tournament_id FROM member_roles WHERE member_id = $1 AND tournament_id IS NOT NULL
     ) sub`,
    [memberId],
  );
  const tournamentsCount = parseInt(tCountRes.rows[0]?.c || "0", 10);

  return {
    id: member.id,
    displayName: member.displayName,
    firstName: member.firstName,
    lastName: member.lastName,
    primaryMobile: member.primaryMobile,
    isMobileVerified: member.isMobileVerified,
    primaryEmail: member.primaryEmail,
    isEmailVerified: member.isEmailVerified,
    dob: member.dob,
    gender: member.gender,
    country: member.country,
    state: member.state,
    city: member.city,
    avatarUrl: member.avatarUrl,
    accountStatus: member.accountStatus,
    createdAt: member.createdAt.toISOString(),
    roles,
    roleTypes: roleTypes.length > 0 ? roleTypes : ["player"],
    teams,
    sportProfiles: sports,
    tournamentsCount,
    teamsCount: teams.length,
    whatsappConsent: false,
    linkedIdentities: linked,
  };
}

/**
 * Update member contact information and cascade updates to linked records
 * (e.g. playersTable.mobileNumber, globalPlayersTable.mobileNumber, teamsTable.ownerMobile).
 */
export async function updateMemberContact(
  memberId: string,
  data: {
    primaryMobile?: string | null;
    primaryEmail?: string | null;
    displayName?: string;
    city?: string | null;
    accountStatus?: string;
  },
): Promise<{ success: boolean; member: MemberListItem | null; error?: string }> {
  const [existing] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, memberId))
    .limit(1);

  if (!existing) {
    return { success: false, member: null, error: "Member not found" };
  }

  let normalizedMobile: string | null = null;
  if (data.primaryMobile !== undefined) {
    if (data.primaryMobile && data.primaryMobile.trim()) {
      const parsed = parseIndianMobile(data.primaryMobile);
      if (!parsed.ok) {
        return { success: false, member: null, error: parsed.error };
      }
      normalizedMobile = parsed.normalized;
    } else {
      normalizedMobile = null;
    }
  } else {
    normalizedMobile = existing.primaryMobile;
  }

  // Update canonical members table
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (data.primaryMobile !== undefined) {
    updatePayload.primaryMobile = normalizedMobile;
    if (normalizedMobile) updatePayload.isMobileVerified = true;
  }
  if (data.primaryEmail !== undefined) {
    updatePayload.primaryEmail = data.primaryEmail ? data.primaryEmail.trim().toLowerCase() : null;
  }
  if (data.displayName !== undefined && data.displayName.trim()) {
    updatePayload.displayName = data.displayName.trim();
  }
  if (data.city !== undefined) {
    updatePayload.city = data.city ? data.city.trim() : null;
  }
  if (data.accountStatus !== undefined) {
    updatePayload.accountStatus = data.accountStatus;
  }

  await db.update(membersTable).set(updatePayload).where(eq(membersTable.id, memberId));

  // If mobile number changed or was added, cascade to linked legacy records
  if (normalizedMobile && normalizedMobile !== existing.primaryMobile) {
    const linkedRecords = await db
      .select({
        sourceTable: memberIdentityLinksTable.sourceTable,
        sourceRecordId: memberIdentityLinksTable.sourceRecordId,
      })
      .from(memberIdentityLinksTable)
      .where(eq(memberIdentityLinksTable.memberId, memberId));

    for (const link of linkedRecords) {
      if (link.sourceTable === "players") {
        const playerId = parseInt(link.sourceRecordId, 10);
        if (!isNaN(playerId)) {
          await db
            .update(playersTable)
            .set({ mobileNumber: normalizedMobile })
            .where(eq(playersTable.id, playerId));
        }
      } else if (link.sourceTable === "global_players") {
        await db
          .update(globalPlayersTable)
          .set({ mobileNumber: normalizedMobile })
          .where(eq(globalPlayersTable.id, link.sourceRecordId));
      } else if (link.sourceTable === "teams") {
        const teamId = parseInt(link.sourceRecordId, 10);
        if (!isNaN(teamId)) {
          await db
            .update(teamsTable)
            .set({ ownerMobile: normalizedMobile })
            .where(eq(teamsTable.id, teamId));
        }
      } else if (link.sourceTable === "organizers") {
        const orgId = parseInt(link.sourceRecordId, 10);
        if (!isNaN(orgId)) {
          await db
            .update(organizersTable)
            .set({ mobile: normalizedMobile, phoneVerified: true })
            .where(eq(organizersTable.id, orgId));
        }
      } else if (link.sourceTable === "scorer_accounts") {
        const scId = parseInt(link.sourceRecordId, 10);
        if (!isNaN(scId)) {
          await db
            .update(scorerAccountsTable)
            .set({ mobile: normalizedMobile })
            .where(eq(scorerAccountsTable.id, scId));
        }
      }
    }
  }

  const updatedDetail = await getMemberDetail(memberId);
  return { success: true, member: updatedDetail };
}
