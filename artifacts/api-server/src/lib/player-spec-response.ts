import { isPlayerSpecsV2Enabled } from "@workspace/api-base/player-specs-v2";
import type { playersTable } from "@workspace/db";
import {
  publicAuctionPlayerSerializer,
  privatePlayerSerializer,
  publicPlayerSerializer,
} from "./serializers/player";
import {
  legacyFieldsFromSpecifications,
  playerSpecificationService,
  type PlayerSpecification,
  type PlayerSpecificationInput,
} from "./player-specification-service";

type PlayerRow = typeof playersTable.$inferSelect;

export type SerializedPlayerSpecification = {
  specGroupId: number;
  groupName: string;
  value: string;
};

export type PlayerSerializerMode = "private" | "public" | "auction";

function baseSerializer(mode: PlayerSerializerMode) {
  if (mode === "private") return privatePlayerSerializer;
  if (mode === "auction") return publicAuctionPlayerSerializer;
  return publicPlayerSerializer;
}

function toSpecificationDto(spec: PlayerSpecification): SerializedPlayerSpecification {
  return {
    specGroupId: spec.specGroupId,
    groupName: spec.groupName,
    value: spec.value,
  };
}

export async function serializePlayerWithSpecifications(
  player: PlayerRow,
  mode: PlayerSerializerMode = "private",
  specsMap?: Map<number, PlayerSpecification[]>,
): Promise<Record<string, unknown>> {
  const base = baseSerializer(mode)(player) as Record<string, unknown>;

  if (!isPlayerSpecsV2Enabled()) {
    return base;
  }

  let specifications = specsMap?.get(player.id);
  if (specifications === undefined) {
    specifications = await playerSpecificationService.getPlayerSpecifications(player.id);
  }

  const merged = mergePlayerLegacyFieldsFromSpecifications(base, specifications);

  return {
    ...merged,
    specifications: specifications.map(toSpecificationDto),
  };
}

export async function serializePlayersWithSpecifications(
  players: PlayerRow[],
  mode: PlayerSerializerMode = "private",
): Promise<Record<string, unknown>[]> {
  if (players.length === 0) return [];

  if (!isPlayerSpecsV2Enabled()) {
    const serializer = baseSerializer(mode);
    return players.map((p) => serializer(p) as Record<string, unknown>);
  }

  const specsMap = await playerSpecificationService.getSpecificationsForPlayers(
    players.map((p) => p.id),
  );

  return Promise.all(
    players.map((player) => serializePlayerWithSpecifications(player, mode, specsMap)),
  );
}

function mergePlayerLegacyFieldsFromSpecifications(
  player: Record<string, unknown>,
  specifications: PlayerSpecification[],
): Record<string, unknown> {
  if (specifications.length === 0) return player;
  const legacy = legacyFieldsFromSpecifications(specifications);
  return {
    ...player,
    battingStyle: legacy.battingStyle ?? player.battingStyle ?? null,
    bowlingStyle: legacy.bowlingStyle ?? player.bowlingStyle ?? null,
    specialization: legacy.specialization ?? player.specialization ?? null,
  };
}

export async function persistPlayerSpecificationsDualWrite(
  tournamentId: number,
  playerId: number,
  role: string | null | undefined,
  input: {
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    specialization?: string | null;
    specifications?: PlayerSpecificationInput[] | null;
  },
): Promise<void> {
  if (!isPlayerSpecsV2Enabled()) return;

  const { buildSpecificationsForSave } = await import("./player-specification-service");
  const specs = await buildSpecificationsForSave(tournamentId, role, input);
  await playerSpecificationService.savePlayerSpecifications(playerId, specs);
}

export async function resolveLegacyFieldsForInsert(
  tournamentId: number,
  role: string | null | undefined,
  input: {
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    specialization?: string | null;
    specifications?: PlayerSpecificationInput[] | null;
  },
): Promise<{
  battingStyle: string | null;
  bowlingStyle: string | null;
  specialization: string | null;
}> {
  if (!isPlayerSpecsV2Enabled()) {
    return {
      battingStyle: input.battingStyle ?? null,
      bowlingStyle: input.bowlingStyle ?? null,
      specialization: input.specialization ?? null,
    };
  }

  const { buildSpecificationsForSave, legacyFieldsFromSpecificationInputs } = await import(
    "./player-specification-service"
  );
  const specs = await buildSpecificationsForSave(tournamentId, role, input);
  if (specs.length === 0) {
    return {
      battingStyle: input.battingStyle ?? null,
      bowlingStyle: input.bowlingStyle ?? null,
      specialization: input.specialization ?? null,
    };
  }
  return legacyFieldsFromSpecificationInputs(specs);
}
