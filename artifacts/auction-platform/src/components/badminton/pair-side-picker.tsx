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
      franchiseLogo: side.teamLogoUrl ?? "",
      playerIds: side.playerIds ?? [],
    });
  }

  function clearPlayer(set: (next: SidePlayerForm) => void) {
    set(emptySidePlayer());
  }

  const player1Label = isPair ? "Player 1" : "Player";
  const player2Label = "Player 2";

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-3">
      <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{sideLabel}</p>
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

export function sidePlayerFormToJson(player: SidePlayerForm) {
  return {
    label: player.name,
    shortLabel: player.short || "P",
    photoUrl: player.photoUrl || undefined,
    teamLogoUrl: player.franchiseLogo || undefined,
    masterPlayerId: player.masterId || undefined,
    playerIds: player.playerIds,
  };
}

export function sideJsonToStartSide(json: Record<string, unknown>) {
  return {
    label: (json.label as string) ?? "Player",
    shortLabel: (json.shortLabel as string) ?? "P",
    countryCode: json.countryCode as string | undefined,
    countryName: json.countryName as string | undefined,
    photoUrl: json.photoUrl as string | undefined,
    flagUrl: json.flagUrl as string | undefined,
    teamColor: json.teamColor as string | undefined,
    teamName: json.teamName as string | undefined,
    teamLogoUrl: json.teamLogoUrl as string | undefined,
    sponsorName: json.sponsorName as string | undefined,
    sponsorLogoUrl: json.sponsorLogoUrl as string | undefined,
    masterPlayerId: json.masterPlayerId as string | undefined,
    playerIds: (json.playerIds as number[]) ?? [],
    players: Array.isArray(json.players) ? json.players : undefined,
  };
}
