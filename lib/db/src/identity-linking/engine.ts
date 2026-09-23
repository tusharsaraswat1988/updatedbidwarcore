import { randomUUID } from "node:crypto";
import type pg from "pg";
import {
  membersTable,
  memberRolesTable,
  memberSportProfilesTable,
  tournamentParticipationsTable,
  memberIdentityLinksTable,
  organizersTable,
  scorerAccountsTable,
  globalPlayersTable,
  playersTable,
  badmintonPlayersTable,
  scoringOfficialsTable,
  teamsTable,
  generateMemberId,
} from "../schema";
import {
  classifyGlobalPlayer,
  classifyOrganizer,
  classifyScorerAccount,
  classifyScoringOfficial,
  classifyTeamOwner,
} from "./classifier";
import { calculateNameSimilarity, normalizeEmail, normalizeMobile, normalizeName } from "./normalizer";
import type {
  ApplyResult,
  CollisionReportItem,
  DryRunReport,
  IdentityCandidate,
  IdentityLinkingStats,
  ProposedIdentityLink,
  ProposedMember,
  ProposedRole,
  ProposedSportProfile,
  ProposedTournamentParticipation,
} from "./types";

export interface EngineContext {
  migrationRunId: string;
}

/**
 * Executes a read-only dry-run analysis of historical identity records.
 * WRITES NOTHING TO THE DATABASE.
 */
export async function runIdentityLinkingDryRun(
  pool: pg.Pool | pg.PoolClient,
  options?: { migrationRunId?: string },
): Promise<DryRunReport> {
  const migrationRunId = options?.migrationRunId || `run_5d_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const nowIso = new Date().toISOString();

  // 1. Read existing canonical tables to ensure idempotency
  const existingLinksRes = await pool.query<{
    source_table: string;
    source_record_id: string;
    member_id: string;
    status: string;
  }>(`SELECT source_table, source_record_id, member_id, status FROM member_identity_links`);

  const existingLinkMap = new Map<string, string>(); // "sourceTable:sourceRecordId" -> memberId
  for (const row of existingLinksRes.rows) {
    if (row.status === "active") {
      existingLinkMap.set(`${row.source_table}:${row.source_record_id}`, row.member_id);
    }
  }

  // 2. Read legacy identity sources
  const organizersRes = await pool.query<{
    id: number;
    name: string;
    mobile: string;
    email: string | null;
    phone_verified: boolean | null;
    password_hash: string | null;
    google_id: string | null;
  }>(`SELECT id, name, mobile, email, phone_verified, password_hash, google_id FROM organizers ORDER BY id ASC`);

  const scorersRes = await pool.query<{
    id: number;
    name: string;
    mobile: string;
    pin_hash: string;
    is_active: boolean;
  }>(`SELECT id, name, mobile, pin_hash, is_active FROM scorer_accounts ORDER BY id ASC`);

  const globalPlayersRes = await pool.query<{
    id: string;
    canonical_name: string;
    first_name: string | null;
    last_name: string | null;
    mobile_number: string | null;
    email: string | null;
    dob: string | null;
    gender: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    sport: string | null;
    handedness: string | null;
    photo_url: string | null;
    photo_public_id: string | null;
  }>(`SELECT id, canonical_name, first_name, last_name, mobile_number, email, dob, gender, country, state, city, sport, handedness, photo_url, photo_public_id FROM global_players ORDER BY id ASC`);

  const playersRes = await pool.query<{
    id: number;
    tournament_id: number;
    name: string;
    mobile_number: string;
    email: string | null;
    global_player_id: string | null;
    role: string | null;
    team_id: number | null;
    jersey_number: string | null;
  }>(`SELECT id, tournament_id, name, mobile_number, email, global_player_id, role, team_id, jersey_number FROM players ORDER BY id ASC`);

  const badmintonPlayersRes = await pool.query<{
    id: number;
    tournament_id: number;
    first_name: string;
    last_name: string;
    display_name: string | null;
    mobile: string | null;
    email: string | null;
    master_player_id: string | null;
    bwf_code: string | null;
    short_name: string | null;
    gender: string | null;
  }>(`SELECT id, tournament_id, first_name, last_name, display_name, mobile, email, master_player_id, bwf_code, short_name, gender FROM badminton_players ORDER BY id ASC`);

  const scoringOfficialsRes = await pool.query<{
    id: number;
    tournament_id: number;
    name: string;
    mobile: string | null;
    role: string;
  }>(`SELECT id, tournament_id, name, mobile, role FROM scoring_officials ORDER BY id ASC`);

  const teamsRes = await pool.query<{
    id: number;
    tournament_id: number;
    name: string;
    owner_name: string;
    owner_mobile: string;
    owner_email: string | null;
  }>(`SELECT id, tournament_id, name, owner_name, owner_mobile, owner_email FROM teams ORDER BY id ASC`);

  // Build lookup of global player IDs referenced in active tournament players
  const referencedMasterPlayerIds = new Set<string>();
  for (const p of playersRes.rows) {
    if (p.global_player_id) referencedMasterPlayerIds.add(p.global_player_id);
  }
  for (const bp of badmintonPlayersRes.rows) {
    if (bp.master_player_id) referencedMasterPlayerIds.add(bp.master_player_id);
  }

  // 3. Classify all records
  const candidates: IdentityCandidate[] = [];
  const collisions: CollisionReportItem[] = [];

  // Track contacts to detect cross-source collisions
  const contactOwners = new Map<string, Array<{ sourceTable: string; sourceRecordId: string; name: string }>>();

  const registerContact = (mobile: string, sourceTable: string, sourceRecordId: string, name: string) => {
    const norm = normalizeMobile(mobile);
    if (norm.length < 10) return;
    const list = contactOwners.get(norm) || [];
    list.push({ sourceTable, sourceRecordId, name });
    contactOwners.set(norm, list);
  };

  // Organizers
  for (const org of organizersRes.rows) {
    registerContact(org.mobile, "organizers", String(org.id), org.name);
    candidates.push(
      classifyOrganizer({
        id: org.id,
        name: org.name,
        mobile: org.mobile,
        email: org.email,
        phoneVerified: org.phone_verified,
        passwordHash: org.password_hash,
        googleId: org.google_id,
      }),
    );
  }

  // Scorers
  for (const sa of scorersRes.rows) {
    registerContact(sa.mobile, "scorer_accounts", String(sa.id), sa.name);
    candidates.push(
      classifyScorerAccount({
        id: sa.id,
        name: sa.name,
        mobile: sa.mobile,
        pinHash: sa.pin_hash,
        isActive: sa.is_active,
      }),
    );
  }

  // Global players
  for (const gp of globalPlayersRes.rows) {
    if (gp.mobile_number) registerContact(gp.mobile_number, "global_players", gp.id, gp.canonical_name);
    candidates.push(
      classifyGlobalPlayer({
        id: gp.id,
        canonicalName: gp.canonical_name,
        mobileNumber: gp.mobile_number,
        email: gp.email,
        hasLinkedTournamentRows: referencedMasterPlayerIds.has(gp.id),
      }),
    );
  }

  // Officials (Review only)
  for (const off of scoringOfficialsRes.rows) {
    candidates.push(
      classifyScoringOfficial({
        id: off.id,
        tournamentId: off.tournament_id,
        name: off.name,
        mobile: off.mobile,
        role: off.role,
      }),
    );
  }

  // Team Owners (Review only)
  for (const tm of teamsRes.rows) {
    candidates.push(
      classifyTeamOwner({
        id: tm.id,
        tournamentId: tm.tournament_id,
        ownerName: tm.owner_name,
        ownerMobile: tm.owner_mobile,
        ownerEmail: tm.owner_email,
      }),
    );
  }

  // 4. Collision Detection: Check if same contact number is used with conflicting names
  const collidingContacts = new Set<string>();
  for (const [mobile, owners] of contactOwners.entries()) {
    if (owners.length > 1) {
      // Check if names differ significantly
      const baseName = owners[0]!.name;
      const conflicting = owners.some((o) => calculateNameSimilarity(baseName, o.name) < 0.6);
      if (conflicting) {
        collidingContacts.add(mobile);
        collisions.push({
          key: mobile,
          conflictType: "name_mismatch_same_contact",
          records: owners,
          resolution: "downgraded_to_category_c",
        });
      }
    }
  }

  // Downgrade any Category A candidate that has a conflicting contact collision
  for (const c of candidates) {
    if (c.normalizedMobile && collidingContacts.has(c.normalizedMobile)) {
      if (c.category === "CATEGORY_A") {
        c.category = "CATEGORY_C";
        c.reasons.push("Contact collision with conflicting human names across legacy records");
      }
    }
  }

  // 5. Build Proposed Canonical Entities (CATEGORY A ONLY)
  const proposedMembers: ProposedMember[] = [];
  const proposedRoles: ProposedRole[] = [];
  const proposedSportProfiles: ProposedSportProfile[] = [];
  const proposedParticipations: ProposedTournamentParticipation[] = [];
  const proposedLinks: ProposedIdentityLink[] = [];

  // Map to deduplicate canonical member creation for the same proven human (e.g. verified mobile + same name)
  const mobileToMemberIdMap = new Map<string, string>();
  const sourceToMemberIdMap = new Map<string, string>();

  // Check existing links first
  for (const [sourceKey, existingMemberId] of existingLinkMap.entries()) {
    sourceToMemberIdMap.set(sourceKey, existingMemberId);
  }

  const categoryACandidates = candidates.filter((c) => c.category === "CATEGORY_A");

  for (const cand of categoryACandidates) {
    const sourceKey = `${cand.sourceTable}:${cand.sourceRecordId}`;
    const existingOrMappedMemberId =
      sourceToMemberIdMap.get(sourceKey) ||
      (cand.normalizedMobile ? mobileToMemberIdMap.get(cand.normalizedMobile) : undefined);

    const isNewMember = !existingOrMappedMemberId;
    const resolvedMemberId: string = existingOrMappedMemberId || generateMemberId();

    if (isNewMember) {
      sourceToMemberIdMap.set(sourceKey, resolvedMemberId);
      if (cand.normalizedMobile) {
        mobileToMemberIdMap.set(cand.normalizedMobile, resolvedMemberId);
      }
    }

    cand.proposedMemberId = resolvedMemberId;

    // A. Organizer source
    if (cand.sourceTable === "organizers") {
      const org = organizersRes.rows.find((o) => String(o.id) === cand.sourceRecordId)!;
      if (isNewMember) {
        proposedMembers.push({
          id: resolvedMemberId,
          displayName: org.name,
          primaryMobile: org.mobile,
          primaryEmail: org.email,
          isMobileVerified: Boolean(org.phone_verified),
          isEmailVerified: Boolean(org.google_id),
          accountStatus: "active",
          metadataJson: { migrationRunId, source: "organizers" },
        });
      }

      proposedRoles.push({
        memberId: resolvedMemberId,
        role: "organizer",
        scope: "global",
      });

      proposedLinks.push({
        memberId: resolvedMemberId,
        sourceTable: "organizers",
        sourceRecordId: cand.sourceRecordId,
        linkType: org.phone_verified ? "verified_phone" : "direct_fk",
        confidenceScore: 100,
        provenanceJson: {
          evidence: cand.reasons,
          source: "phase_5d_high_confidence",
          migrationRunId,
          analyzedAt: nowIso,
        },
        status: "active",
      });
    }

    // B. Scorer source
    else if (cand.sourceTable === "scorer_accounts") {
      const sa = scorersRes.rows.find((s) => String(s.id) === cand.sourceRecordId)!;
      if (isNewMember) {
        proposedMembers.push({
          id: resolvedMemberId,
          displayName: sa.name,
          primaryMobile: sa.mobile,
          isMobileVerified: true,
          isEmailVerified: false,
          accountStatus: "active",
          metadataJson: { migrationRunId, source: "scorer_accounts" },
        });
      }

      proposedRoles.push({
        memberId: resolvedMemberId,
        role: "scorer",
        scope: "global",
      });

      proposedLinks.push({
        memberId: resolvedMemberId,
        sourceTable: "scorer_accounts",
        sourceRecordId: cand.sourceRecordId,
        linkType: "verified_phone",
        confidenceScore: 100,
        provenanceJson: {
          evidence: cand.reasons,
          source: "phase_5d_high_confidence",
          migrationRunId,
          analyzedAt: nowIso,
        },
        status: "active",
      });
    }

    // C. Global player source
    else if (cand.sourceTable === "global_players") {
      const gp = globalPlayersRes.rows.find((g) => g.id === cand.sourceRecordId)!;
      if (isNewMember) {
        proposedMembers.push({
          id: resolvedMemberId,
          displayName: gp.canonical_name,
          firstName: gp.first_name,
          lastName: gp.last_name,
          primaryMobile: gp.mobile_number,
          primaryEmail: gp.email,
          isMobileVerified: false,
          isEmailVerified: false,
          dob: gp.dob,
          gender: gp.gender,
          country: gp.country,
          state: gp.state,
          city: gp.city,
          avatarUrl: gp.photo_url,
          avatarPublicId: gp.photo_public_id,
          accountStatus: "active",
          metadataJson: { migrationRunId, source: "global_players" },
        });
      }

      proposedRoles.push({
        memberId: resolvedMemberId,
        role: "player",
        scope: "global",
      });

      // Sport profile
      if (gp.sport) {
        proposedSportProfiles.push({
          memberId: resolvedMemberId,
          sportSlug: gp.sport.toLowerCase(),
          handedness: gp.handedness,
        });
      }

      proposedLinks.push({
        memberId: resolvedMemberId,
        sourceTable: "global_players",
        sourceRecordId: cand.sourceRecordId,
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: {
          evidence: cand.reasons,
          source: "phase_5d_high_confidence",
          migrationRunId,
          analyzedAt: nowIso,
        },
        status: "active",
      });

      // Linked tournament cricket players
      const linkedCricket = playersRes.rows.filter((p) => p.global_player_id === gp.id);
      for (const cp of linkedCricket) {
        proposedParticipations.push({
          tournamentId: cp.tournament_id,
          memberId: resolvedMemberId,
          role: "player",
          status: "active",
          teamId: cp.team_id,
          jerseyNumber: cp.jersey_number,
        });
        proposedLinks.push({
          memberId: resolvedMemberId,
          sourceTable: "players",
          sourceRecordId: String(cp.id),
          linkType: "direct_fk",
          confidenceScore: 100,
          provenanceJson: {
            evidence: ["Explicit FK players.global_player_id -> global_players.id"],
            source: "phase_5d_high_confidence",
            migrationRunId,
            analyzedAt: nowIso,
          },
          status: "active",
        });
      }

      // Linked tournament badminton players
      const linkedBadminton = badmintonPlayersRes.rows.filter((bp) => bp.master_player_id === gp.id);
      for (const bp of linkedBadminton) {
        proposedParticipations.push({
          tournamentId: bp.tournament_id,
          memberId: resolvedMemberId,
          role: "player",
          status: "active",
          initials: bp.short_name,
        });
        proposedLinks.push({
          memberId: resolvedMemberId,
          sourceTable: "badminton_players",
          sourceRecordId: String(bp.id),
          linkType: "direct_fk",
          confidenceScore: 100,
          provenanceJson: {
            evidence: ["Explicit FK badminton_players.master_player_id -> global_players.id"],
            source: "phase_5d_high_confidence",
            migrationRunId,
            analyzedAt: nowIso,
          },
          status: "active",
        });
      }
    }
  }

  // 6. Compile Statistics
  const sourceStats: IdentityLinkingStats["sources"] = {
    organizers: { total: organizersRes.rows.length, categoryA: 0, categoryB: 0, categoryC: 0 },
    scorer_accounts: { total: scorersRes.rows.length, categoryA: 0, categoryB: 0, categoryC: 0 },
    global_players: { total: globalPlayersRes.rows.length, categoryA: 0, categoryB: 0, categoryC: 0 },
    scoring_officials: { total: scoringOfficialsRes.rows.length, categoryA: 0, categoryB: 0, categoryC: 0 },
    teams_owner: { total: teamsRes.rows.length, categoryA: 0, categoryB: 0, categoryC: 0 },
  };

  for (const c of candidates) {
    const s = sourceStats[c.sourceTable];
    if (s) {
      if (c.category === "CATEGORY_A") s.categoryA++;
      else if (c.category === "CATEGORY_B") s.categoryB++;
      else s.categoryC++;
    }
  }

  const stats: IdentityLinkingStats = {
    totalSourceRecords: candidates.length,
    sources: sourceStats,
    categoryACount: candidates.filter((c) => c.category === "CATEGORY_A").length,
    categoryBCount: candidates.filter((c) => c.category === "CATEGORY_B").length,
    categoryCCount: candidates.filter((c) => c.category === "CATEGORY_C").length,
    collisionsDetected: collisions.length,
    proposedNewMembers: proposedMembers.length,
    reusedExistingMembers: Array.from(new Set(proposedLinks.map((l) => l.memberId))).length - proposedMembers.length,
    proposedRoles: proposedRoles.length,
    proposedSportProfiles: proposedSportProfiles.length,
    proposedParticipations: proposedParticipations.length,
    proposedLinks: proposedLinks.length,
  };

  return {
    mode: "dry_run",
    migrationRunId,
    executedAt: nowIso,
    stats,
    proposedMembers,
    proposedRoles,
    proposedSportProfiles,
    proposedParticipations,
    proposedLinks,
    reviewCandidates: candidates.filter((c) => c.category === "CATEGORY_B"),
    unresolvedCandidates: candidates.filter((c) => c.category === "CATEGORY_C"),
    collisions,
  };
}

/**
 * Applies proposed Category A identity linkages to the database.
 * WRITES ONLY TO NEW CANONICAL TABLES (members, member_roles, etc.).
 * NEVER MUTATES OR DELETES LEGACY TABLES.
 */
export async function applyIdentityLinkingProposal(
  pool: pg.Pool,
  options?: { migrationRunId?: string },
): Promise<ApplyResult> {
  const dryRun = await runIdentityLinkingDryRun(pool, options);

  const client = await pool.connect();
  try {
    // 1. Capture legacy table counts BEFORE
    const countQuery = async () => {
      const orgs = (await client.query("SELECT COUNT(*) as c FROM organizers")).rows[0].c;
      const gp = (await client.query("SELECT COUNT(*) as c FROM global_players")).rows[0].c;
      const p = (await client.query("SELECT COUNT(*) as c FROM players")).rows[0].c;
      const bp = (await client.query("SELECT COUNT(*) as c FROM badminton_players")).rows[0].c;
      const sa = (await client.query("SELECT COUNT(*) as c FROM scorer_accounts")).rows[0].c;
      const tm = (await client.query("SELECT COUNT(*) as c FROM teams")).rows[0].c;
      const trn = (await client.query("SELECT COUNT(*) as c FROM tournaments")).rows[0].c;
      return {
        organizers: Number(orgs),
        global_players: Number(gp),
        players: Number(p),
        badminton_players: Number(bp),
        scorer_accounts: Number(sa),
        teams: Number(tm),
        tournaments: Number(trn),
      };
    };

    const beforeCounts = await countQuery();

    // 2. Perform transactional insert into new canonical tables
    await client.query("BEGIN");

    let membersCreated = 0;
    let rolesCreated = 0;
    let sportProfilesCreated = 0;
    let participationsCreated = 0;
    let linksCreated = 0;

    // A. Insert members
    for (const m of dryRun.proposedMembers) {
      await client.query(
        `INSERT INTO members (id, display_name, first_name, last_name, primary_mobile, primary_email, is_mobile_verified, is_email_verified, dob, gender, country, state, city, avatar_url, avatar_public_id, account_status, metadata_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO NOTHING`,
        [
          m.id,
          m.displayName,
          m.firstName,
          m.lastName,
          m.primaryMobile,
          m.primaryEmail,
          m.isMobileVerified,
          m.isEmailVerified,
          m.dob,
          m.gender,
          m.country,
          m.state,
          m.city,
          m.avatarUrl,
          m.avatarPublicId,
          m.accountStatus,
          JSON.stringify(m.metadataJson || {}),
        ],
      );
      membersCreated++;
    }

    // B. Insert roles
    for (const r of dryRun.proposedRoles) {
      await client.query(
        `INSERT INTO member_roles (member_id, role, scope, tournament_id, team_id, match_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.memberId, r.role, r.scope, r.tournamentId, r.teamId, r.matchId],
      );
      rolesCreated++;
    }

    // C. Insert sport profiles
    for (const sp of dryRun.proposedSportProfiles) {
      await client.query(
        `INSERT INTO member_sport_profiles (member_id, sport_slug, primary_role, secondary_role, handedness, federation_code, profile_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (member_id, sport_slug) DO NOTHING`,
        [
          sp.memberId,
          sp.sportSlug,
          sp.primaryRole,
          sp.secondaryRole,
          sp.handedness,
          sp.federationCode,
          JSON.stringify(sp.profileJson || {}),
        ],
      );
      sportProfilesCreated++;
    }

    // D. Insert tournament participations
    for (const tp of dryRun.proposedParticipations) {
      await client.query(
        `INSERT INTO tournament_participations (tournament_id, member_id, role, status, team_id, category_id, display_name_override, initials, jersey_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (tournament_id, member_id, role) DO NOTHING`,
        [
          tp.tournamentId,
          tp.memberId,
          tp.role,
          tp.status,
          tp.teamId,
          tp.categoryId,
          tp.displayNameOverride,
          tp.initials,
          tp.jerseyNumber,
        ],
      );
      participationsCreated++;
    }

    // E. Insert identity links
    for (const l of dryRun.proposedLinks) {
      await client.query(
        `INSERT INTO member_identity_links (member_id, source_table, source_record_id, link_type, confidence_score, provenance_json, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (source_table, source_record_id, member_id) DO NOTHING`,
        [
          l.memberId,
          l.sourceTable,
          l.sourceRecordId,
          l.linkType,
          l.confidenceScore,
          JSON.stringify(l.provenanceJson),
          l.status,
        ],
      );
      linksCreated++;
    }

    await client.query("COMMIT");

    // 3. Verify legacy counts AFTER
    const afterCounts = await countQuery();
    const isIntegrityIntact =
      beforeCounts.organizers === afterCounts.organizers &&
      beforeCounts.global_players === afterCounts.global_players &&
      beforeCounts.players === afterCounts.players &&
      beforeCounts.badminton_players === afterCounts.badminton_players &&
      beforeCounts.scorer_accounts === afterCounts.scorer_accounts &&
      beforeCounts.teams === afterCounts.teams &&
      beforeCounts.tournaments === afterCounts.tournaments;

    if (!isIntegrityIntact) {
      throw new Error(
        `FATAL: Legacy table integrity breach detected during apply! Before: ${JSON.stringify(
          beforeCounts,
        )}, After: ${JSON.stringify(afterCounts)}`,
      );
    }

    return {
      mode: "apply",
      migrationRunId: dryRun.migrationRunId,
      executedAt: new Date().toISOString(),
      appliedStats: {
        membersCreated,
        rolesCreated,
        sportProfilesCreated,
        participationsCreated,
        linksCreated,
      },
      legacyTableIntegrityVerified: isIntegrityIntact,
      legacyRowCounts: afterCounts,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reversibly rolls back all records created by a specific Phase 5D run.
 * NEVER TOUCHES LEGACY TABLES.
 */
export async function rollbackIdentityLinkingRun(
  pool: pg.Pool,
  migrationRunId: string,
): Promise<{ deletedMembers: number; deletedLinks: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find links tagged with this migration run
    const linksRes = await client.query<{ member_id: string }>(
      `DELETE FROM member_identity_links
       WHERE provenance_json->>'migrationRunId' = $1
       RETURNING member_id`,
      [migrationRunId],
    );

    const deletedLinks = linksRes.rowCount || 0;

    // Delete members created in this migration run (cascades to roles, sport profiles, participations)
    const membersRes = await client.query(
      `DELETE FROM members
       WHERE metadata_json->>'migrationRunId' = $1`,
      [migrationRunId],
    );

    const deletedMembers = membersRes.rowCount || 0;

    await client.query("COMMIT");
    return { deletedMembers, deletedLinks };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
