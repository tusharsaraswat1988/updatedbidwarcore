/**
 * Tournament Control Center — tournament-day operations dashboard
 * Route: /tournament/:id/badminton/control
 *
 * Answers: "What is happening right now?"
 * Orchestrates Scheduling → Matches → Scoring. Does not own new data.
 */

import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Copy, LayoutDashboard, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import {
  badmintonMatchControlPath,
  badmintonResultsPath,
  badmintonUmpireScorerPath,
} from "@/lib/badminton-routes";
import {
  badmintonQrImageUrl,
  badmintonScorerHomePublicUrl,
} from "@/lib/badminton-broadcast-urls";
import {
  buildCourtBoard,
  fixtureSlotLabel,
  isDelayedFixture,
  isDelayedMatch,
  listReadyMatches,
  listRecentlyCompleted,
  listUpcomingFixtures,
  matchDisplayLabel,
  type ControlFixture,
  type ControlMatch,
  type CourtOpsStatus,
} from "@/lib/badminton-control-center";
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { useToast } from "@/hooks/use-toast";
import {
  EmptyState,
  HubPageShell,
  PageHeader,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CourtRow = {
  id: number;
  name: string;
  shortName?: string | null;
  sortOrder: number;
};

type CategoryRow = {
  id: number;
  name: string;
  code?: string | null;
};

function courtLabel(c: { name: string; shortName?: string | null }): string {
  return c.shortName?.trim() || c.name;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusStyles(status: CourtOpsStatus): string {
  switch (status) {
    case "LIVE":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "DELAYED":
      return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    case "READY":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "FINISHED":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-white/8 text-white/50 border-white/10";
  }
}

export default function BadmintonControlCenterPage() {
  const [, params] = useRoute("/tournament/:id/badminton/control");
  const tournamentId = parseInt(params?.id ?? "0");

  const {
    data: courts = [],
    isLoading: courtsLoading,
    isError: courtsError,
    error: courtsErr,
    refetch: refetchCourts,
  } = useQuery<CourtRow[]>({
    queryKey: ["badminton-courts", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/courts`),
    enabled: !!tournamentId,
  });

  const {
    data: matches = [],
    isLoading: matchesLoading,
    isError: matchesError,
    error: matchesErr,
    refetch: refetchMatches,
  } = useQuery<ControlMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
    refetchInterval: 8_000,
  });

  const {
    data: fixtures = [],
    isLoading: fixturesLoading,
    isError: fixturesError,
    error: fixturesErr,
    refetch: refetchFixtures,
  } = useQuery<ControlFixture[]>({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixtures`),
    enabled: !!tournamentId,
    refetchInterval: 15_000,
  });

  const { data: categories = [] } = useQuery<CategoryRow[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

  const categoryName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categories) {
      map.set(c.id, c.code?.trim() || c.name);
    }
    return map;
  }, [categories]);

  const board = useMemo(
    () => buildCourtBoard(courts, matches, fixtures),
    [courts, matches, fixtures],
  );

  const upcoming = useMemo(() => listUpcomingFixtures(fixtures), [fixtures]);
  const ready = useMemo(() => listReadyMatches(matches), [matches]);
  const recent = useMemo(() => listRecentlyCompleted(matches), [matches]);

  const isLoading = courtsLoading || matchesLoading || fixturesLoading;
  const loadError = courtsError || matchesError || fixturesError;
  const loadErrorObj = courtsErr ?? matchesErr ?? fixturesErr;

  const liveCount = board.filter((r) => r.status === "LIVE").length;
  const readyCount = board.filter((r) => r.status === "READY").length;
  const delayedCount = board.filter((r) => r.status === "DELAYED").length;
  const emptyCount = board.filter((r) => r.status === "EMPTY").length;
  const finishedCount = board.filter((r) => r.status === "FINISHED").length;
  const nextReady = ready[0] ?? null;

  function retryAll() {
    void refetchCourts();
    void refetchMatches();
    void refetchFixtures();
  }

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Control Center"
        subtitle="Live · Ready · Delayed · Empty — run the day from here"
        badge={liveCount > 0 ? `${liveCount} Live` : delayedCount > 0 ? `${delayedCount} Delayed` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {nextReady ? (
              <a
                href={badmintonMatchControlPath(tournamentId, nextReady.id)}
                className="min-h-11 px-3 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-100 text-xs font-bold inline-flex items-center"
              >
                Start next
              </a>
            ) : null}
            <Link
              href={`/tournament/${tournamentId}/badminton/schedule`}
              className="min-h-11 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/75 text-xs font-semibold inline-flex items-center"
            >
              Scheduling
            </Link>
            <Link
              href={badmintonResultsPath(tournamentId)}
              className="min-h-11 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 text-xs font-semibold inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Results
            </Link>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading courts">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState
            icon={AlertCircle}
            title="Could not load Control Center"
            desc={friendlyBadmintonError(loadErrorObj, "Check your connection, then retry.")}
            action={{ label: "Retry", onClick: () => retryAll() }}
          />
        ) : courts.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="No courts yet"
            desc="Add courts first. Then schedule fixtures and create matches — Control Center runs the tournament day from here."
            action={{
              label: "Set up courts",
              href: `/tournament/${tournamentId}/badminton/courts`,
            }}
          />
        ) : (
          <section className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <StatusKpi label="Live" value={liveCount} tone="live" />
              <StatusKpi label="Ready" value={readyCount} tone="ready" />
              <StatusKpi label="Delayed" value={delayedCount} tone="delayed" />
              <StatusKpi label="Empty" value={emptyCount} tone="empty" />
              <StatusKpi label="Finished" value={finishedCount} tone="finished" />
            </div>
            <h2 className="text-white/55 text-xs font-bold uppercase tracking-widest">
              Courts
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {board.map((row) => (
                <CourtOpsCard
                  key={row.court.id}
                  tournamentId={tournamentId}
                  row={row}
                  categoryName={categoryName}
                />
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <BottomList
            title="Upcoming Fixtures"
            empty="No scheduled fixtures waiting for a match."
            count={Math.min(upcoming.length, 10)}
          >
            {upcoming.slice(0, 10).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/6 last:border-0">
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
                  className="min-h-11 px-2 text-[#4fc3f7] text-xs font-semibold hover:underline flex-none inline-flex items-center"
                >
                  Create Match
                </Link>
              </li>
            ))}
          </BottomList>

          <BottomList
            title="Ready Matches"
            empty="No matches waiting to start."
            count={Math.min(ready.length, 10)}
          >
            {ready.slice(0, 10).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/6 last:border-0">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate flex items-center gap-2">
                    {matchDisplayLabel(m)}
                    {isDelayedMatch(m) ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-orange-300 border border-orange-500/40 rounded px-1.5 py-0.5 flex-none">
                        Delayed
                      </span>
                    ) : null}
                  </p>
                  <p className="text-white/35 text-xs">
                    {typeof m.detail?.courtNumber === "string" || typeof m.detail?.courtNumber === "number"
                      ? `Court ${m.detail.courtNumber}`
                      : typeof m.detail?.courtId === "number"
                        ? `Court #${m.detail.courtId}`
                        : "No court"}
                    {m.scheduledAt ? ` · ${formatTime(m.scheduledAt)}` : ""}
                  </p>
                </div>
                <a
                  href={badmintonMatchControlPath(tournamentId, m.id)}
                  className="min-h-11 px-2 text-amber-300 text-xs font-semibold hover:underline flex-none inline-flex items-center"
                >
                  Match Control
                </a>
              </li>
            ))}
          </BottomList>

          <BottomList
            title="Recently Completed"
            empty="No completed matches yet."
            count={recent.length}
          >
            {recent.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/6 last:border-0">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {matchDisplayLabel(m)}
                  </p>
                  <p className="text-white/35 text-xs">
                    {m.state
                      ? `${m.state.leftScore ?? 0}–${m.state.rightScore ?? 0}`
                      : "Completed"}
                    {m.detail?.courtNumber != null ? ` · Court ${String(m.detail.courtNumber)}` : ""}
                  </p>
                </div>
                <a
                  href={badmintonMatchControlPath(tournamentId, m.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 text-xs font-semibold hover:text-white/70 flex-none"
                >
                  View
                </a>
              </li>
            ))}
          </BottomList>
        </div>
      </div>
    </HubPageShell>
  );
}

function BottomList({
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
    <section className={cn(hubCardClass, "p-5")}>
      <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
        {title}
      </h2>
      {count === 0 ? (
        <p className="text-white/30 text-sm">{empty}</p>
      ) : (
        <ul className="space-y-0">{children}</ul>
      )}
    </section>
  );
}

function CourtOpsCard({
  tournamentId,
  row,
  categoryName,
}: {
  tournamentId: number;
  row: ReturnType<typeof buildCourtBoard>[number];
  categoryName: Map<number, string>;
}) {
  const { toast } = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const { court, status, currentMatch, nextMatch, nextFixture, readyOverflow } = row;
  const nextLabel = nextMatch
    ? matchDisplayLabel(nextMatch)
    : nextFixture
      ? fixtureSlotLabel(nextFixture, categoryName.get(nextFixture.categoryId))
      : "—";
  const hasScorerPin = !!(court.hasScorerPin || (court.scorerPin && court.scorerPin.trim()));
  const scorerHomeUrl = badmintonScorerHomePublicUrl(tournamentId);

  return (
    <div
      className={cn(
        hubCardClass,
        "p-5 space-y-4",
        status === "LIVE" && "border-red-500/35",
        status === "DELAYED" && "border-orange-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-bold text-lg">{courtLabel(court)}</h3>
          <p className="text-white/35 text-xs mt-0.5">{court.name}</p>
        </div>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border",
            statusStyles(status),
          )}
        >
          {status}
        </span>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-1">
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Scorer</p>
        {hasScorerPin ? (
          <>
            <p className="text-white text-sm font-semibold">
              {court.scorerName?.trim() || "Scorer assigned"}
            </p>
            <p className="text-sky-300/90 text-xs font-mono">
              PIN configured{court.scorerPin ? ` · ${court.scorerPin}` : ""}
            </p>
          </>
        ) : (
          <p className="text-white/40 text-sm">No court PIN — set in Courts</p>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(scorerHomeUrl).then(() => {
                toast({
                  title: "Scorer Home copied",
                  description: hasScorerPin
                    ? "Share with the court umpire along with the PIN."
                    : "Set a court PIN in Courts, then share this link.",
                });
              });
            }}
            className="min-h-10 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Scorer Home
          </button>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/80 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5" />
            Show QR
          </button>
        </div>
      </div>

      {readyOverflow > 0 ? (
        <p className="text-orange-200/90 text-xs rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
          {readyOverflow + 1} ready matches on this court — start the earliest first.
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">
            {status === "FINISHED" ? "Last match" : "Current"}
          </p>
          <p className="text-white font-medium truncate">
            {currentMatch ? matchDisplayLabel(currentMatch) : "—"}
          </p>
          {currentMatch?.state && status === "LIVE" ? (
            <p className="text-white/55 text-xs tabular-nums mt-0.5">
              {currentMatch.state.leftScore ?? 0}–{currentMatch.state.rightScore ?? 0}
              {currentMatch.state.currentGame != null
                ? ` · G${currentMatch.state.currentGame}`
                : ""}
            </p>
          ) : null}
          {status === "DELAYED" && currentMatch?.scheduledAt ? (
            <p className="text-orange-300/80 text-xs mt-0.5">
              Was due {formatTime(currentMatch.scheduledAt)}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">
            Next
          </p>
          <p className="text-white/85 font-medium truncate">{nextLabel}</p>
          {(nextMatch?.scheduledAt || nextFixture?.scheduledAt) && (
            <p className="text-white/40 text-xs mt-0.5">
              {formatTime(nextMatch?.scheduledAt ?? nextFixture?.scheduledAt)}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {status === "EMPTY" ? (
          <>
            {nextFixture ? (
              <Link
                href={`/tournament/${tournamentId}/badminton/matches?fixture=${nextFixture.id}`}
                className="min-h-11 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold inline-flex items-center"
              >
                Create next match
              </Link>
            ) : (
              <Link
                href={`/tournament/${tournamentId}/badminton/schedule`}
                className="min-h-11 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold inline-flex items-center"
              >
                Schedule next fixture
              </Link>
            )}
          </>
        ) : null}

        {(status === "READY" || status === "DELAYED") && currentMatch ? (
          <a
            href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
            className={cn(
              "min-h-11 px-4 rounded-lg text-sm font-bold inline-flex items-center",
              status === "DELAYED"
                ? "bg-orange-500/30 hover:bg-orange-500/40 text-orange-50"
                : "bg-amber-500/25 hover:bg-amber-500/35 text-amber-100",
            )}
          >
            {status === "DELAYED" ? "Start (delayed)" : "Start Match"}
          </a>
        ) : null}

        {status === "LIVE" && currentMatch ? (
          <a
            href={badmintonUmpireScorerPath(currentMatch.id, tournamentId)}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 px-4 rounded-lg bg-red-500/25 hover:bg-red-500/35 text-red-200 text-sm font-bold inline-flex items-center"
          >
            Open Scoring
          </a>
        ) : null}

        {status === "FINISHED" && currentMatch ? (
          <>
            <a
              href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
              className="min-h-11 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold inline-flex items-center"
            >
              View match
            </a>
            {nextFixture ? (
              <Link
                href={`/tournament/${tournamentId}/badminton/matches?fixture=${nextFixture.id}`}
                className="min-h-11 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/80 text-xs font-semibold inline-flex items-center"
              >
                Assign next
              </Link>
            ) : (
              <Link
                href={`/tournament/${tournamentId}/badminton/schedule`}
                className="min-h-11 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/80 text-xs font-semibold inline-flex items-center"
              >
                Schedule next
              </Link>
            )}
          </>
        ) : null}
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Scorer Home · {court.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={badmintonQrImageUrl(scorerHomeUrl)}
              alt={`QR for Scorer Home — ${court.name}`}
              className="rounded-lg border border-border"
              width={240}
              height={240}
            />
            <p className="text-xs text-muted-foreground text-center">
              Scan to open Scorer Home. Court PIN still required.
            </p>
            <p className="text-[10px] text-muted-foreground/80 break-all text-center font-mono">
              {scorerHomeUrl}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "live" | "ready" | "delayed" | "empty" | "finished";
}) {
  const toneClass =
    tone === "live"
      ? "border-red-500/35 bg-red-500/10 text-red-300"
      : tone === "ready"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
        : tone === "delayed"
          ? "border-orange-500/40 bg-orange-500/15 text-orange-200"
          : tone === "finished"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-white/15 bg-white/5 text-white/60";
  return (
    <div className={cn("rounded-xl border px-3 py-2.5 text-center min-h-11", toneClass)}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}
