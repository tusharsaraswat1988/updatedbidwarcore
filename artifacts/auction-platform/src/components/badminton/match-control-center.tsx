/**
 * Match Control Center — Tournament Director administration panel.
 * Scoring remains umpire-controlled; this panel handles match administration.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BadmintonMatchState, IncidentLogEntry } from "@workspace/badminton-core";
import { formatPauseReason } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";
import { BtnPrimary, DarkSelect, FormError, FormField, inputClass } from "@/components/badminton/page-chrome";
import { useBadmintonDirector } from "@/hooks/use-badminton-match";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Props = {
  tournamentId: number;
  matchId: number;
  state: BadmintonMatchState;
};

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

export function MatchControlCenter({ tournamentId, matchId, state }: Props) {
  const director = useBadmintonDirector(tournamentId, matchId);
  const [noteText, setNoteText] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

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

  const { data: incidentData } = useQuery<{ incidents: IncidentLogEntry[] }>({
    queryKey: ["badminton-incidents", tournamentId, matchId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}/incidents`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load incidents");
      return res.json();
    },
    enabled: !!tournamentId && !!matchId,
    refetchInterval: 5000,
  });

  const incidents = incidentData?.incidents ?? [];
  const isLive = state.matchStatus === "live";
  const isPaused = state.matchStatus === "paused" || state.isPaused;
  const isTerminal = ["completed", "walkover", "retired", "disqualified", "abandoned"].includes(
    state.matchStatus,
  );

  async function runAction(action: () => Promise<unknown>) {
    setActionError("");
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-primary/10">
        <h2 className="text-white font-black text-lg tracking-wide uppercase">
          Match Control Center
        </h2>
        <p className="text-white/40 text-xs mt-0.5">
          Tournament Director — match administration only
        </p>
      </div>

      <div className="p-5 space-y-6">
        {actionError ? <FormError message={actionError} /> : null}

        {/* Pause / Resume */}
        <section>
          <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">
            Pause / Resume
          </h3>
          {isPaused ? (
            <BtnPrimary
              disabled={busy}
              onClick={() => runAction(() => director.resume())}
              className="w-full"
            >
              Resume Match
            </BtnPrimary>
          ) : (
            <div className="space-y-3">
              <FormField label="Pause reason">
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
                <FormField label="Detail">
                  <input
                    className={inputClass}
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

        {/* Terminal actions */}
        {!isTerminal ? (
          <section className="space-y-4 pt-2 border-t border-white/8">
            <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest">
              Match Outcomes
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 p-3 space-y-2">
                <p className="text-white/50 text-xs font-semibold">Retirement</p>
                <DarkSelect
                  value={retireSide}
                  onValueChange={(v) => setRetireSide(v as "left" | "right")}
                  options={[
                    { value: "left", label: "Left retires" },
                    { value: "right", label: "Right retires" },
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
                  disabled={busy || !isLive}
                  onClick={() => runAction(() => director.retirement(retireSide, retireReason))}
                  className="w-full min-h-11 rounded-lg bg-orange-600/80 hover:bg-orange-600 text-white text-xs font-bold disabled:opacity-40"
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
                    { value: "left", label: "Left wins" },
                    { value: "right", label: "Right wins" },
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
                  disabled={busy}
                  onClick={() => runAction(() => director.walkover(walkoverSide, walkoverReason))}
                  className="w-full min-h-11 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-bold disabled:opacity-40"
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
                    { value: "left", label: "Left disqualified" },
                    { value: "right", label: "Right disqualified" },
                  ]}
                />
                <input
                  className={inputClass}
                  value={dqReason}
                  onChange={(e) => setDqReason(e.target.value)}
                  placeholder="Reason (required)"
                />
                <button
                  type="button"
                  disabled={busy || !dqReason.trim()}
                  onClick={() => runAction(() => director.disqualification(dqSide, dqReason))}
                  className="w-full min-h-11 rounded-lg bg-red-700/80 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40"
                >
                  Declare Disqualification
                </button>
              </div>

              <div className="rounded-xl border border-white/8 p-3 space-y-2">
                <p className="text-white/50 text-xs font-semibold">Force End Match</p>
                <input
                  className={inputClass}
                  value={forceEndReason}
                  onChange={(e) => setForceEndReason(e.target.value)}
                  placeholder="Reason (required)"
                />
                <button
                  type="button"
                  disabled={busy || !forceEndReason.trim() || (!isLive && !isPaused)}
                  onClick={() => runAction(() => director.forceEnd(forceEndReason))}
                  className="w-full min-h-11 rounded-lg bg-slate-600/80 hover:bg-slate-600 text-white text-xs font-bold disabled:opacity-40"
                >
                  Force End Match
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Export */}
        <section className="pt-2 border-t border-white/8">
          <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">
            Export Match Report
          </h3>
          <div className="flex gap-2">
            <a
              href={`${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}/report?format=json`}
              className="flex-1 min-h-11 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/70 text-xs font-semibold flex items-center justify-center"
              download
            >
              Download JSON
            </a>
            <a
              href={`${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}/report?format=pdf`}
              className="flex-1 min-h-11 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/70 text-xs font-semibold flex items-center justify-center"
              download
            >
              Download PDF
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
