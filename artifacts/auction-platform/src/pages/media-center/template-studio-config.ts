/**
 * Template Studio — registry-keyed data configuration.
 *
 * Maps each BuzzTemplateType to its Phase-13 provider loader and list metadata.
 * Consumer pages resolve config via getTemplateStudioConfig() — no switch statements.
 */

import { BuzzTemplateType } from "@/features/buzz-studio/registry/template-types";
import {
  getPlayerSpotlightContracts,
  getSoldPlayerContracts,
  getTopBuysContract,
  getTeamRevealContracts,
} from "@/features/buzz-studio";
import type { PlayerSpotlightContract } from "@/features/buzz-studio/contracts/PlayerSpotlight.contract";
import type { SoldPlayerContract } from "@/features/buzz-studio/contracts/SoldPlayer.contract";
import type { TopBuysListContract } from "@/features/buzz-studio/contracts/TopBuy.contract";
import type { TeamRevealContract } from "@/features/buzz-studio/contracts/TeamReveal.contract";

export type TemplateStudioSelectionMode = "list" | "none";

export interface TemplateStudioListItem {
  id: string;
  label: string;
  subtitle?: string;
  searchText: string;
}

export interface TemplateStudioLoadedData {
  selectionMode: TemplateStudioSelectionMode;
  emptyMessage: string;
  items: TemplateStudioListItem[];
  contractsById: Map<string, Record<string, unknown>>;
  directContract?: Record<string, unknown>;
}

export interface TemplateStudioConfig {
  selectionMode: TemplateStudioSelectionMode;
  emptyMessage: string;
  listLabel: string;
  load: (tournamentId: number) => Promise<TemplateStudioLoadedData>;
}

function itemKey(id: string | undefined, fallback: string): string {
  return id ?? fallback;
}

async function loadPlayerSpotlightData(
  tournamentId: number,
): Promise<TemplateStudioLoadedData> {
  const contracts = await getPlayerSpotlightContracts(tournamentId);
  const items: TemplateStudioListItem[] = contracts.map((contract) => ({
    id: itemKey(contract.playerId, contract.playerName),
    label: contract.playerName,
    subtitle: contract.teamName ?? contract.designation,
    searchText: [contract.playerName, contract.teamName, contract.city, contract.designation]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));
  const contractsById = new Map<string, Record<string, unknown>>(
    contracts.map((contract) => [
      itemKey(contract.playerId, contract.playerName),
      contract as unknown as Record<string, unknown>,
    ]),
  );

  return {
    selectionMode: "list",
    emptyMessage: "No players available",
    items,
    contractsById,
  };
}

async function loadSoldPlayerData(
  tournamentId: number,
): Promise<TemplateStudioLoadedData> {
  const contracts = await getSoldPlayerContracts(tournamentId);
  const items: TemplateStudioListItem[] = contracts.map((contract) => ({
    id: itemKey(contract.playerId, contract.playerName),
    label: contract.playerName,
    subtitle: contract.teamName,
    searchText: [contract.playerName, contract.teamName, contract.designation]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));
  const contractsById = new Map<string, Record<string, unknown>>(
    contracts.map((contract) => [
      itemKey(contract.playerId, contract.playerName),
      contract as unknown as Record<string, unknown>,
    ]),
  );

  return {
    selectionMode: "list",
    emptyMessage: "No sold players yet",
    items,
    contractsById,
  };
}

async function loadTopBuysData(
  tournamentId: number,
): Promise<TemplateStudioLoadedData> {
  const contract = await getTopBuysContract(tournamentId);

  return {
    selectionMode: "none",
    emptyMessage: "No sold players yet",
    items: [],
    contractsById: new Map(),
    directContract: contract as unknown as Record<string, unknown>,
  };
}

async function loadTeamRevealData(
  tournamentId: number,
): Promise<TemplateStudioLoadedData> {
  const contracts = await getTeamRevealContracts(tournamentId);
  const items: TemplateStudioListItem[] = contracts.map((contract) => ({
    id: itemKey(contract.teamId, contract.teamName ?? "team"),
    label: contract.teamName ?? "Team",
    subtitle:
      contract.playerCount != null ? `${contract.playerCount} players` : undefined,
    searchText: [contract.teamName, contract.captainName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));
  const contractsById = new Map<string, Record<string, unknown>>(
    contracts.map((contract) => [
      itemKey(contract.teamId, contract.teamName ?? "team"),
      contract as unknown as Record<string, unknown>,
    ]),
  );

  return {
    selectionMode: "list",
    emptyMessage: "No teams available",
    items,
    contractsById,
  };
}

const TEMPLATE_STUDIO_CONFIG: Readonly<
  Partial<Record<BuzzTemplateType, TemplateStudioConfig>>
> = {
  [BuzzTemplateType.PLAYER_SPOTLIGHT]: {
    selectionMode: "list",
    emptyMessage: "No players available",
    listLabel: "Players",
    load: loadPlayerSpotlightData,
  },
  [BuzzTemplateType.SOLD_PLAYER]: {
    selectionMode: "list",
    emptyMessage: "No sold players yet",
    listLabel: "Sold Players",
    load: loadSoldPlayerData,
  },
  [BuzzTemplateType.TOP_BUYS]: {
    selectionMode: "none",
    emptyMessage: "No sold players yet",
    listLabel: "",
    load: loadTopBuysData,
  },
  [BuzzTemplateType.TEAM_REVEAL]: {
    selectionMode: "list",
    emptyMessage: "No teams available",
    listLabel: "Teams",
    load: loadTeamRevealData,
  },
};

export function getTemplateStudioConfig(
  templateId: BuzzTemplateType,
): TemplateStudioConfig | undefined {
  return TEMPLATE_STUDIO_CONFIG[templateId];
}

export function hasTemplateStudioSupport(templateId: BuzzTemplateType): boolean {
  return templateId in TEMPLATE_STUDIO_CONFIG;
}

export function isTopBuysEmpty(contract: TopBuysListContract): boolean {
  return contract.entries.length === 0;
}

export type {
  PlayerSpotlightContract,
  SoldPlayerContract,
  TopBuysListContract,
  TeamRevealContract,
};
