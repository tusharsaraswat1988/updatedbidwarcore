import { FanArenaShell } from "./FanArenaShell";

export interface TournamentShellProps {
  tournament: any;
  moduleNav: React.ReactNode;
  children: React.ReactNode;
  soundEnabled: boolean;
  onToggleSound: () => void;
  streamUrl?: string | null;
}

export function TournamentShell(props: TournamentShellProps) {
  return (
    <FanArenaShell
      tournament={props.tournament}
      soundEnabled={props.soundEnabled}
      onToggleSound={props.onToggleSound}
      streamUrl={props.streamUrl}
      isLive={!!props.streamUrl}
      moduleNav={props.moduleNav}
    >
      {props.children}
    </FanArenaShell>
  );
}
