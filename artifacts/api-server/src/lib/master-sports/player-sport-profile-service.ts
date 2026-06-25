import { and, asc, eq, inArray } from "drizzle-orm";
import { db, playerSportProfilesTable } from "@workspace/db";

export type SportProfileInput = {
  sportSlug: string;
  defaultRole?: string | null;
  profileJson?: Record<string, unknown> | null;
};

export type SportProfileDto = {
  sport: string;
  defaultRole: string | null;
  profileJson: Record<string, unknown> | null;
};

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export class PlayerSportProfileService {
  async getSportProfiles(globalPlayerId: string): Promise<SportProfileDto[]> {
    const rows = await db
      .select()
      .from(playerSportProfilesTable)
      .where(eq(playerSportProfilesTable.globalPlayerId, globalPlayerId))
      .orderBy(asc(playerSportProfilesTable.sportSlug));

    return rows.map((row) => ({
      sport: row.sportSlug,
      defaultRole: row.defaultRole,
      profileJson: row.profileJson ?? null,
    }));
  }

  async getSportProfilesForPlayers(
    globalPlayerIds: string[],
  ): Promise<Map<string, SportProfileDto[]>> {
    const result = new Map<string, SportProfileDto[]>();
    if (globalPlayerIds.length === 0) return result;

    const rows = await db
      .select()
      .from(playerSportProfilesTable)
      .where(inArray(playerSportProfilesTable.globalPlayerId, globalPlayerIds))
      .orderBy(asc(playerSportProfilesTable.globalPlayerId), asc(playerSportProfilesTable.sportSlug));

    for (const row of rows) {
      const list = result.get(row.globalPlayerId) ?? [];
      list.push({
        sport: row.sportSlug,
        defaultRole: row.defaultRole,
        profileJson: row.profileJson ?? null,
      });
      result.set(row.globalPlayerId, list);
    }
    return result;
  }

  async upsertSportProfile(
    globalPlayerId: string,
    input: SportProfileInput,
  ): Promise<void> {
    const sportSlug = normalizeSlug(input.sportSlug);
    if (!sportSlug) return;

    await db
      .insert(playerSportProfilesTable)
      .values({
        globalPlayerId,
        sportSlug,
        defaultRole: input.defaultRole ?? null,
        profileJson: input.profileJson ?? null,
      })
      .onConflictDoUpdate({
        target: [playerSportProfilesTable.globalPlayerId, playerSportProfilesTable.sportSlug],
        set: {
          defaultRole: input.defaultRole ?? null,
          profileJson: input.profileJson ?? null,
          updatedAt: new Date(),
        },
      });
  }

  async deleteSportProfiles(globalPlayerId: string): Promise<void> {
    await db
      .delete(playerSportProfilesTable)
      .where(eq(playerSportProfilesTable.globalPlayerId, globalPlayerId));
  }

  async getSportProfile(
    globalPlayerId: string,
    sportSlug: string,
  ): Promise<SportProfileDto | null> {
    const normalized = normalizeSlug(sportSlug);
    const [row] = await db
      .select()
      .from(playerSportProfilesTable)
      .where(
        and(
          eq(playerSportProfilesTable.globalPlayerId, globalPlayerId),
          eq(playerSportProfilesTable.sportSlug, normalized),
        ),
      )
      .limit(1);

    if (!row) return null;
    return {
      sport: row.sportSlug,
      defaultRole: row.defaultRole,
      profileJson: row.profileJson ?? null,
    };
  }
}

export const playerSportProfileService = new PlayerSportProfileService();

import { isPlayerSpecsV2Enabled } from "@workspace/api-base/player-specs-v2";
import { playerSpecificationService } from "../player-specification-service";

export async function buildSportProfileFromAuctionPlayer(
  auctionPlayer: {
    id: number;
    role?: string | null;
    battingStyle?: string | null;
  },
  sportSlug: string,
): Promise<Record<string, unknown>> {
  const profile: Record<string, unknown> = {
    auctionPlayerId: auctionPlayer.id,
  };

  if (isPlayerSpecsV2Enabled()) {
    const specs = await playerSpecificationService.getPlayerSpecifications(auctionPlayer.id);
    const handSpec = specs.find((s) => /hand/i.test(s.groupName));
    if (handSpec?.value) {
      profile.handedness = handSpec.value;
    }
    return profile;
  }

  if (sportSlug === "cricket" && auctionPlayer.battingStyle) {
    profile.handedness = auctionPlayer.battingStyle;
  }

  return profile;
}
