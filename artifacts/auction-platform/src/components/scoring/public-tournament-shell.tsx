import React from "react";
import { TournamentShell } from "../fan/tournament-shell";
import { CricketFanNav } from "@/components/scoring/public-tournament-shell";

export function CricketFanExperienceShell({
  tournament,
  liveMatchId,
  streamUrl,
  hideNav = false,
  children,
}: {
  tournament: any;
  liveMatchId?: number | null;
  streamUrl?: string | null;
  hideNav?: boolean;
  children: React.ReactNode;
}) {
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  return (
    <TournamentShell
      tournament={tournament}
      soundEnabled={soundEnabled}
      onToggleSound={() => setSoundEnabled(!soundEnabled)}
      moduleNav={!hideNav && <CricketFanNav tournamentId={tournament.id} liveMatchId={liveMatchId} streamUrl={streamUrl} />}
    >
      {children}
    </TournamentShell>
  );
}

export function CricketFanLoading({ tournamentId }: { tournamentId: number }) {
  return <div className="p-10 text-center">Loading Arena...</div>;
}

export function CricketFanEmpty({ message }: { message: string }) {
  return <div className="p-10 text-center text-muted-foreground">{message}</div>;
}
