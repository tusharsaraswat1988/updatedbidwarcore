/**
 * Mission Control queues — Ready strip (above courts) + secondary Upcoming/Recent.
 */

import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";
import {
  fixtureSlotLabel,
  isDelayedFixture,
  isDelayedMatch,
  matchDisplayLabel,
  type ControlCourt,
  type ControlFixture,
  type ControlMatch,
} from "@/lib/badminton-control-center";
import { TeamPlayerVs } from "@/components/badminton/team-player-card";
import {
  identityForPreStartMatchSide,
  identityFromLooseSide,
} from "@/lib/team-player-identity";
import { displayMatchSideScores } from "@/lib/badminton-results";
import { hubCardClass } from "@/components/badminton/page-chrome";
import { useToast } from "@/hooks/use-toast";

function courtLabel(c: { name: string; shortName?: string | null }): string {
  return c.shortName?.trim() || c.name;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Compact ready-to-start strip — place above the court grid. */
export function MissionControlReadyStrip({
  tournamentId,
  courts,
  ready,
  moveTargetCourtIds,
}: {
  tournamentId: number;
  courts: ControlCourt[];
  ready: ControlMatch[];
  moveTargetCourtIds: number[];
}) {
  const moveTargets = courts.filter((c) => moveTargetCourtIds.includes(c.id));
  const rows = ready.slice(0, 8);

  if (rows.length === 0) return null;

  return (
    <section
      className={cn(hubCardClass, "p-3 space-y-2 border-amber-500/25 bg-amber-500/5")}
      aria-label="Ready to start"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-amber-200/90 text-xs font-bold uppercase tracking-widest">
          Ready to start · {ready.length}
        </h2>
      </div>
      <ul className="space-y-0 divide-y divide-white/8">
        {rows.map((m) => (
          <ReadyRow
            key={m.id}
            tournamentId={tournamentId}
            match={m}
            courts={moveTargets}
            compact
          />
        ))}
      </ul>
    </section>
  );
}

/** Secondary queues — Upcoming + Recently finished (below courts). */
export function MissionControlQueues({
  tournamentId,
  courts,
  upcoming,
  recent,
  categoryName,
}: {
  tournamentId: number;
  courts: ControlCourt[];
  upcoming: ControlFixture[];
  recent: ControlMatch[];
  categoryName: Map<number, string>;
  /** @deprecated Ready moved to MissionControlReadyStrip — accepted for call-site compat. */
  ready?: ControlMatch[];
  /** @deprecated Ready moved to MissionControlReadyStrip — accepted for call-site compat. */
  moveTargetCourtIds?: number[];
}) {
  return (
    <section className="space-y-2" aria-label="Schedule queues">
      <h2 className="text-white/55 text-xs font-bold uppercase tracking-widest">Schedule</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QueuePanel
          title="Upcoming"
          empty="No upcoming fixtures. Finish Schedule if the board is empty."
          count={Math.min(upcoming.length, 12)}
        >
          {upcoming.slice(0, 12).map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 py-2.5 border-b border-white/6 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate flex items-center gap-2">
                  {fixtureSlotLabel(f, categoryName.get(f.categoryId))}
                  {isDelayedFixture(f) ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-orange-300 border border-orange-500/40 rounded px-1.5 py-0.5 flex-none">
                      Delayed
                    </span>
                  ) : null}
                </p>
                <p className="text-white/35 text-xs">
                  {formatTime(f.scheduledAt)}
                  {f.courtId
                    ? ` · ${courtLabel(courts.find((c) => c.id === f.courtId) ?? { name: `Court ${f.courtId}` })}`
                    : ""}
                </p>
              </div>
              <Link
                href={`/tournament/${tournamentId}/badminton/matches?fixture=${f.id}`}
                className="min-h-10 px-2 text-[#4fc3f7] text-xs font-semibold hover:underline flex-none inline-flex items-center"
              >
                Assign
              </Link>
            </li>
          ))}
        </QueuePanel>

        <QueuePanel title="Recently finished" empty="No completed matches yet." count={recent.length}>
          {recent.slice(0, 10).map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 py-2.5 border-b border-white/6 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-primary/90 text-[11px] font-mono font-bold mb-0.5">
                  {matchDisplayLabel(m).split(" · ")[0]}
                </p>
                {m.state?.leftSide || m.state?.rightSide ? (
                  <TeamPlayerVs
                    left={identityForPreStartMatchSide(
                      m.state?.leftSide,
                      (m.detail?.leftSideJson as Record<string, unknown> | undefined) ??
                        null,
                    )}
                    right={identityForPreStartMatchSide(
                      m.state?.rightSide,
                      (m.detail?.rightSideJson as Record<string, unknown> | undefined) ??
                        null,
                    )}
                    size="xs"
                    layout="inline"
                    className="items-start"
                  />
                ) : (
                  <p className="text-white text-sm font-medium truncate">{matchDisplayLabel(m)}</p>
                )}
                <p className="text-white/35 text-xs">
                  {m.state
                    ? (() => {
                        const scores = displayMatchSideScores(m.state);
                        const hasGames =
                          (m.state.gamesLeft ?? 0) > 0 || (m.state.gamesRight ?? 0) > 0;
                        return hasGames
                          ? `${m.state.gamesLeft}–${m.state.gamesRight} games`
                          : `${scores.left}–${scores.right}`;
                      })()
                    : "Completed"}
                  {m.detail?.courtNumber != null
                    ? ` · Court ${String(m.detail.courtNumber)}`
                    : ""}
                </p>
              </div>
              <a
                href={badmintonMatchControlPath(tournamentId, m.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 text-xs font-semibold hover:text-white/80 flex-none"
              >
                Quick view
              </a>
            </li>
          ))}
        </QueuePanel>
      </div>
    </section>
  );
}

function ReadyRow({
  tournamentId,
  match,
  courts,
  compact,
}: {
  tournamentId: number;
  match: ControlMatch;
  courts: ControlCourt[];
  compact?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentCourtId =
    typeof match.detail?.courtId === "number" ? match.detail.courtId : null;
  const moveMutation = useMutation({
    mutationFn: (courtId: number) => {
      const court = courts.find((c) => c.id === courtId);
      return badmintonFetch(tournamentId, `/matches/${match.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          courtId,
          courtNumber: court?.shortName?.trim() || court?.name || String(courtId),
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      toast({ title: "Match moved to court" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not move match", description: e.message, variant: "destructive" });
    },
  });

  const otherCourts = courts.filter((c) => c.id !== currentCourtId);

  return (
    <li className={cn(compact ? "py-2" : "py-2.5", "border-b border-white/6 last:border-0 space-y-1.5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-primary/90 text-[11px] font-mono font-bold mb-0.5">
            {matchDisplayLabel(match).split(" · ")[0]}
          </p>
          {match.state?.leftSide || match.state?.rightSide ? (
            <TeamPlayerVs
              left={identityFromLooseSide(match.state?.leftSide)}
              right={identityFromLooseSide(match.state?.rightSide)}
              size="xs"
              layout="inline"
              className="items-start"
            />
          ) : (
            <p className="text-white text-sm font-medium truncate">{matchDisplayLabel(match)}</p>
          )}
          {isDelayedMatch(match) ? (
            <span className="text-[9px] font-bold uppercase tracking-wider text-orange-300 border border-orange-500/40 rounded px-1.5 py-0.5 inline-block mt-1">
              Delayed
            </span>
          ) : null}
          <p className="text-white/35 text-xs mt-0.5">
            {typeof match.detail?.courtNumber === "string" ||
            typeof match.detail?.courtNumber === "number"
              ? `Court ${match.detail.courtNumber}`
              : typeof match.detail?.courtId === "number"
                ? `Court #${match.detail.courtId}`
                : "No court"}
            {match.scheduledAt ? ` · ${formatTime(match.scheduledAt)}` : ""}
          </p>
        </div>
        <a
          href={badmintonMatchControlPath(tournamentId, match.id)}
          className="min-h-9 px-3 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 text-amber-50 text-xs font-bold flex-none inline-flex items-center"
          title="Toss & start in Match Control"
        >
          Start
        </a>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {otherCourts.slice(0, 3).map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={moveMutation.isPending}
            onClick={() => moveMutation.mutate(c.id)}
            className="min-h-8 px-2 rounded-md bg-white/8 hover:bg-white/12 text-white/75 text-[11px] font-semibold disabled:opacity-50"
          >
            Move → {courtLabel(c)}
          </button>
        ))}
        <Link
          href={`/tournament/${tournamentId}/badminton/schedule`}
          className="min-h-8 px-2 rounded-md bg-white/8 hover:bg-white/12 text-white/60 text-[11px] font-semibold inline-flex items-center"
        >
          Delay / retime
        </Link>
      </div>
    </li>
  );
}

function QueuePanel({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(hubCardClass, "p-3 sm:p-4")}>
      <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2">{title}</h3>
      {count === 0 ? (
        <p className="text-white/30 text-sm">{empty}</p>
      ) : (
        // Cap secondary queue height in document flow (not a sticky nested scroller).
        <ul className="space-y-0 max-h-64 overflow-y-auto overscroll-y-contain pr-0.5">
          {children}
        </ul>
      )}
    </section>
  );
}
