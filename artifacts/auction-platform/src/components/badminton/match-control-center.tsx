/**
 * Match Control Center — Tournament Director administration panel.
 * Scoring remains scorer-controlled; this panel handles match administration.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BadmintonMatchState, IncidentLogEntry } from "@workspace/badminton-core";
import { formatPauseReason, hasCompletedGames } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";
import { BtnPrimary, DarkSelect, FormError, FormField, inputClass } from "@/components/badminton/page-chrome";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import { useBadmintonDirector } from "@/hooks/use-badminton-match";
import { forceUnlockBadmintonMatch } from "@/lib/scorer-api";
import { badmintonFetch } from "@/lib/badminton-api";
import { useToast } from "@/hooks/use-toast";
import {
  formatTeamPlayerLine,
  identityFromSideInfo,
} from "@/lib/team-player-identity";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Props = {
  tournamentId: number;
  matchId: number;
  state: BadmintonMatchState;
};

type PendingOutcome =
  | { kind: "retirement" }
  | { kind: "walkover" }
  | { kind: "disqualification" }
  | { kind: "force_end" }
  | null;

function parseMarginPoints(raw: string): number | null {
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function formatIncidentTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function sideLabel(state: BadmintonMatchState, side: "left" | "right"): string {
  return formatTeamPlayerLine(
    identityFromSideInfo(side === "left" ? state.leftSide : state.rightSide),
  );
}

export function MatchControlCenter({ tournamentId, matchId, state }: Props) {
  const director = useBadmintonDirector(tournamentId, matchId);
  const { toast } = useToast();
  const [noteText, setNoteText] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [pauseReason, setPauseReason] = useState<
    "medical" | "technical_issue" | "weather" | "court_issue" | "other"
  >("medical");
  const [pauseDetail, setPauseDetail] = useState("");
  const [retireSide, setRetireSide] = useState<"left" | "right">("left");
  const [retireReason, setRetireReason] = useState<"injury" | "illness" | "other">("injury");
  const [walkoverSide, setWalkoverSide] = useState<"left" | "right">("left");
  const [walkoverReason, setWalkoverReason] = useState<
    "opponent_absent" | "forfeit" | "administrative_decision"
  >("opponent_absent");
  const [dqSide, setDqSide] = useState<"left" | "right">("right");
  const [dqReason, setDqReason] = useState("");
  const [forceEndReason, setForceEndReason] = useState("");
  const [marginPointsInput, setMarginPointsInput] = useState(
    state.assignedMarginPoints != null ? String(state.assignedMarginPoints) : "",
  );
  const [pendingOutcome, setPendingOutcome] = useState<PendingOutcome>(null);

  const leftName = sideLabel(state, "left");
  const rightName = sideLabel(state, "right");

  const isLive = state.matchStatus === "live";
  const isPaused = state.matchStatus === "paused" || state.isPaused;
  const isOnHold = state.matchStatus === "on_hold" || state.pauseReason === "ops_hold";
  const isTerminal = ["completed", "walkover", "retired", "disqualified", "abandoned"].includes(
    state.matchStatus,
  );
  const needsAssignedMargin = !hasCompletedGames(state.games);
  const parsedMargin = parseMarginPoints(marginPointsInput);
  const marginReady = !needsAssignedMargin || parsedMargin != null;

  const { data: incidentData } = useQuery<{ incidents: IncidentLogEntry[] }>({
    queryKey: ["badminton-incidents", tournamentId, matchId],
    queryFn: () =>
      badmintonFetch<{ incidents: IncidentLogEntry[] }>(
        tournamentId,
        `/matches/${matchId}/incidents`,
      ),
    enabled: !!tournamentId && !!matchId,
    staleTime: 10_000,
    refetchInterval: isLive || isPaused ? 5_000 : false,
  });

  const incidents = incidentData?.incidents ?? [];

  async function runAction(action: () => Promise<unknown>) {
    setActionError("");
    setBusy(true);
    try {
      await action();
      setPendingOutcome(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const marginSuffix =
    needsAssignedMargin && parsedMargin != null
      ? ` Winner margin: +${parsedMargin}.`
      : "";

  const confirmCopy =
    pendingOutcome?.kind === "retirement"
      ? {
          title: "Declare retirement?",
          description: `This ends the match. ${sideLabel(state, retireSide)} retires (${retireReason}).${marginSuffix} This cannot be undone from scoring.`,
          confirmLabel: "Declare Retirement",
          action: () =>
            director.retirement(
              retireSide,
              retireReason,
              needsAssignedMargin ? parsedMargin ?? undefined : undefined,
            ),
        }
      : pendingOutcome?.kind === "walkover"
        ? {
            title: "Declare walkover?",
            description: `Award the match to ${sideLabel(state, walkoverSide)} (${walkoverReason.replace(/_/g, " ")}).${marginSuffix} This cannot be undone from scoring.`,
            confirmLabel: "Declare Walkover",
            action: () =>
              director.walkover(
                walkoverSide,
                walkoverReason,
                needsAssignedMargin ? parsedMargin ?? undefined : undefined,
              ),
          }
        : pendingOutcome?.kind === "disqualification"
          ? {
              title: "Declare disqualification?",
              description: `Disqualify ${sideLabel(state, dqSide)}. Reason: ${dqReason.trim()}.${marginSuffix} This cannot be undone from scoring.`,
              confirmLabel: "Declare Disqualification",
              action: () =>
                director.disqualification(
                  dqSide,
                  dqReason,
                  needsAssignedMargin ? parsedMargin ?? undefined : undefined,
                ),
            }
          : pendingOutcome?.kind === "force_end"
            ? {
                title: "Force end match?",
                description: `End the match immediately. Reason: ${forceEndReason.trim()}.${marginSuffix} Prefer Walkover or Retirement when those apply.`,
                confirmLabel: "Force End Match",
                action: () =>
                  director.forceEnd(
                    forceEndReason,
                    needsAssignedMargin ? parsedMargin ?? undefined : undefined,
                  ),
              }
            : null;

  return (
    <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-primary/10">
        <h2 className="text-white font-black text-lg tracking-wide uppercase">
          Match Control Center
        </h2>
        <p className="text-white/40 text-xs mt-0.5">
          Tournament Director — match administration only
        </p>
        <p className="text-white/75 text-sm font-semibold mt-2">
          {leftName} <span className="text-white/35 font-normal">vs</span> {rightName}
        </p>
      </div>

      <div className="p-5 space-y-6">
        {actionError ? <FormError message={actionError} /> : null}

        {/* Hold — frees court for another match */}
        <section>
          <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">
            Hold (free court)
          </h3>
          {isOnHold ? (
            <BtnPrimary
              disabled={busy}
              onClick={() => runAction(() => director.unhold())}
              className="w-full"
            >
              Resume from Hold
            </BtnPrimary>
          ) : (
            <BtnPrimary
              disabled={busy || (!isLive && state.matchStatus !== "scheduled")}
              onClick={() =>
                runAction(() => director.hold("Court freed for another match"))
              }
              className="w-full bg-sky-700 hover:bg-sky-600"
            >
              Put on Hold
            </BtnPrimary>
          )}
          <p className="text-white/35 text-xs mt-2">
            Use Hold when toss/start already happened but another match must use this court.
          </p>
        </section>

        {/* Pause / Resume */}
        <section>
          <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">
            Pause / Resume
          </h3>
          {isPaused && !isOnHold ? (
            <BtnPrimary
              disabled={busy}
              onClick={() => runAction(() => director.resume())}
              className="w-full"
            >
              Resume Match
            </BtnPrimary>
          ) : isOnHold ? (
            <p className="text-sky-200/80 text-sm">Match is on Hold — use Resume from Hold above.</p>
          ) : (
            <div className="space-y-3">
              <FormField label="Pause reason" required>
                <DarkSelect
                  value={pauseReason}
                  onValueChange={(v) => setPauseReason(v as typeof pauseReason)}
                  options={[
                    { value: "medical", label: "Medical" },
                    { value: "technical_issue", label: "Technical Issue" },
                    { value: "weather", label: "Weather" },
                    { value: "court_issue", label: "Court Issue" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </FormField>
              {pauseReason === "other" ? (
                <FormField label="Detail" required>
                  <input
                    className={inputClass}
                    required
                    aria-required="true"
                    value={pauseDetail}
                    onChange={(e) => setPauseDetail(e.target.value)}
                    placeholder="Describe the issue…"
                  />
                </FormField>
              ) : null}
              <BtnPrimary
                disabled={busy || !isLive}
                onClick={() =>
                  runAction(() => director.pause(pauseReason, pauseDetail || undefined))
                }
                className="w-full bg-amber-600 hover:bg-amber-500"
              >
                Pause Match
              </BtnPrimary>
            </div>
          )}
          {isPaused && state.pauseReason ? (
            <p className="text-amber-300/80 text-sm mt-2">
              Current: {formatPauseReason(state.pauseReason, state.pauseDetail)}
            </p>
          ) : null}
        </section>

        {/* Incidents */}
        <section>
          <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">
            Match Incident Log
          </h3>
          <div className="rounded-xl bg-black/30 border border-white/8 max-h-48 overflow-y-auto">
            {incidents.length === 0 ? (
              <p className="text-white/30 text-sm p-4 text-center">No incidents yet</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {incidents.map((entry) => (
                  <li key={entry.sequence} className="px-4 py-2.5 flex gap-3 text-sm">
                    <span className="text-white/30 font-mono tabular-nums shrink-0">
                      {formatIncidentTime(entry.timestamp)}
                    </span>
                    <span className="text-white/80">{entry.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Notes */}
        <section>
          <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">
            Match Notes
          </h3>
          {state.matchNotes.length > 0 ? (
            <ul className="space-y-2 mb-3">
              {state.matchNotes.map((note) => (
                <li
                  key={note.sequence}
                  className="text-white/70 text-sm bg-white/5 rounded-lg px-3 py-2"
                >
                  {note.text}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <input
              className={cn(inputClass, "flex-1")}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              disabled={state.matchStatus === "scheduled"}
            />
            <BtnPrimary
              disabled={busy || !noteText.trim() || state.matchStatus === "scheduled"}
              onClick={() =>
                runAction(async () => {
                  await director.addNote(noteText);
                  setNoteText("");
                })
              }
            >
              Add
            </BtnPrimary>
          </div>
        </section>

        {/* Force unlock — always available while match can be scored */}
        {!isTerminal ? (
          <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-2">
            <h3 className="text-amber-100/80 text-xs font-semibold uppercase tracking-widest">
              Force Unlock Scorer
            </h3>
            <p className="text-white/40 text-[11px] leading-relaxed">
              Clears a stuck scorer session lock so another device can open this match.
            </p>
            <button
              type="button"
              disabled={unlocking}
              onClick={() => {
                setActionError("");
                setUnlocking(true);
                void forceUnlockBadmintonMatch(tournamentId, matchId)
                  .then((result) => {
                    toast({
                      title: result.cleared ? "Match unlocked" : "No lock to clear",
                      description: result.cleared
                        ? "Scorer lock cleared. Another session can open this match."
                        : "This match did not have an active scorer lock.",
                    });
                  })
                  .catch((err) => {
                    setActionError(err instanceof Error ? err.message : "Force unlock failed");
                  })
                  .finally(() => setUnlocking(false));
              }}
              className="w-full min-h-11 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/30 text-amber-50 text-xs font-bold disabled:opacity-40"
            >
              {unlocking ? "Unlocking…" : "Force Unlock"}
            </button>
          </section>
        ) : null}

        {/* Terminal actions */}
        {!isTerminal ? (
          <section className="space-y-4 pt-2 border-t border-white/8">
            <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest">
              Match Outcomes
            </h3>
            <p className="text-white/40 text-[11px] -mt-2">
              Choose the player or pair by name — not court side.
            </p>

            {needsAssignedMargin ? (
              <FormField label="Winner margin points" required>
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  aria-required="true"
                  value={marginPointsInput}
                  onChange={(e) => setMarginPointsInput(e.target.value)}
                  placeholder="e.g. 21"
                />
                <p className="text-white/35 text-[11px] mt-1">
                  Required when no games were completed. Positive integer only.
                </p>
              </FormField>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 p-3 space-y-2">
                <p className="text-white/50 text-xs font-semibold">Retirement</p>
                <DarkSelect
                  value={retireSide}
                  onValueChange={(v) => setRetireSide(v as "left" | "right")}
                  options={[
                    { value: "left", label: `${leftName} retires` },
                    { value: "right", label: `${rightName} retires` },
                  ]}
                />
                <DarkSelect
                  value={retireReason}
                  onValueChange={(v) => setRetireReason(v as typeof retireReason)}
                  options={[
                    { value: "injury", label: "Injury" },
                    { value: "illness", label: "Illness" },
                    { value: "other", label: "Other" },
                  ]}
                />
                <button
                  type="button"
                  disabled={busy || !isLive || !marginReady}
                  onClick={() => setPendingOutcome({ kind: "retirement" })}
                  className="w-full min-h-11 rounded-lg bg-destructive/80 hover:bg-destructive text-destructive-foreground text-xs font-bold disabled:opacity-40"
                >
                  Declare Retirement
                </button>
              </div>

              <div className="rounded-xl border border-white/8 p-3 space-y-2">
                <p className="text-white/50 text-xs font-semibold">Walkover</p>
                <DarkSelect
                  value={walkoverSide}
                  onValueChange={(v) => setWalkoverSide(v as "left" | "right")}
                  options={[
                    { value: "left", label: `${leftName} wins` },
                    { value: "right", label: `${rightName} wins` },
                  ]}
                />
                <DarkSelect
                  value={walkoverReason}
                  onValueChange={(v) => setWalkoverReason(v as typeof walkoverReason)}
                  options={[
                    { value: "opponent_absent", label: "Opponent Absent" },
                    { value: "forfeit", label: "Forfeit" },
                    { value: "administrative_decision", label: "Administrative Decision" },
                  ]}
                />
                <button
                  type="button"
                  disabled={busy || !marginReady}
                  onClick={() => setPendingOutcome({ kind: "walkover" })}
                  className="w-full min-h-11 rounded-lg bg-destructive/80 hover:bg-destructive text-destructive-foreground text-xs font-bold disabled:opacity-40"
                >
                  Declare Walkover
                </button>
              </div>

              <div className="rounded-xl border border-white/8 p-3 space-y-2">
                <p className="text-white/50 text-xs font-semibold">Disqualification</p>
                <DarkSelect
                  value={dqSide}
                  onValueChange={(v) => setDqSide(v as "left" | "right")}
                  options={[
                    { value: "left", label: `Disqualify ${leftName}` },
                    { value: "right", label: `Disqualify ${rightName}` },
                  ]}
                />
                <FormField label="Reason" required>
                  <input
                    className={inputClass}
                    required
                    aria-required="true"
                    value={dqReason}
                    onChange={(e) => setDqReason(e.target.value)}
                    placeholder="Reason for disqualification"
                  />
                </FormField>
                <button
                  type="button"
                  disabled={busy || !dqReason.trim() || !marginReady}
                  onClick={() => setPendingOutcome({ kind: "disqualification" })}
                  className="w-full min-h-11 rounded-lg bg-destructive/80 hover:bg-destructive text-destructive-foreground text-xs font-bold disabled:opacity-40"
                >
                  Declare Disqualification
                </button>
              </div>

              <div className="rounded-xl border border-white/8 p-3 space-y-2">
                <p className="text-white/50 text-xs font-semibold">Force End Match</p>
                <FormField label="Reason" required>
                  <input
                    className={inputClass}
                    required
                    aria-required="true"
                    value={forceEndReason}
                    onChange={(e) => setForceEndReason(e.target.value)}
                    placeholder="Reason for force end"
                  />
                </FormField>
                <button
                  type="button"
                  disabled={
                    busy || !forceEndReason.trim() || (!isLive && !isPaused) || !marginReady
                  }
                  onClick={() => setPendingOutcome({ kind: "force_end" })}
                  className="w-full min-h-11 rounded-lg bg-destructive/80 hover:bg-destructive text-destructive-foreground text-xs font-bold disabled:opacity-40"
                >
                  Force End Match
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {isTerminal && needsAssignedMargin ? (
          <section className="space-y-3 pt-2 border-t border-white/8">
            <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest">
              Winner Margin Points
            </h3>
            <p className="text-white/40 text-[11px]">
              No completed games — set or update the standings margin for the winner.
              {state.assignedMarginPoints != null
                ? ` Current: +${state.assignedMarginPoints}.`
                : ""}
            </p>
            <FormField label="Margin points" required>
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                aria-required="true"
                value={marginPointsInput}
                onChange={(e) => setMarginPointsInput(e.target.value)}
                placeholder="e.g. 21"
              />
            </FormField>
            <BtnPrimary
              disabled={busy || parsedMargin == null}
              onClick={() =>
                runAction(async () => {
                  if (parsedMargin == null) return;
                  await director.assignMarginPoints(parsedMargin);
                  toast({
                    title: "Margin points saved",
                    description: `Winner margin set to +${parsedMargin}.`,
                  });
                })
              }
            >
              Save margin points
            </BtnPrimary>
          </section>
        ) : null}

        {/* Export — PDF only */}
        <section className="pt-2 border-t border-white/8">
          <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">
            Export Match Report
          </h3>
          <a
            href={`${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}/report?format=pdf`}
            className="w-full min-h-11 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/70 text-xs font-semibold flex items-center justify-center"
            download
          >
            Download PDF
          </a>
        </section>
      </div>

      {confirmCopy ? (
        <ConfirmActionDialog
          open={pendingOutcome != null}
          onOpenChange={(open) => {
            if (!open) setPendingOutcome(null);
          }}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          busy={busy}
          error={actionError || undefined}
          onConfirm={() => runAction(confirmCopy.action)}
        />
      ) : null}
    </div>
  );
}
