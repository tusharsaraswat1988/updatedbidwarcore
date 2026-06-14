import { useMemo, useState } from "react";
import type { Player, Team } from "@workspace/api-client-react";
import type { CricketScoreboardState } from "@workspace/scoring-core";
import { CricketEventType } from "@workspace/scoring-core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { squadPlayersForTeam } from "@/lib/scoring-squad";
import { battingTeamId, bowlingTeamId } from "@/lib/scoring-match-logic";
import type { ScoringMatchJson } from "@/lib/scoring-api";
import { setMatchSquad } from "@/lib/scoring-foundation-api";
import { ScoringPlayerLabel } from "@/components/scoring/scoring-player-row";

type PreMatchSetupProps = {
  tournamentId: number;
  match: ScoringMatchJson;
  state: CricketScoreboardState;
  teams: Team[];
  players: Player[];
  localBowlerId: number | null;
  busy: boolean;
  onEvent: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
  onBowlerSelected: (bowlerId: number) => void;
};

function teamName(teams: Team[], id: number) {
  return teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
}

export function PreMatchSetup({
  tournamentId,
  match,
  state,
  teams,
  players,
  localBowlerId,
  busy,
  onEvent,
  onBowlerSelected,
}: PreMatchSetupProps) {
  const [tossWinner, setTossWinner] = useState<string>(
    String(state.tossWinnerTeamId ?? match.homeTeamId),
  );
  const [electedTo, setElectedTo] = useState<"bat" | "bowl">("bat");
  const oversLimit = match.rules?.overs ?? state.oversLimit ?? 20;

  const battingId = battingTeamId(state);
  const bowlingId = bowlingTeamId(state);
  const needsToss = state.tossWinnerTeamId == null;
  const needsBattingLineup =
    battingId != null && (state.lineups[battingId]?.length ?? 0) < 2;
  const needsBowlingLineup =
    bowlingId != null && (state.lineups[bowlingId]?.length ?? 0) < 1;
  const needsOpeners =
    !needsToss &&
    !needsBattingLineup &&
    !needsBowlingLineup &&
    (state.strikerId == null || state.nonStrikerId == null);
  const needsBowler =
    !needsToss &&
    !needsBattingLineup &&
    !needsBowlingLineup &&
    !needsOpeners &&
    state.bowlerId == null &&
    localBowlerId == null;

  if (!needsToss && !needsBattingLineup && !needsBowlingLineup && !needsOpeners && !needsBowler) {
    return null;
  }

  return (
    <div className="p-4 space-y-4 border-b border-border/60 bg-muted/10">
      {needsToss ? (
        <TossStep
          match={match}
          teams={teams}
          tossWinner={tossWinner}
          setTossWinner={setTossWinner}
          electedTo={electedTo}
          setElectedTo={setElectedTo}
          oversLimit={oversLimit}
          busy={busy}
          onStart={() =>
            onEvent(CricketEventType.MATCH_STARTED, {
              tossWinnerTeamId: parseInt(tossWinner, 10),
              electedTo,
              oversLimit,
            })
          }
        />
      ) : null}

      {needsBattingLineup && battingId ? (
        <SquadLineupPicker
          title={`${teamName(teams, battingId)} — squad & XI`}
          teamId={battingId}
          players={players}
          busy={busy}
          onConfirm={async (playingXi, bench, battingOrder) => {
            await setMatchSquad(tournamentId, match.id, battingId, {
              playingXi,
              bench,
              battingOrder,
            });
            await onEvent(CricketEventType.LINEUP_SET, {
              teamId: battingId,
              playerIds: playingXi,
              battingOrder,
            });
          }}
        />
      ) : null}

      {needsBowlingLineup && bowlingId ? (
        <SquadLineupPicker
          title={`${teamName(teams, bowlingId)} — squad & XI`}
          teamId={bowlingId}
          players={players}
          busy={busy}
          onConfirm={async (playingXi, bench) => {
            await setMatchSquad(tournamentId, match.id, bowlingId, {
              playingXi,
              bench,
            });
            await onEvent(CricketEventType.LINEUP_SET, { teamId: bowlingId, playerIds: playingXi });
          }}
        />
      ) : null}

      {needsOpeners && battingId ? (
        <OpenersPicker
          teamId={battingId}
          players={players}
          lineup={state.lineups[battingId] ?? []}
          busy={busy}
          onConfirm={(strikerId, nonStrikerId) =>
            onEvent(CricketEventType.LINEUP_SET, {
              teamId: battingId,
              playerIds: state.lineups[battingId] ?? [],
              battingOrder: [strikerId, nonStrikerId],
            })
          }
        />
      ) : null}

      {needsBowler && bowlingId ? (
        <BowlerPicker
          teamId={bowlingId}
          players={players}
          lineup={state.lineups[bowlingId] ?? []}
          busy={busy}
          onSelect={onBowlerSelected}
        />
      ) : null}
    </div>
  );
}

function TossStep({
  match,
  teams,
  tossWinner,
  setTossWinner,
  electedTo,
  setElectedTo,
  oversLimit,
  busy,
  onStart,
}: {
  match: ScoringMatchJson;
  teams: Team[];
  tossWinner: string;
  setTossWinner: (v: string) => void;
  electedTo: "bat" | "bowl";
  setElectedTo: (v: "bat" | "bowl") => void;
  oversLimit: number;
  busy: boolean;
  onStart: () => void;
}) {
  const home = teams.find((t) => t.id === match.homeTeamId);
  const away = teams.find((t) => t.id === match.awayTeamId);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Toss</h2>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Toss winner</Label>
        <Select value={tossWinner} onValueChange={setTossWinner}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={String(match.homeTeamId)}>
              {home?.name ?? "Home"}
            </SelectItem>
            <SelectItem value={String(match.awayTeamId)}>
              {away?.name ?? "Away"}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={electedTo === "bat" ? "default" : "outline"}
          className="h-11"
          onClick={() => setElectedTo("bat")}
        >
          Bat first
        </Button>
        <Button
          type="button"
          variant={electedTo === "bowl" ? "default" : "outline"}
          className="h-11"
          onClick={() => setElectedTo("bowl")}
        >
          Bowl first
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{oversLimit}-over match</p>
      <Button className="w-full h-12 text-base" disabled={busy} onClick={onStart}>
        Start match
      </Button>
    </section>
  );
}

function SquadLineupPicker({
  title,
  teamId,
  players,
  busy,
  onConfirm,
}: {
  title: string;
  teamId: number;
  players: Player[];
  busy: boolean;
  onConfirm: (playingXi: number[], bench: number[], battingOrder?: number[]) => void | Promise<void>;
}) {
  const squad = useMemo(() => squadPlayersForTeam(players, teamId), [players, teamId]);
  const [playingXi, setPlayingXi] = useState<number[]>([]);
  const [bench, setBench] = useState<number[]>([]);

  function toggleXi(id: number) {
    setPlayingXi((prev) => {
      if (prev.includes(id)) {
        setBench((b) => b.filter((x) => x !== id));
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 11) return prev;
      setBench((b) => b.filter((x) => x !== id));
      return [...prev, id];
    });
  }

  function toggleBench(id: number) {
    if (playingXi.includes(id)) return;
    setBench((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          XI {playingXi.length}/11 · Bench {bench.length}/4
        </span>
      </div>
      {squad.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sold players for this team. Add players via auction first.
        </p>
      ) : (
        <ul className="max-h-56 overflow-y-auto space-y-1">
          {squad.map((p) => {
            const inXi = playingXi.includes(p.id);
            const onBench = bench.includes(p.id);
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/40">
                <label className="flex flex-1 items-center gap-2 cursor-pointer min-w-0">
                  <Checkbox checked={inXi} onCheckedChange={() => toggleXi(p.id)} />
                  <ScoringPlayerLabel name={p.name} photoUrl={p.photoUrl} gender={p.gender} role={p.role} />
                </label>
                {!inXi ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={onBench ? "secondary" : "ghost"}
                    className="h-8 text-xs shrink-0"
                    onClick={() => toggleBench(p.id)}
                  >
                    {onBench ? "Bench" : "+Bench"}
                  </Button>
                ) : (
                  <span className="text-[10px] uppercase text-primary font-medium px-1">XI</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Button
        className="w-full h-11"
        disabled={busy || playingXi.length < 2}
        onClick={() => void onConfirm(playingXi, bench, playingXi)}
      >
        Confirm squad ({playingXi.length} playing)
      </Button>
    </section>
  );
}

function OpenersPicker({
  teamId,
  players,
  lineup,
  busy,
  onConfirm,
}: {
  teamId: number;
  players: Player[];
  lineup: number[];
  busy: boolean;
  onConfirm: (strikerId: number, nonStrikerId: number) => void;
}) {
  const squad = useMemo(() => {
    const map = new Map(squadPlayersForTeam(players, teamId).map((p) => [p.id, p]));
    return lineup.map((id) => map.get(id)).filter(Boolean) as Player[];
  }, [players, teamId, lineup]);

  const [striker, setStriker] = useState<string>("");
  const [nonStriker, setNonStriker] = useState<string>("");

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Opening batters</h2>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Striker</Label>
        <Select value={striker} onValueChange={setStriker}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select striker" />
          </SelectTrigger>
          <SelectContent>
            {squad.map((p) => (
              <SelectItem key={p.id} value={String(p.id)} disabled={nonStriker === String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Non-striker</Label>
        <Select value={nonStriker} onValueChange={setNonStriker}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select non-striker" />
          </SelectTrigger>
          <SelectContent>
            {squad.map((p) => (
              <SelectItem key={p.id} value={String(p.id)} disabled={striker === String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        className="w-full h-11"
        disabled={busy || !striker || !nonStriker || striker === nonStriker}
        onClick={() => onConfirm(parseInt(striker, 10), parseInt(nonStriker, 10))}
      >
        Confirm openers
      </Button>
    </section>
  );
}

function BowlerPicker({
  teamId,
  players,
  lineup,
  busy,
  onSelect,
}: {
  teamId: number;
  players: Player[];
  lineup: number[];
  busy: boolean;
  onSelect: (bowlerId: number) => void;
}) {
  const squad = useMemo(() => {
    const map = new Map(squadPlayersForTeam(players, teamId).map((p) => [p.id, p]));
    return lineup.map((id) => map.get(id)).filter(Boolean) as Player[];
  }, [players, teamId, lineup]);

  const [bowler, setBowler] = useState<string>("");

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Opening bowler</h2>
      <Select value={bowler} onValueChange={setBowler}>
        <SelectTrigger className="h-11">
          <SelectValue placeholder="Select bowler" />
        </SelectTrigger>
        <SelectContent>
          {squad.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        className="w-full h-11"
        disabled={busy || !bowler}
        onClick={() => onSelect(parseInt(bowler, 10))}
      >
        Confirm bowler
      </Button>
    </section>
  );
}
