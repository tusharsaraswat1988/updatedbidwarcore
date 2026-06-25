import { isPlayerSportProfilesEnabled } from "@workspace/api-base/player-sport-profiles";
import type { globalPlayersTable } from "@workspace/db";
import {
  privateGlobalPlayerSerializer,
  publicGlobalPlayerSerializer,
} from "../serializers/global-player";
import {
  playerSportProfileService,
  type SportProfileDto,
} from "./player-sport-profile-service";

type GlobalPlayerRow = typeof globalPlayersTable.$inferSelect;

export type SerializedSportProfile = {
  sport: string;
  defaultRole: string | null;
};

function toSportProfileDto(profile: SportProfileDto): SerializedSportProfile {
  return {
    sport: profile.sport,
    defaultRole: profile.defaultRole,
  };
}

export async function serializeGlobalPlayerWithProfiles(
  gp: GlobalPlayerRow,
  mode: "private" | "public" = "private",
  profilesMap?: Map<string, SportProfileDto[]>,
): Promise<Record<string, unknown>> {
  const base =
    mode === "private"
      ? (privateGlobalPlayerSerializer(gp) as Record<string, unknown>)
      : (publicGlobalPlayerSerializer(gp) as Record<string, unknown>);

  if (!isPlayerSportProfilesEnabled()) {
    return base;
  }

  let sportProfiles = profilesMap?.get(gp.id);
  if (sportProfiles === undefined) {
    sportProfiles = await playerSportProfileService.getSportProfiles(gp.id);
  }

  return {
    ...base,
    sportProfiles: sportProfiles.map(toSportProfileDto),
  };
}

export async function serializeGlobalPlayersWithProfiles(
  players: GlobalPlayerRow[],
  mode: "private" | "public" = "private",
): Promise<Record<string, unknown>[]> {
  if (players.length === 0) return [];

  if (!isPlayerSportProfilesEnabled()) {
    const serializer =
      mode === "private" ? privateGlobalPlayerSerializer : publicGlobalPlayerSerializer;
    return players.map((p) => serializer(p) as Record<string, unknown>);
  }

  const profilesMap = await playerSportProfileService.getSportProfilesForPlayers(
    players.map((p) => p.id),
  );

  return Promise.all(
    players.map((p) => serializeGlobalPlayerWithProfiles(p, mode, profilesMap)),
  );
}
