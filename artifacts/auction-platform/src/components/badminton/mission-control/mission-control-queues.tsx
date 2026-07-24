/**
 * Mission Control bottom queues — Ready / Upcoming / Recently finished.
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
import { identityFromLooseSide } from "@/lib/team-player-identity";
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

export function MissionControlQueues({
  tournamentId,
  courts,
  upcoming,
  ready,
  recent,
  categoryName,
  moveTargetCourtIds,
}: {
  tournamentId: number;
  courts: ControlCourt[];
  upcoming: ControlFixture[];
  ready: ControlMatch[];
  recent: ControlMatch[];
  categoryName: Map<number, string>;
  /** Courts that can take a waiting match (empty / delayed / finished). */
  moveTargetCourtIds: number[];
}) {
  const moveTargets = courts.filter((c) => moveTargetCourtIds.includes(c.id));

  return (
    <section className="space-y-3" aria-label="Match queues">
      <div>
        <h2 className="text-white/55 text-xs font-bold uppercase tracking-widest">Queues</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ready to start, waiting to assign, and last finishes — operate without leaving.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <QueuePanel title="Ready matches" empty="No matches waiting to start." count={Math.min(ready.length, 12)}>
          {ready.slice(0, 12).map((m) => (
            <ReadyRow
              key={m.id}
              tournamentId={tournamentId}
              match={m}
              courts={moveTargets}
            />
          ))}
        </QueuePanel>

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
                {m.state?.leftSide || m.state?.rightSide ? (
                  <TeamPlayerVs
                    left={identityFromLooseSide(m.state?.leftSide)}
                    right={identityFromLooseSide(m.state?.rightSide)}
                    size="xs"
                    layout="inline"
                    className="items-start"
                  />
                ) : (
                  <p className="text-white text-sm font-medium truncate">{matchDisplayLabel(m)}</p>
                )}
                <p className="text-white/35 text-xs">
                  {m.state ? `${m.state.leftScore ?? 0}–${m.state.rightScore ?? 0}` : "Completed"}
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
}: {
  tournamentId: number;
  match: ControlMatch;
  courts: ControlCourt[];
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
    <li className="py-2.5 border-b border-white/6 last:border-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
          className="min-h-10 px-2 text-amber-300 text-xs font-bold hover:underline flex-none inline-flex items-center"
        >
          Start
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        {otherCourts.slice(0, 3).map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={moveMutation.isPending}
            onClick={() => moveMutation.mutate(c.id)}
            className="min-h-9 px-2.5 rounded-md bg-white/8 hover:bg-white/12 text-white/75 text-[11px] font-semibold disabled:opacity-50"
          >
            Move → {courtLabel(c)}
          </button>
        ))}
        <Link
          href={`/tournament/${tournamentId}/badminton/schedule`}
          className="min-h-9 px-2.5 rounded-md bg-white/8 hover:bg-white/12 text-white/60 text-[11px] font-semibold inline-flex items-center"
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
    <section className={cn(hubCardClass, "p-4")}>
      <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">{title}</h3>
      {count === 0 ? (
        <p className="text-white/30 text-sm">{empty}</p>
      ) : (
        <ul className="space-y-0">{children}</ul>
      )}
    </section>
  );
}
