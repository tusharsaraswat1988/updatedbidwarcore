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
import { ScoringPlayerLabel } from "@/components/scoring/scoring-player-row";

type PreMatchSetupProps = {
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
        <LineupPicker
          title={`${teamName(teams, battingId)} — batting XI`}
          teamId={battingId}
          players={players}
          minPick={2}
          maxPick={11}
          busy={busy}
          onConfirm={(playerIds, battingOrder) =>
            onEvent(CricketEventType.LINEUP_SET, {
              teamId: battingId,
              playerIds,
              battingOrder,
            })
          }
        />
      ) : null}

      {needsBowlingLineup && bowlingId ? (
        <LineupPicker
          title={`${teamName(teams, bowlingId)} — bowling XI`}
          teamId={bowlingId}
          players={players}
          minPick={1}
          maxPick={11}
          busy={busy}
          onConfirm={(playerIds) =>
            onEvent(CricketEventType.LINEUP_SET, { teamId: bowlingId, playerIds })
          }
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

function LineupPicker({
  title,
  teamId,
  players,
  minPick,
  maxPick,
  busy,
  onConfirm,
}: {
  title: string;
  teamId: number;
  players: Player[];
  minPick: number;
  maxPick: number;
  busy: boolean;
  onConfirm: (playerIds: number[], battingOrder?: number[]) => void;
}) {
  const squad = useMemo(() => squadPlayersForTeam(players, teamId), [players, teamId]);
  const [selected, setSelected] = useState<number[]>([]);

  function toggle(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxPick) return prev;
      return [...prev, id];
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {selected.length}/{maxPick}
        </span>
      </div>
      {squad.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sold players for this team. Add players via auction first.
        </p>
      ) : (
        <ul className="max-h-48 overflow-y-auto space-y-1">
          {squad.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40 cursor-pointer">
                <Checkbox
                  checked={selected.includes(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                />
                <ScoringPlayerLabel name={p.name} photoUrl={p.photoUrl} role={p.role} />
              </label>
            </li>
          ))}
        </ul>
      )}
      <Button
        className="w-full h-11"
        disabled={busy || selected.length < minPick}
        onClick={() => onConfirm(selected, selected)}
      >
        Confirm XI ({selected.length})
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
