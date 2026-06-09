import type {
  BadmintonMatchKind,
  BadmintonPlayerSlot,
  BadmintonSideInfo,
} from "./types";

export function isPairMatchKind(
  matchKind: BadmintonMatchKind | string,
): boolean {
  return matchKind === "doubles" || matchKind === "mixed_doubles";
}

/** Expand a side into 1–2 display slots (singles vs doubles). */
export function getSidePlayerSlots(info: BadmintonSideInfo): BadmintonPlayerSlot[] {
  if (info.players && info.players.length > 0) {
    return info.players;
  }

  return [
    {
      label: info.label,
      shortLabel: info.shortLabel,
      countryCode: info.countryCode,
      countryName: info.countryName,
      photoUrl: info.photoUrl,
      flagUrl: info.flagUrl,
      teamColor: info.teamColor,
      teamName: info.teamName,
      teamLogoUrl: info.teamLogoUrl,
      sponsorName: info.sponsorName,
      sponsorLogoUrl: info.sponsorLogoUrl,
      masterPlayerId: info.masterPlayerId,
    },
  ];
}

export function isPairSide(
  info: BadmintonSideInfo,
  matchKind?: BadmintonMatchKind | string,
): boolean {
  if (matchKind && isPairMatchKind(matchKind)) return true;
  return (info.players?.length ?? 0) > 1 || (info.playerIds?.length ?? 0) > 1;
}

function slotFromPartial(
  player: Partial<BadmintonSideInfo>,
): BadmintonPlayerSlot {
  return {
    label: player.label ?? "Player",
    shortLabel: player.shortLabel ?? "P",
    countryCode: player.countryCode,
    countryName: player.countryName,
    photoUrl: player.photoUrl,
    flagUrl: player.flagUrl,
    teamColor: player.teamColor,
    teamName: player.teamName,
    teamLogoUrl: player.teamLogoUrl,
    sponsorName: player.sponsorName,
    sponsorLogoUrl: player.sponsorLogoUrl,
    masterPlayerId: player.masterPlayerId,
  };
}

/** Merge two singles side previews into one doubles / mixed pair side. */
export function mergeDoublesSideJson(
  player1: Partial<BadmintonSideInfo>,
  player2: Partial<BadmintonSideInfo>,
): BadmintonSideInfo {
  const slot1 = slotFromPartial(player1);
  const slot2 = slotFromPartial(player2);

  const teamNames = [slot1.teamName, slot2.teamName].filter(Boolean);
  const uniqueTeams = [...new Set(teamNames)];

  return {
    label: `${slot1.label} / ${slot2.label}`,
    shortLabel: `${slot1.shortLabel} / ${slot2.shortLabel}`,
    countryCode: slot1.countryCode ?? slot2.countryCode,
    countryName: slot1.countryName ?? slot2.countryName,
    photoUrl: slot1.photoUrl ?? slot2.photoUrl,
    flagUrl: slot1.flagUrl ?? slot2.flagUrl,
    teamColor: slot1.teamColor ?? slot2.teamColor,
    teamName:
      uniqueTeams.length > 1 ? uniqueTeams.join(" / ") : uniqueTeams[0],
    teamLogoUrl: slot1.teamLogoUrl ?? slot2.teamLogoUrl,
    sponsorName: slot1.sponsorName ?? slot2.sponsorName,
    sponsorLogoUrl: slot1.sponsorLogoUrl ?? slot2.sponsorLogoUrl,
    playerIds: [
      ...(player1.playerIds ?? []),
      ...(player2.playerIds ?? []),
    ],
    players: [slot1, slot2],
  };
}
