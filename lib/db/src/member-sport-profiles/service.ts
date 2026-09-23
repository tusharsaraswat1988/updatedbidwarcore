import { eq, and, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { membersTable, type Member } from "../schema/members";
import {
  memberSportProfilesTable,
  type MemberSportProfile,
} from "../schema/member-sport-profiles";
import {
  isSportSupported,
  validateSportRole,
  normalizeHandedness,
  normalizeFederationCode,
} from "./validation";
import type {
  CreateSportProfileInput,
  UpdateSportProfileInput,
  ListSportProfilesFilter,
  MemberSportContext,
} from "./types";

export class MemberSportProfileError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "MemberSportProfileError";
  }
}

/**
 * Creates a canonical sport profile for a Member in a supported sport.
 */
export async function createMemberSportProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  input: CreateSportProfileInput,
): Promise<MemberSportProfile> {
  const sportSlug = input.sportSlug.trim().toLowerCase();
  if (!isSportSupported(sportSlug)) {
    throw new MemberSportProfileError(
      `Unsupported sport: ${input.sportSlug}. Only 'cricket' and 'badminton' are currently supported.`,
      "UNSUPPORTED_SPORT",
      400,
    );
  }

  // 1. Verify Member exists and is not suspended
  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, input.memberId))
    .limit(1);

  if (!member) {
    throw new MemberSportProfileError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  if (member.accountStatus === "suspended" || member.accountStatus === "deactivated") {
    throw new MemberSportProfileError(
      "Member account is inactive or suspended",
      "MEMBER_INACTIVE",
      403,
    );
  }

  // 2. Validate roles if provided
  if (input.primaryRole) {
    const role = input.primaryRole.trim().toLowerCase();
    if (!validateSportRole(sportSlug, role)) {
      throw new MemberSportProfileError(
        `Invalid primary role '${input.primaryRole}' for sport '${sportSlug}'`,
        "INVALID_SPORT_ROLE",
        400,
      );
    }
  }

  if (input.secondaryRole) {
    const role = input.secondaryRole.trim().toLowerCase();
    if (!validateSportRole(sportSlug, role)) {
      throw new MemberSportProfileError(
        `Invalid secondary role '${input.secondaryRole}' for sport '${sportSlug}'`,
        "INVALID_SPORT_ROLE",
        400,
      );
    }
  }

  // 3. Check for existing profile in this sport
  const [existing] = await database
    .select()
    .from(memberSportProfilesTable)
    .where(
      and(
        eq(memberSportProfilesTable.memberId, input.memberId),
        eq(memberSportProfilesTable.sportSlug, sportSlug),
      ),
    )
    .limit(1);

  if (existing) {
    throw new MemberSportProfileError(
      `Member already has a '${sportSlug}' profile`,
      "DUPLICATE_SPORT_PROFILE",
      409,
    );
  }

  // 4. Insert profile
  const [created] = await database
    .insert(memberSportProfilesTable)
    .values({
      memberId: input.memberId,
      sportSlug,
      primaryRole: input.primaryRole?.trim().toLowerCase() || null,
      secondaryRole: input.secondaryRole?.trim().toLowerCase() || null,
      handedness: normalizeHandedness(input.handedness),
      federationCode: input.federationCode
        ? normalizeFederationCode(input.federationCode) || input.federationCode.trim()
        : null,
      profileJson: input.profileJson ?? null,
    })
    .returning();

  return created!;
}

/**
 * Retrieves a single sport profile by primary key.
 */
export async function getMemberSportProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  id: number,
): Promise<MemberSportProfile | null> {
  const [row] = await database
    .select()
    .from(memberSportProfilesTable)
    .where(eq(memberSportProfilesTable.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Retrieves a sport profile for a specific member and sport.
 */
export async function getMemberSportProfileBySport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  memberId: string,
  sportSlug: string,
): Promise<MemberSportProfile | null> {
  const [row] = await database
    .select()
    .from(memberSportProfilesTable)
    .where(
      and(
        eq(memberSportProfilesTable.memberId, memberId),
        eq(memberSportProfilesTable.sportSlug, sportSlug.trim().toLowerCase()),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Lists sport profiles with optional filtering.
 */
export async function listMemberSportProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  filter: ListSportProfilesFilter = {},
): Promise<MemberSportProfile[]> {
  const conditions = [];

  if (filter.memberId != null) {
    conditions.push(eq(memberSportProfilesTable.memberId, filter.memberId));
  }
  if (filter.sportSlug != null) {
    conditions.push(
      eq(memberSportProfilesTable.sportSlug, filter.sportSlug.trim().toLowerCase()),
    );
  }
  if (filter.primaryRole != null) {
    conditions.push(
      eq(memberSportProfilesTable.primaryRole, filter.primaryRole.trim().toLowerCase()),
    );
  }

  let query = database
    .select()
    .from(memberSportProfilesTable)
    .orderBy(desc(memberSportProfilesTable.createdAt));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  if (filter.limit != null) {
    query = query.limit(filter.limit) as any;
  }
  if (filter.offset != null) {
    query = query.offset(filter.offset) as any;
  }

  return await query;
}

/**
 * Updates an existing sport profile.
 */
export async function updateMemberSportProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  id: number,
  patch: UpdateSportProfileInput,
): Promise<MemberSportProfile> {
  const existing = await getMemberSportProfile(database, id);
  if (!existing) {
    throw new MemberSportProfileError("Sport profile not found", "NOT_FOUND", 404);
  }

  const updateValues: Partial<typeof memberSportProfilesTable.$inferInsert> = {};

  if (patch.primaryRole !== undefined) {
    if (patch.primaryRole !== null) {
      const role = patch.primaryRole.trim().toLowerCase();
      if (!validateSportRole(existing.sportSlug, role)) {
        throw new MemberSportProfileError(
          `Invalid primary role '${patch.primaryRole}' for sport '${existing.sportSlug}'`,
          "INVALID_SPORT_ROLE",
          400,
        );
      }
      updateValues.primaryRole = role;
    } else {
      updateValues.primaryRole = null;
    }
  }

  if (patch.secondaryRole !== undefined) {
    if (patch.secondaryRole !== null) {
      const role = patch.secondaryRole.trim().toLowerCase();
      if (!validateSportRole(existing.sportSlug, role)) {
        throw new MemberSportProfileError(
          `Invalid secondary role '${patch.secondaryRole}' for sport '${existing.sportSlug}'`,
          "INVALID_SPORT_ROLE",
          400,
        );
      }
      updateValues.secondaryRole = role;
    } else {
      updateValues.secondaryRole = null;
    }
  }

  if (patch.handedness !== undefined) {
    updateValues.handedness = normalizeHandedness(patch.handedness);
  }

  if (patch.federationCode !== undefined) {
    updateValues.federationCode = patch.federationCode
      ? normalizeFederationCode(patch.federationCode) || patch.federationCode.trim()
      : null;
  }

  if (patch.profileJson !== undefined) {
    updateValues.profileJson = patch.profileJson;
  }

  const [updated] = await database
    .update(memberSportProfilesTable)
    .set(updateValues)
    .where(eq(memberSportProfilesTable.id, id))
    .returning();

  return updated!;
}

/**
 * Removes a sport profile.
 */
export async function removeMemberSportProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  id: number,
): Promise<void> {
  const existing = await getMemberSportProfile(database, id);
  if (!existing) {
    throw new MemberSportProfileError("Sport profile not found", "NOT_FOUND", 404);
  }

  await database
    .delete(memberSportProfilesTable)
    .where(eq(memberSportProfilesTable.id, id));
}

/**
 * Resolves all sport profiles for a member and returns a helper-equipped context.
 */
export async function resolveMemberSportContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  memberId: string,
): Promise<MemberSportContext> {
  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, memberId))
    .limit(1);

  if (!member) {
    throw new MemberSportProfileError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  const profiles = await database
    .select()
    .from(memberSportProfilesTable)
    .where(eq(memberSportProfilesTable.memberId, memberId));

  const sports = profiles.map((p) => p.sportSlug);

  return {
    member,
    profiles,
    sports,
    getProfileForSport: (sportSlug: string) => {
      const normalized = sportSlug.trim().toLowerCase();
      return profiles.find((p) => p.sportSlug === normalized) ?? null;
    },
  };
}
