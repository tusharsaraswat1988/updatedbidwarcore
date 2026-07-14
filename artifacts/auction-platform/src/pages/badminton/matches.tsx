/**
 * Badminton Matches Management
 * Route: /tournament/:id/badminton/matches
 */

import { useEffect, useMemo, useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { Target, X, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  isPairMatchKind,
  mergeDoublesSideJson,
  parseBadmintonMatchFormat,
} from "@workspace/badminton-core";
import {
  PairSidePicker,
  emptySidePlayer,
  sidePlayerFormToJson,
  sideJsonToPlayerForm,
  type SidePlayerForm,
} from "@/components/badminton/pair-side-picker";
import { CourtAutocomplete } from "@/components/badminton/court-autocomplete";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";
import {
  formatTeamPlayerVsLine,
  identityFromSideInfo,
} from "@/lib/team-player-identity";
import {
  BtnPrimary,
  DarkSelect,
  FormActions,
  FormError,
  FormField,
  FormModal,
  HubPageShell,
  inputClass,
  PageHeader,
  EmptyState,
  HubFilterTabs,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import { badmintonBroadcastPath } from "@/lib/badminton-broadcast-urls";
import { friendlyBadmintonError, toastError, toastSuccess } from "@/lib/badminton-ux";
import { badmintonMatchControlPath, badmintonScorerHomePath, badmintonUmpireScorerPath } from "@/lib/badminton-routes";
import { scoringAppPublicUrl } from "@workspace/api-base/scoring-urls";
import { suggestScorerPin } from "@/lib/badminton-scorer-pin";
import { badmintonFetch } from "@/lib/badminton-api";
import { matchFormatChipLabel } from "@/lib/match-format-display";
import { useBadmintonScoringFormat } from "@/hooks/use-badminton-scoring-format";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import {
  emptyMatchFormToss,
  matchFormTossFromDetail,
  matchFormTossToPayload,
  MatchFormTossFields,
} from "@/components/badminton/match-form-toss-fields";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface MatchRow {
  id: number;
  status: string;
  scheduledAt: string | null;
  detail: Record<string, unknown> | null;
  state: BadmintonMatchState | null;
}

interface FixtureOption {
  id: number;
  categoryId: number;
  slotNumber?: number | null;
  registrationAId?: number | null;
  registrationBId?: number | null;
  scoringMatchId?: number | null;
  status: string;
  courtId?: number | null;
  scheduledAt?: string | null;
}

interface CategoryOption {
  id: number;
  name: string;
  matchType: string;
}

interface BadmintonPlayerRecord {
  id: number;
  masterPlayerId?: string | null;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  shortName?: string | null;
  photoUrl?: string | null;
  flagUrl?: string | null;
}

interface RegistrationRecord {
  registration: {
    id: number;
    player1Id: number;
    player2Id?: number | null;
    status: string;
  };
  player1: BadmintonPlayerRecord | null;
}

function formatPlayerName(p: BadmintonPlayerRecord) {
  return p.displayName?.trim() || `${p.firstName} ${p.lastName}`.trim();
}

function playerToSideForm(p: BadmintonPlayerRecord): SidePlayerForm {
  const name = formatPlayerName(p);
  return {
    masterId: p.masterPlayerId ?? null,
    name,
    short: p.shortName?.trim() || name.slice(0, 2).toUpperCase(),
    photoUrl: p.photoUrl ?? "",
    franchiseLogo: p.flagUrl ?? "",
    playerIds: [p.id],
  };
}

function registrationSidePlayers(
  reg: RegistrationRecord["registration"],
  playersById: Map<number, BadmintonPlayerRecord>,
  isPair: boolean,
): { player1: SidePlayerForm; player2: SidePlayerForm } {
  const p1 = playersById.get(reg.player1Id);
  const p2 = reg.player2Id ? playersById.get(reg.player2Id) : undefined;
  return {
    player1: p1 ? playerToSideForm(p1) : emptySidePlayer(),
    player2: isPair && p2 ? playerToSideForm(p2) : emptySidePlayer(),
  };
}

export default function BadmintonMatchesPage() {
  const [, params] = useRoute("/tournament/:id/badminton/matches");
  const search = useSearch();
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();
  const { toast } = useToast();
  const initialFixtureId = useMemo(() => {
    const raw = new URLSearchParams(search).get("fixture");
    if (!raw) return undefined;
    const id = parseInt(raw, 10);
    return Number.isFinite(id) ? id : undefined;
  }, [search]);
  const [showCreate, setShowCreate] = useState(!!initialFixtureId);
  const [filter, setFilter] = useState<"all" | "live" | "scheduled" | "completed">("all");
  const { data: scoringFormat } = useBadmintonScoringFormat(tournamentId);

  const { data: matches = [], isLoading } = useQuery<MatchRow[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches`,
        { credentials: "include" },
      );
      return res.json();
    },
    enabled: !!tournamentId,
    staleTime: 8_000,
    refetchInterval: (q) => {
      const rows = q.state.data ?? [];
      return rows.some((m) => m.status === "live" || m.status === "paused") ? 8_000 : false;
    },
  });

  const filtered = matches.filter((m) => {
    if (filter === "all") return true;
    return m.status === filter;
  });

  const counts = {
    all: matches.length,
    live: matches.filter((m) => m.status === "live").length,
    scheduled: matches.filter((m) => m.status === "scheduled").length,
    completed: matches.filter((m) => m.status === "completed").length,
  };

  const deleteMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(typeof err.error === "string" ? err.error : "Delete failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
    },
  });

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Matches"
        eyebrow="Operations"
        subtitle="Create matches from scheduled fixtures — then open Match Control to start"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {scoringFormat?.configured && scoringFormat.format ? (
              <ScoringFormatBadge
                label={matchFormatChipLabel(scoringFormat.format, scoringFormat.presetId)}
              />
            ) : null}
            <button
              type="button"
              className="min-h-11 px-3 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs font-semibold hover-elevate"
              onClick={() => {
                const url = scoringAppPublicUrl(
                  window.location.origin,
                  badmintonScorerHomePath(tournamentId),
                );
                void navigator.clipboard.writeText(url).then(() => {
                  toast({
                    title: "Scorer Home copied",
                    description: "Share this link + a PIN with court umpires.",
                  });
                });
              }}
            >
              Copy Scorer Home
            </button>
            <BtnPrimary onClick={() => setShowCreate(true)}>+ Create Match</BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <HubFilterTabs
          tabs={["all", "live", "scheduled", "completed"] as const}
          active={filter}
          onChange={(tab) => setFilter(tab as typeof filter)}
          counts={counts}
          liveTab="live"
        />

        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading matches">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Target}
            title={
              filter === "all"
                ? "No matches yet"
                : filter === "live"
                  ? "No live matches"
                  : filter === "scheduled"
                    ? "No scheduled matches"
                    : "No completed matches"
            }
            desc={
              filter === "all"
                ? "Schedule fixtures first, then create a match to prepare Match Control and Live Scoring."
                : filter === "live"
                  ? "Start a match from Match Control when a court is ready."
                  : filter === "scheduled"
                    ? "Create a match from a scheduled fixture, or switch to All."
                    : "Completed matches appear here after scoring finishes."
            }
            action={
              filter === "all" || filter === "scheduled"
                ? { label: "Create Match", onClick: () => setShowCreate(true) }
                : filter === "live"
                  ? {
                      label: "Open Control Center",
                      href: `/tournament/${tournamentId}/badminton/control`,
                    }
                  : {
                      label: "View Results",
                      href: `/tournament/${tournamentId}/badminton/results`,
                    }
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                tournamentId={tournamentId}
                onDelete={() => {
                  deleteMutation.mutate(match.id, {
                    onError: (e) => toastError(e, "Could not delete match"),
                    onSuccess: () => toastSuccess("Match deleted"),
                  });
                }}
                deleting={deleteMutation.isPending && deleteMutation.variables === match.id}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <MatchFormModal
          tournamentId={tournamentId}
          initialFixtureId={initialFixtureId}
          onClose={() => setShowCreate(false)}
          onSaved={(createdId) => {
            qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
            qc.invalidateQueries({ queryKey: ["badminton-fixtures-all", tournamentId] });
            setShowCreate(false);
            if (createdId != null) {
              window.location.href = badmintonMatchControlPath(tournamentId, createdId);
            }
          }}
        />
      )}
    </HubPageShell>
  );
}

function MatchRow({
  match,
  tournamentId,
  onDelete,
  deleting,
}: {
  match: MatchRow;
  tournamentId: number;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();
  const state = match.state;
  const detail = match.detail ?? {};
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const matchLabel = state
    ? formatTeamPlayerVsLine(
        identityFromSideInfo(state.leftSide, { preferShort: true }),
        identityFromSideInfo(state.rightSide, { preferShort: true }),
      )
    : ((detail.matchLabel as string | undefined) ?? `Match #${match.id}`);

  function handleConfirmDelete() {
    onDelete();
    setConfirmOpen(false);
  }

  return (
    <div className={cn(
      hubCardClass,
      "overflow-hidden transition-colors",
      isLive && "border-red-500/30",
      !isLive && "hover:border-primary/25",
    )}>
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-none">
          {isLive ? (
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            </div>
          ) : isCompleted ? (
            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/25 flex items-center justify-center">
              <span className="text-green-400 text-sm font-bold">✓</span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
              <span className="text-muted-foreground text-xs font-mono font-bold">#{match.id}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {state ? (
            <div className="flex items-center gap-3 flex-wrap">
              <TeamPlayerCard
                identity={identityFromSideInfo(state.leftSide, { preferShort: true })}
                size="xs"
                layout="inline"
                className="min-w-0"
                playerClassName="text-foreground font-semibold text-sm"
              />
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-xl font-display font-bold tabular-nums",
                  isLive ? "text-primary" : "text-muted-foreground",
                )}>
                  {state.leftScore}
                </span>
                <span className="text-muted-foreground text-sm mx-0.5">—</span>
                <span className={cn(
                  "text-xl font-display font-bold tabular-nums",
                  isLive ? "text-red-400" : "text-muted-foreground",
                )}>
                  {state.rightScore}
                </span>
              </div>
              <TeamPlayerCard
                identity={identityFromSideInfo(state.rightSide, { preferShort: true })}
                size="xs"
                layout="inline"
                className="min-w-0"
                playerClassName="text-foreground font-semibold text-sm"
              />
              <span className="text-muted-foreground text-xs font-mono">G{state.currentGame}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-foreground font-semibold text-sm">
                {(detail.matchLabel as string | undefined) ?? `Match #${match.id}`}
              </span>
              {detail.roundName ? (
                <span className="text-muted-foreground text-xs">{String(detail.roundName)}</span>
              ) : null}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            {detail.courtNumber ? (
              <span className="text-muted-foreground text-xs font-mono">Court {String(detail.courtNumber)}</span>
            ) : null}
            {detail.matchType ? (
              <Badge variant="outline" className="text-[10px] capitalize">
                {(detail.matchType as string).replace("_", " ")}
              </Badge>
            ) : null}
            {(() => {
              const fmt =
                state?.format ?? parseBadmintonMatchFormat(detail.matchFormatJson);
              if (!fmt) return null;
              return (
                <ScoringFormatBadge
                  label={matchFormatChipLabel(fmt)}
                  className="text-[10px] py-0.5 px-2"
                />
              );
            })()}
            {detail.scorerPin ? (
              <span className="text-muted-foreground text-xs font-mono" title="Share with court umpire">
                PIN {String(detail.scorerPin)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-none">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isLive ? (
              <a
                href={badmintonUmpireScorerPath(match.id, tournamentId)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 px-4 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/35 text-red-200 text-sm font-bold flex items-center transition-colors"
                title="Court umpire — scoring with PIN"
              >
                Open Scoring
              </a>
            ) : isCompleted ? (
              <a
                href={badmintonMatchControlPath(tournamentId, match.id)}
                className="min-h-11 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-xs font-semibold flex items-center transition-all"
                title="View completed match"
              >
                View Match
              </a>
            ) : (
              <a
                href={badmintonMatchControlPath(tournamentId, match.id)}
                className="min-h-11 px-4 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/40 text-amber-100 text-sm font-bold flex items-center transition-all"
                title="Prepare match or open director controls — start from here, not the umpire scorer"
              >
                Match Control
              </a>
            )}
            {isLive ? (
              <a
                href={badmintonMatchControlPath(tournamentId, match.id)}
                className="min-h-11 px-3 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center transition-colors"
                title="Tournament director controls"
              >
                Director
              </a>
            ) : null}
            <Link
              href={badmintonBroadcastPath(tournamentId, match.id)}
              className="min-h-11 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-xs font-semibold flex items-center transition-colors"
            >
              Broadcast
            </Link>
            {!isCompleted ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="min-h-11 px-3 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Edit match details"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : null}
          </div>

          <div className="h-8 w-px bg-border/70 shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting || isLive}
            title={
              isLive
                ? "End the match before deleting"
                : "Delete match"
            }
            aria-label="Delete match"
            className="min-h-11 min-w-11 shrink-0 rounded-md border border-white/20 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white flex items-center justify-center transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <span className="text-[10px] font-bold">…</span>
            ) : (
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {editOpen ? (
        <MatchFormModal
          tournamentId={tournamentId}
          match={match}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
            setEditOpen(false);
          }}
        />
      ) : null}

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this match?"
        description={
          <div className="space-y-2">
            <p>
              {isCompleted
                ? `Delete ${matchLabel}? Scores and history will be permanently removed.`
                : `Delete ${matchLabel}? This removes the scoring match. The fixture can be used again to create a new match.`}
            </p>
            {!isCompleted && !isLive ? (
              <p className="text-amber-200/90 text-xs">
                Do not delete if an umpire may still open this match. Prefer Match Control for walkovers or delays.
              </p>
            ) : null}
          </div>
        }
        confirmLabel={deleting ? "Deleting…" : "Delete match"}
        busy={deleting}
        onConfirm={() => {
          handleConfirmDelete();
        }}
      />
    </div>
  );
}

function buildMatchFormState(match?: MatchRow, initialFixtureId?: number) {
  const detail = match?.detail ?? {};
  const left = (detail.leftSideJson as Record<string, unknown> | undefined) ?? {};
  const right = (detail.rightSideJson as Record<string, unknown> | undefined) ?? {};
  return {
    fixtureId: initialFixtureId ? String(initialFixtureId) : "",
    categoryId: null as number | null,
    matchType: (detail.matchType as string | undefined) ?? "singles",
    courtNumber: (detail.courtNumber as string | undefined) ?? "",
    courtId: (detail.courtId as number | null | undefined) ?? null,
    matchLabel: (detail.matchLabel as string | undefined) ?? "",
    scorerPin: (detail.scorerPin as string | undefined) ?? "",
    umpireName: (detail.umpireName as string | undefined) ?? "",
    leftPlayer1: sideJsonToPlayerForm(left, 0),
    leftPlayer2: sideJsonToPlayerForm(left, 1),
    rightPlayer1: sideJsonToPlayerForm(right, 0),
    rightPlayer2: sideJsonToPlayerForm(right, 1),
    toss: matchFormTossFromDetail(detail),
  };
}

function MatchFormModal({
  tournamentId,
  match,
  initialFixtureId,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  match?: MatchRow;
  initialFixtureId?: number;
  onClose: () => void;
  onSaved: (createdId?: number) => void;
}) {
  const { toast } = useToast();
  const isEdit = !!match;
  const rosterLocked = isEdit && match.status !== "scheduled";
  const [form, setForm] = useState(() => buildMatchFormState(match, initialFixtureId));
  const isPair = isPairMatchKind(form.matchType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fixturePrefillId, setFixturePrefillId] = useState<number | null>(null);

  const { data: fixtures = [] } = useQuery<FixtureOption[]>({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, "/fixtures"),
    enabled: !isEdit && !!tournamentId,
  });

  const { data: categories = [] } = useQuery<CategoryOption[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, "/categories"),
    enabled: !isEdit && !!tournamentId,
  });

  const { data: players = [] } = useQuery<BadmintonPlayerRecord[]>({
    queryKey: ["badminton-players", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, "/players"),
    enabled: !isEdit && !!tournamentId,
  });

  const { data: courts = [] } = useQuery<Array<{ id: number; name: string; shortName?: string | null }>>({
    queryKey: ["badminton-courts", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, "/courts"),
    enabled: !isEdit && !!tournamentId,
  });

  const selectedFixture = form.fixtureId
    ? fixtures.find((f) => String(f.id) === form.fixtureId)
    : undefined;

  const { data: registrations = [] } = useQuery<RegistrationRecord[]>({
    queryKey: ["badminton-registrations", tournamentId, selectedFixture?.categoryId],
    queryFn: () =>
      badmintonFetch(tournamentId, `/categories/${selectedFixture!.categoryId}/registrations`),
    enabled: !isEdit && !!selectedFixture?.categoryId,
  });

  const availableFixtures = fixtures.filter(
    (f) =>
      !f.scoringMatchId &&
      f.courtId != null &&
      f.scheduledAt != null &&
      f.status !== "walkover" &&
      f.status !== "cancelled",
  );
  const fixtureSelectList = useMemo(() => {
    const selected = form.fixtureId
      ? fixtures.find((f) => String(f.id) === form.fixtureId)
      : undefined;
    if (selected && !availableFixtures.some((f) => f.id === selected.id)) {
      return [selected, ...availableFixtures];
    }
    return availableFixtures;
  }, [availableFixtures, fixtures, form.fixtureId]);
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );
  const registrationById = useMemo(
    () => new Map(registrations.map((r) => [r.registration.id, r.registration])),
    [registrations],
  );

  useEffect(() => {
    if (isEdit || !form.fixtureId) return;
    const fixtureId = parseInt(form.fixtureId, 10);
    if (!Number.isFinite(fixtureId) || fixturePrefillId === fixtureId) return;

    const fixture = fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return;

    const category = categoryById.get(fixture.categoryId);
    if (!category) return;

    const needsRegs = !!(fixture.registrationAId || fixture.registrationBId);
    if (needsRegs && registrations.length === 0) return;

    const matchType = category.matchType;
    const pair = isPairMatchKind(matchType);
    const regA = fixture.registrationAId
      ? registrationById.get(fixture.registrationAId)
      : undefined;
    const regB = fixture.registrationBId
      ? registrationById.get(fixture.registrationBId)
      : undefined;

    if (
      fixture.registrationAId != null &&
      fixture.registrationBId != null &&
      fixture.registrationAId === fixture.registrationBId
    ) {
      setError(
        "This fixture has the same entry on both sides (A and B). Fix the fixture in Draw/Fixtures, then create the match again.",
      );
      setFixturePrefillId(fixtureId);
      return;
    }

    const left = regA
      ? registrationSidePlayers(regA, playersById, pair)
      : { player1: emptySidePlayer(), player2: emptySidePlayer() };
    const right = regB
      ? registrationSidePlayers(regB, playersById, pair)
      : { player1: emptySidePlayer(), player2: emptySidePlayer() };

    const court = fixture.courtId
      ? courts.find((c) => c.id === fixture.courtId)
      : undefined;

    setForm((prev) => ({
      ...prev,
      categoryId: fixture.categoryId,
      matchType,
      courtId: fixture.courtId ?? prev.courtId,
      courtNumber: court
        ? court.shortName?.trim() || court.name
        : prev.courtNumber,
      matchLabel:
        prev.matchLabel.trim() ||
        `${category.name} · Match ${fixture.slotNumber ?? fixture.id}`,
      leftPlayer1: left.player1,
      leftPlayer2: left.player2,
      rightPlayer1: right.player1,
      rightPlayer2: right.player2,
      // Keep toss if user already filled it; otherwise leave as-is
    }));
    setFixturePrefillId(fixtureId);
  }, [
    isEdit,
    form.fixtureId,
    fixtures,
    courts,
    categoryById,
    playersById,
    registrationById,
    registrations.length,
    fixturePrefillId,
  ]);

  type StringFormField = "fixtureId" | "matchType" | "courtNumber" | "matchLabel" | "scorerPin" | "umpireName";

  const f = (field: StringFormField) => ({
    value: form[field] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  function buildSideJson(player1: SidePlayerForm, player2: SidePlayerForm) {
    const side1 = sidePlayerFormToJson(player1);
    if (!isPair) return side1;
    const side2 = sidePlayerFormToJson(player2);
    return mergeDoublesSideJson(side1, side2);
  }

  async function handleSubmit() {
    if (!rosterLocked) {
      if (!form.leftPlayer1.masterId || !form.rightPlayer1.masterId) {
        setError("Select a player for each side");
        return;
      }
      if (isPair && (!form.leftPlayer2.masterId || !form.rightPlayer2.masterId)) {
        setError("Select 2 players per side for doubles");
        return;
      }
      const leftIds = [form.leftPlayer1.masterId, form.leftPlayer2.masterId].filter(Boolean);
      const rightIds = [form.rightPlayer1.masterId, form.rightPlayer2.masterId].filter(Boolean);
      if (leftIds.some((id) => rightIds.includes(id))) {
        setError("Left and right sides cannot share the same player — check the fixture (A vs B)");
        return;
      }
    }
    if (form.scorerPin.trim().length > 0 && form.scorerPin.trim().length < 4) {
      setError("Scorer PIN must be at least 4 digits (or leave blank to inherit court PIN)");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const tossPayload = rosterLocked
        ? undefined
        : matchFormTossToPayload(form.toss, isPair);
      const payload = {
        courtId: form.courtId ?? undefined,
        courtNumber: form.courtNumber || undefined,
        matchLabel: form.matchLabel.trim() || undefined,
        scorerPin: form.scorerPin.trim(),
        umpireName: form.umpireName || undefined,
        ...(rosterLocked
          ? {}
          : {
              fixtureId: form.fixtureId ? parseInt(form.fixtureId, 10) : undefined,
              categoryId: form.categoryId ?? undefined,
              matchType: form.matchType,
              leftSideJson: buildSideJson(form.leftPlayer1, form.leftPlayer2),
              rightSideJson: buildSideJson(form.rightPlayer1, form.rightPlayer2),
              preMatchTossJson: tossPayload,
            }),
      };

      const res = await fetch(
        isEdit
          ? `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${match.id}`
          : `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: isEdit ? "Update failed" : "Create failed" }));
        throw new Error(typeof err.error === "string" ? err.error : isEdit ? "Update failed" : "Create failed");
      }
      const saved = (await res.json()) as { id?: number; detail?: { scorerPin?: string | null } };
      const pin = saved.detail?.scorerPin ?? form.scorerPin.trim();
      toast({
        title: isEdit ? "Match updated" : "Match created",
        description: isEdit
          ? undefined
          : pin
            ? `Scorer PIN: ${pin}. Opening Match Control — start the match there.`
            : "Inherits court scorer PIN. Opening Match Control — start the match there.",
      });
      onSaved(isEdit ? undefined : saved.id);
    } catch (e) {
      setError(friendlyBadmintonError(e, isEdit ? "Could not update match" : "Could not create match"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={isEdit ? "Edit Match" : "Create Match"}
      subtitle={
        isEdit
          ? rosterLocked
            ? "Update match name, court, umpire, or scorer PIN"
            : "Update match setup before it goes live"
          : "Create a match from a fixture when possible. Manual match (no fixture) remains for legacy compatibility."
      }
      onClose={onClose}
      size="lg"
    >
      {!isEdit ? (
        <FormField label="Fixture">
          <DarkSelect
            value={form.fixtureId || "none"}
            onValueChange={(fixtureId) => {
              setFixturePrefillId(null);
              setForm((prev) => ({
                ...prev,
                fixtureId: fixtureId === "none" ? "" : fixtureId,
                categoryId: null,
              }));
            }}
            placeholder="Link to a fixture (preferred)"
            options={[
              // LEGACY COMPATIBILITY: match without fixtureId. Prefer fixture-based create.
              { value: "none", label: "None — manual match (legacy)" },
              ...fixtureSelectList.map((fix) => {
                const category = categoryById.get(fix.categoryId);
                const scheduled =
                  fix.courtId != null && fix.scheduledAt != null;
                return {
                  value: String(fix.id),
                  label: `${category?.name ?? "Category"} · Match ${fix.slotNumber ?? fix.id}${
                    scheduled ? "" : " (not scheduled)"
                  }`,
                };
              }),
            ]}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Only scheduled fixtures (court + time) appear here. Schedule them in{" "}
            <Link
              href={`/tournament/${tournamentId}/badminton/schedule`}
              className="text-primary hover:underline"
            >
              Scheduling
            </Link>
            . <span className="text-foreground/80">None — manual match</span> is a temporary
            compatibility path (match without a fixture).
          </p>
        </FormField>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Match Type">
          <DarkSelect
            value={form.matchType}
            disabled={rosterLocked}
            onValueChange={(matchType) =>
              setForm((prev) => ({
                ...prev,
                matchType,
                leftPlayer2: emptySidePlayer(),
                rightPlayer2: emptySidePlayer(),
                toss: emptyMatchFormToss(),
              }))
            }
            options={[
              { value: "singles", label: "Singles" },
              { value: "doubles", label: "Doubles" },
              { value: "mixed_doubles", label: "Mixed Doubles" },
            ]}
          />
        </FormField>
        <FormField label="Match Name">
          <input {...f("matchLabel")} placeholder="League Match 1" className={inputClass} />
        </FormField>
        <FormField label="Court">
          <CourtAutocomplete
            tournamentId={tournamentId}
            value={form.courtNumber}
            courtId={form.courtId}
            onChange={({ courtNumber, courtId }) =>
              setForm((prev) => ({ ...prev, courtNumber, courtId }))
            }
            placeholder="Search courts…"
          />
        </FormField>
      </div>

      {!rosterLocked ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PairSidePicker
            tournamentId={tournamentId}
            sideLabel="Left"
            isPair={isPair}
            player1={form.leftPlayer1}
            player2={form.leftPlayer2}
            onPlayer1Change={(leftPlayer1) => setForm((p) => ({ ...p, leftPlayer1 }))}
            onPlayer2Change={(leftPlayer2) => setForm((p) => ({ ...p, leftPlayer2 }))}
          />
          <PairSidePicker
            tournamentId={tournamentId}
            sideLabel="Right"
            isPair={isPair}
            player1={form.rightPlayer1}
            player2={form.rightPlayer2}
            onPlayer1Change={(rightPlayer1) => setForm((p) => ({ ...p, rightPlayer1 }))}
            onPlayer2Change={(rightPlayer2) => setForm((p) => ({ ...p, rightPlayer2 }))}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
          Player lineup is locked while the match is live or completed. You can still update match name, court, umpire, and scorer PIN.
        </p>
      )}

      {!rosterLocked ? (
        <MatchFormTossFields
          isPair={isPair}
          leftLabel={
            form.leftPlayer1.name.trim() ||
            form.leftPlayer1.short.trim() ||
            "Left"
          }
          rightLabel={
            form.rightPlayer1.name.trim() ||
            form.rightPlayer1.short.trim() ||
            "Right"
          }
          leftPlayer1={form.leftPlayer1}
          leftPlayer2={form.leftPlayer2}
          rightPlayer1={form.rightPlayer1}
          rightPlayer2={form.rightPlayer2}
          toss={form.toss}
          onChange={(toss) => setForm((p) => ({ ...p, toss }))}
        />
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Umpire's Name">
          <input {...f("umpireName")} placeholder="Optional" className={inputClass} />
        </FormField>
        <FormField label="Scorer PIN">
          <div className="flex gap-2">
            <input
              {...f("scorerPin")}
              placeholder="4-digit PIN"
              type="tel"
              inputMode="numeric"
              maxLength={8}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, scorerPin: suggestScorerPin() }))}
              className="h-11 px-3 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs font-semibold shrink-0 hover-elevate"
            >
              New PIN
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Leave blank to inherit the court PIN. A match PIN overrides the court PIN.
          </p>
        </FormField>
      </div>

      <FormError message={error} />

      <FormActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={isEdit ? "Save Changes" : "Create Match"}
        saving={saving}
      />
    </FormModal>
  );
}
