import { MasterPlayerPicker } from "@/components/badminton/master-player-picker";

export type SidePlayerForm = {
  masterId: string | null;
  name: string;
  short: string;
  photoUrl: string;
  franchiseLogo: string;
  playerIds: number[];
};

export const emptySidePlayer = (): SidePlayerForm => ({
  masterId: null,
  name: "",
  short: "",
  photoUrl: "",
  franchiseLogo: "",
  playerIds: [],
});

type SidePreview = {
  label: string;
  shortLabel: string;
  photoUrl?: string;
  franchiseLogoUrl?: string;
  teamLogoUrl?: string;
  masterPlayerId?: string;
  playerIds: number[];
};

export function PairSidePicker({
  tournamentId,
  sideLabel,
  isPair,
  player1,
  player2,
  onPlayer1Change,
  onPlayer2Change,
}: {
  tournamentId: number;
  sideLabel: string;
  isPair: boolean;
  player1: SidePlayerForm;
  player2: SidePlayerForm;
  onPlayer1Change: (next: SidePlayerForm) => void;
  onPlayer2Change: (next: SidePlayerForm) => void;
}) {
  function applySide(side: SidePreview, set: (next: SidePlayerForm) => void) {
    set({
      masterId: side.masterPlayerId ?? null,
      name: side.label,
      short: side.shortLabel,
      photoUrl: side.photoUrl ?? "",
      franchiseLogo: side.franchiseLogoUrl ?? side.teamLogoUrl ?? "",
      playerIds: side.playerIds ?? [],
    });
  }

  function clearPlayer(set: (next: SidePlayerForm) => void) {
    set(emptySidePlayer());
  }

  const player1Label = isPair ? "Player 1" : "Player";
  const player2Label = "Player 2";

  return (
    <div className="rounded-xl border border-white/10 bg-[#121c34]/60 p-4 space-y-3">
      <p className="text-[#4fc3f7] text-[11px] font-bold uppercase tracking-[0.16em]">{sideLabel}</p>
      <MasterPlayerPicker
        tournamentId={tournamentId}
        label={player1Label}
        value={player1.masterId}
        selectedDisplayName={player1.name || undefined}
        selectedPhotoUrl={player1.photoUrl}
        selectedFranchiseLogoUrl={player1.franchiseLogo || undefined}
        onSelect={(_player, side) => applySide(side, onPlayer1Change)}
        onClear={() => clearPlayer(onPlayer1Change)}
      />
      {isPair && (
        <MasterPlayerPicker
          tournamentId={tournamentId}
          label={player2Label}
          value={player2.masterId}
          selectedDisplayName={player2.name || undefined}
          selectedPhotoUrl={player2.photoUrl}
          selectedFranchiseLogoUrl={player2.franchiseLogo || undefined}
          onSelect={(_player, side) => applySide(side, onPlayer2Change)}
          onClear={() => clearPlayer(onPlayer2Change)}
        />
      )}
    </div>
  );
}

export function sideJsonToPlayerForm(
  json: Record<string, unknown>,
  playerIndex = 0,
): SidePlayerForm {
  const players = Array.isArray(json.players)
    ? (json.players as Record<string, unknown>[])
    : null;

  if (players && players.length > playerIndex) {
    const player = players[playerIndex]!;
    return {
      masterId: (player.masterPlayerId as string | undefined) ?? null,
      name: (player.label as string | undefined) ?? "",
      short: (player.shortLabel as string | undefined) ?? "",
      photoUrl: (player.photoUrl as string | undefined) ?? "",
      franchiseLogo:
        ((player.franchiseLogoUrl ?? player.teamLogoUrl) as string | undefined) ?? "",
      playerIds: (player.playerIds as number[] | undefined) ?? [],
    };
  }

  if (playerIndex > 0) return emptySidePlayer();

  return {
    masterId: (json.masterPlayerId as string | undefined) ?? null,
    name: (json.label as string | undefined) ?? "",
    short: (json.shortLabel as string | undefined) ?? "",
    photoUrl: (json.photoUrl as string | undefined) ?? "",
    franchiseLogo:
      ((json.franchiseLogoUrl ?? json.teamLogoUrl) as string | undefined) ?? "",
    playerIds: (json.playerIds as number[] | undefined) ?? [],
  };
}

export function sidePlayerFormToJson(player: SidePlayerForm) {
  return {
    label: player.name,
    shortLabel: player.short || "P",
    photoUrl: player.photoUrl || undefined,
    franchiseLogoUrl: player.franchiseLogo || undefined,
    teamLogoUrl: player.franchiseLogo || undefined,
    masterPlayerId: player.masterId || undefined,
    playerIds: player.playerIds,
  };
}

export function sideJsonToStartSide(json: Record<string, unknown>) {
  const franchiseName = (json.franchiseName ?? json.teamName) as string | undefined;
  const franchiseLogoUrl = (json.franchiseLogoUrl ?? json.teamLogoUrl ?? json.flagUrl) as
    | string
    | undefined;
  return {
    label: (json.label as string) ?? "Player",
    shortLabel: (json.shortLabel as string) ?? "P",
    countryCode: json.countryCode as string | undefined,
    countryName: json.countryName as string | undefined,
    photoUrl: json.photoUrl as string | undefined,
    flagUrl: json.flagUrl as string | undefined,
    teamColor: json.teamColor as string | undefined,
    franchiseName,
    franchiseLogoUrl,
    teamName: franchiseName,
    teamLogoUrl: franchiseLogoUrl,
    sponsorName: json.sponsorName as string | undefined,
    sponsorLogoUrl: json.sponsorLogoUrl as string | undefined,
    masterPlayerId: json.masterPlayerId as string | undefined,
    playerIds: (json.playerIds as number[]) ?? [],
    players: Array.isArray(json.players) ? json.players : undefined,
  };
}

