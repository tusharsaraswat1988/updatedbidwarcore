/**
 * Tournament Scheduling Engine
 * Route: /tournament/:id/badminton/schedule
 *
 * Fixtures → Scheduling (court / date / time) → Matches → Scoring
 *
 * Owns: Unscheduled → Scheduled → Ready
 * Does not start scoring. Client-side court/time conflict warnings only.
 */

import { useEffect, useMemo, useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { findCourtScheduleConflicts } from "@/lib/badminton-control-center";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";
import { friendlyBadmintonError, toastError, toastSuccess } from "@/lib/badminton-ux";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import {
  EmptyState,
  HubPageShell,
  hubCardClass,
  FormModal,
  FormField,
  FormActions,
  FormError,
  DarkSelect,
  inputClass,
  BtnPrimary,
} from "@/components/badminton/page-chrome";
import { BadmintonSetupWizardChrome } from "@/components/badminton/setup-wizard-chrome";

interface BadmintonCourt {
  id: number;
  name: string;
  shortName?: string | null;
  sortOrder: number;
  status: string;
}

interface BadmintonCategory {
  id: number;
  name: string;
  code?: string | null;
  colorCode?: string | null;
  matchType: string;
}

interface BadmintonFixture {
  id: number;
  categoryId: number;
  drawId: number;
  slotNumber?: number | null;
  registrationAId?: number | null;
  registrationBId?: number | null;
  courtId?: number | null;
  scheduledAt?: string | null;
  status: string;
  scoringMatchId?: number | null;
}

interface RegistrationRow {
  registration: {
    id: number;
    status: string;
  };
  player1: { firstName: string; lastName: string; displayName?: string | null } | null;
  player2?: { firstName: string; lastName: string; displayName?: string | null } | null;
}

function playerLabel(
  p: { firstName: string; lastName: string; displayName?: string | null } | null,
): string {
  if (!p) return "Unknown";
  if (p.displayName?.trim()) return p.displayName.trim();
  return `${p.firstName} ${p.lastName}`.trim();
}

function isScheduled(f: BadmintonFixture): boolean {
  return f.courtId != null && f.scheduledAt != null;
}

function planningStatus(f: BadmintonFixture): string {
  if (f.status === "walkover" || f.status === "cancelled") return f.status;
  if (f.status === "live" || f.status === "in_progress") return "in_progress";
  if (f.status === "completed") return "completed";
  if (f.scoringMatchId != null) return "ready";
  if (isScheduled(f)) return "scheduled";
  return "unscheduled";
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

function combineLocalDateTime(date: string, time: string): string {
  // Interpret as local wall clock → ISO for API
  const local = new Date(`${date}T${time}:00`);
  return local.toISOString();
}

export default function BadmintonSchedulePage() {
  const [, params] = useRoute("/tournament/:id/badminton/schedule");
  const tournamentId = parseInt(params?.id ?? "0");
  const search = useSearch();
  const fixtureFromQuery = new URLSearchParams(search).get("fixture");
  const highlightFixtureId = fixtureFromQuery ? parseInt(fixtureFromQuery, 10) : null;

  const qc = useQueryClient();
  const [scheduleTarget, setScheduleTarget] = useState<BadmintonFixture | null>(null);
  const [actionError, setActionError] = useState("");
  const [unscheduleTarget, setUnscheduleTarget] = useState<BadmintonFixture | null>(null);
  const [unscheduling, setUnscheduling] = useState(false);
  const [unscheduleError, setUnscheduleError] = useState("");

  const {
    data: courts = [],
    isLoading: courtsLoading,
    isError: courtsError,
    error: courtsErr,
    refetch: refetchCourts,
  } = useQuery<BadmintonCourt[]>({
    queryKey: ["badminton-courts", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/courts`),
    enabled: !!tournamentId,
  });

  const { data: categories = [] } = useQuery<BadmintonCategory[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

  const {
    data: fixtures = [],
    isLoading: fixturesLoading,
    isError: fixturesError,
    error: fixturesErr,
    refetch: refetchFixtures,
  } = useQuery<BadmintonFixture[]>({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixtures`),
    enabled: !!tournamentId,
  });

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const categoryIdsKey = useMemo(
    () =>
      [...new Set(fixtures.map((f) => f.categoryId))]
        .sort((a, b) => a - b)
        .join(","),
    [fixtures],
  );

  const { data: regsByCategory = {} } = useQuery<Record<number, RegistrationRow[]>>({
    queryKey: ["badminton-registrations-lifted", tournamentId, categoryIdsKey],
    queryFn: async () => {
      const ids = categoryIdsKey
        ? categoryIdsKey.split(",").map((s) => parseInt(s, 10))
        : [];
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const rows = await badmintonFetch<RegistrationRow[]>(
            tournamentId,
            `/categories/${id}/registrations`,
          );
          return [id, rows] as const;
        }),
      );
      return Object.fromEntries(pairs);
    },
    enabled: !!tournamentId && categoryIdsKey.length > 0,
  });

  const sideLabelByRegId = useMemo(() => {
    const map = new Map<number, string>();
    for (const [catIdRaw, rows] of Object.entries(regsByCategory)) {
      const cat = categoryById.get(Number(catIdRaw));
      const doubles = cat?.matchType !== "singles";
      for (const row of rows) {
        const a = playerLabel(row.player1);
        map.set(
          row.registration.id,
          doubles ? `${a} / ${playerLabel(row.player2 ?? null)}` : a,
        );
      }
    }
    return map;
  }, [regsByCategory, categoryById]);

  const courtById = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);

  const sortedCourts = useMemo(
    () => [...courts].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [courts],
  );

  const unscheduled = useMemo(
    () =>
      fixtures
        .filter((f) => planningStatus(f) === "unscheduled")
        .sort((a, b) => (a.slotNumber ?? 0) - (b.slotNumber ?? 0)),
    [fixtures],
  );

  const scheduledByCourt = useMemo(() => {
    const map = new Map<number, BadmintonFixture[]>();
    for (const f of fixtures) {
      const st = planningStatus(f);
      if (st !== "scheduled" && st !== "ready") continue;
      if (f.courtId == null) continue;
      const list = map.get(f.courtId) ?? [];
      list.push(f);
      map.set(f.courtId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return ta - tb;
      });
    }
    return map;
  }, [fixtures]);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["badminton-fixtures-all", tournamentId] });
    void qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
  }

  async function handleUnscheduleConfirm() {
    if (!unscheduleTarget) return;
    setUnscheduling(true);
    setUnscheduleError("");
    try {
      await badmintonFetch(tournamentId, `/fixtures/${unscheduleTarget.id}/unschedule`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toastSuccess("Fixture unscheduled", "Court and time cleared.");
      setUnscheduleTarget(null);
      invalidate();
    } catch (e) {
      setUnscheduleError(
        e instanceof Error ? e.message : "Could not clear schedule",
      );
      toastError(e, "Unschedule failed");
    } finally {
      setUnscheduling(false);
    }
  }

  // Deep link from Draw & Fixtures: open assign modal immediately
  useEffect(() => {
    if (!highlightFixtureId || Number.isNaN(highlightFixtureId) || fixtures.length === 0) return;
    if (scheduleTarget?.id === highlightFixtureId) return;
    const target = fixtures.find((f) => f.id === highlightFixtureId);
    if (target && planningStatus(target) !== "ready" && planningStatus(target) !== "completed") {
      setScheduleTarget(target);
    }
  }, [highlightFixtureId, fixtures, scheduleTarget?.id]);

  const isLoading = courtsLoading || fixturesLoading;
  const loadError = courtsError || fixturesError;
  const loadErrorObj = courtsErr ?? fixturesErr;

  return (
    <HubPageShell tournamentId={tournamentId}>
      <BadmintonSetupWizardChrome
        tournamentId={tournamentId}
        stepId="scheduling"
        continueHref={`/tournament/${tournamentId}/badminton`}
        continueLabel="Continue to Ready"
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {courts.length === 0 ? (
              <Link href={`/tournament/${tournamentId}/badminton/courts`}>
                <BtnPrimary type="button">Set up courts</BtnPrimary>
              </Link>
            ) : unscheduled.length > 0 ? (
              <BtnPrimary
                type="button"
                onClick={() => setScheduleTarget(unscheduled[0] ?? null)}
              >
                Schedule next fixture
              </BtnPrimary>
            ) : null}
          </div>
        }
      >
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {actionError ? <FormError message={actionError} /> : null}

        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading schedule">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState
            icon={AlertCircle}
            title="Could not load schedule"
            desc={friendlyBadmintonError(loadErrorObj, "Check your connection, then retry.")}
            action={{
              label: "Retry",
              onClick: () => {
                void refetchCourts();
                void refetchFixtures();
              },
            }}
          />
        ) : fixtures.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No fixtures to schedule"
            desc="Create fixtures in Tournament Draw first, then return here to assign courts and times."
            action={{
              label: "Open Tournament Draw",
              href: `/tournament/${tournamentId}/badminton/fixtures`,
            }}
          />
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">
                Unscheduled fixtures ({unscheduled.length})
              </h2>
              {unscheduled.length === 0 ? (
                <p className="text-white/35 text-sm">All schedulable fixtures have a court and time.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {unscheduled.map((fixture) => (
                    <FixtureScheduleCard
                      key={fixture.id}
                      fixture={fixture}
                      category={categoryById.get(fixture.categoryId)}
                      tournamentId={tournamentId}
                      courtName={null}
                      sideLabelByRegId={sideLabelByRegId}
                      highlighted={highlightFixtureId === fixture.id}
                      onAssign={() => setScheduleTarget(fixture)}
                      onUnschedule={undefined}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">
                Scheduled by court
              </h2>
              {sortedCourts.length === 0 ? (
                <p className="text-white/35 text-sm">
                  Add courts before assigning.{" "}
                  <Link
                    href={`/tournament/${tournamentId}/badminton/courts`}
                    className="text-[#4fc3f7] hover:underline"
                  >
                    Open Courts
                  </Link>
                </p>
              ) : (
                sortedCourts.map((court) => {
                  const list = scheduledByCourt.get(court.id) ?? [];
                  return (
                    <div key={court.id} className={cn(hubCardClass, "p-5 space-y-3")}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-white font-bold text-lg">
                          {court.shortName?.trim() || court.name}
                        </h3>
                        <span className="text-white/30 text-xs">
                          {list.length} fixture{list.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {list.length === 0 ? (
                        <p className="text-white/30 text-sm">No fixtures on this court yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {list.map((fixture) => (
                            <FixtureScheduleCard
                              key={fixture.id}
                              fixture={fixture}
                              category={categoryById.get(fixture.categoryId)}
                              tournamentId={tournamentId}
                              courtName={court.shortName?.trim() || court.name}
                              sideLabelByRegId={sideLabelByRegId}
                              compact
                              highlighted={highlightFixtureId === fixture.id}
                              onAssign={() => setScheduleTarget(fixture)}
                              onUnschedule={
                                fixture.scoringMatchId
                                  ? undefined
                                  : () => {
                                      setUnscheduleError("");
                                      setUnscheduleTarget(fixture);
                                    }
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Scheduled fixtures on unknown / deleted court ids */}
              {Array.from(scheduledByCourt.entries())
                .filter(([courtId]) => !courtById.has(courtId))
                .map(([courtId, list]) => (
                  <div key={`orphan-${courtId}`} className={cn(hubCardClass, "p-5 space-y-3")}>
                    <h3 className="text-white font-bold text-lg">Court #{courtId}</h3>
                    {list.map((fixture) => (
                      <FixtureScheduleCard
                        key={fixture.id}
                        fixture={fixture}
                        category={categoryById.get(fixture.categoryId)}
                        tournamentId={tournamentId}
                        courtName={`Court #${courtId}`}
                        sideLabelByRegId={sideLabelByRegId}
                        compact
                        highlighted={highlightFixtureId === fixture.id}
                        onAssign={() => setScheduleTarget(fixture)}
                        onUnschedule={
                          fixture.scoringMatchId
                            ? undefined
                            : () => {
                                setUnscheduleError("");
                                setUnscheduleTarget(fixture);
                              }
                        }
                      />
                    ))}
                  </div>
                ))}
            </section>
          </>
        )}
      </div>

      {scheduleTarget ? (
        <ScheduleFixtureModal
          tournamentId={tournamentId}
          fixture={scheduleTarget}
          category={categoryById.get(scheduleTarget.categoryId)}
          courts={sortedCourts}
          allFixtures={fixtures}
          onClose={() => setScheduleTarget(null)}
          onSaved={(opts) => {
            toastSuccess(
              "Match scheduled",
              opts?.hadConflict
                ? "Saved, but this court has another fixture nearby — double-check Control Center."
                : "Court and time saved.",
            );
            setScheduleTarget(null);
            invalidate();
          }}
        />
      ) : null}

      <ConfirmActionDialog
        open={unscheduleTarget != null}
        onOpenChange={(open) => {
          if (!open) setUnscheduleTarget(null);
        }}
        title="Clear schedule?"
        description="This removes the court and time from the fixture. You can assign them again anytime. Linked matches are not deleted."
        confirmLabel="Clear court & time"
        busy={unscheduling}
        error={unscheduleError}
        onConfirm={() => void handleUnscheduleConfirm()}
      />
      </BadmintonSetupWizardChrome>
    </HubPageShell>
  );
}

function FixtureScheduleCard({
  fixture,
  category,
  tournamentId,
  courtName,
  sideLabelByRegId,
  compact,
  highlighted,
  onAssign,
  onUnschedule,
}: {
  fixture: BadmintonFixture;
  category?: BadmintonCategory;
  tournamentId: number;
  courtName: string | null;
  sideLabelByRegId: Map<number, string>;
  compact?: boolean;
  highlighted?: boolean;
  onAssign: () => void;
  onUnschedule?: () => void;
}) {
  const status = planningStatus(fixture);
  const catLabel = category?.code?.trim() || category?.name || "Category";
  const title = `${catLabel} · Match ${fixture.slotNumber ?? fixture.id}`;

  const regName = (id: number | null | undefined) => {
    if (id == null) return "BYE";
    return sideLabelByRegId.get(id) ?? "TBD";
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        highlighted ? "border-purple-400/50 bg-purple-500/10" : "border-white/8 bg-white/5",
        compact && "flex flex-col sm:flex-row sm:items-center gap-3",
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {fixture.scheduledAt ? (
            <span className="text-white font-bold tabular-nums">
              {formatTime(fixture.scheduledAt)}
            </span>
          ) : null}
          <span className="text-white font-semibold truncate">{title}</span>
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
              status === "ready"
                ? "bg-emerald-500/15 text-emerald-400"
                : status === "scheduled"
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-white/10 text-white/50",
            )}
          >
            {status.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-white/50 text-sm truncate">
          {regName(fixture.registrationAId)} vs {regName(fixture.registrationBId)}
        </p>
        {fixture.scheduledAt ? (
          <p className="text-white/30 text-xs">
            {formatDate(fixture.scheduledAt)}
            {courtName ? ` · ${courtName}` : ""}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 flex-none">
        <button
          type="button"
          onClick={onAssign}
          className={cn(
            "min-h-11 px-4 rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isScheduled(fixture)
              ? "bg-white/8 hover:bg-white/12 text-white/80"
              : "bg-amber-500/25 hover:bg-amber-500/35 text-amber-100 font-bold",
          )}
        >
          {isScheduled(fixture) ? "Move" : "Assign Court / Time"}
        </button>
        {onUnschedule ? (
          <button
            type="button"
            onClick={onUnschedule}
            className="min-h-11 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/55 text-xs font-semibold"
          >
            Unschedule
          </button>
        ) : null}
        {status === "scheduled" && !fixture.scoringMatchId ? (
          <Link
            href={`/tournament/${tournamentId}/badminton/matches?fixture=${fixture.id}`}
            className="min-h-11 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold inline-flex items-center"
          >
            Create Match
          </Link>
        ) : null}
        {status === "ready" && fixture.scoringMatchId ? (
          <a
            href={badmintonMatchControlPath(tournamentId, fixture.scoringMatchId)}
            className="min-h-11 px-3 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-100 text-xs font-bold inline-flex items-center"
          >
            Match Control
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ScheduleFixtureModal({
  tournamentId,
  fixture,
  category,
  courts,
  allFixtures,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  fixture: BadmintonFixture;
  category?: BadmintonCategory;
  courts: BadmintonCourt[];
  allFixtures: BadmintonFixture[];
  onClose: () => void;
  onSaved: (opts?: { hadConflict?: boolean }) => void;
}) {
  const [courtId, setCourtId] = useState(
    fixture.courtId != null ? String(fixture.courtId) : courts[0] ? String(courts[0].id) : "",
  );
  const [date, setDate] = useState(
    toDateInputValue(fixture.scheduledAt) || toDateInputValue(new Date().toISOString()),
  );
  const [time, setTime] = useState(toTimeInputValue(fixture.scheduledAt) || "09:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflictAck, setConflictAck] = useState(false);

  const catLabel = category?.code?.trim() || category?.name || "Fixture";

  const conflicts = useMemo(() => {
    if (!courtId || !date || !time) return [];
    return findCourtScheduleConflicts(allFixtures, {
      courtId: parseInt(courtId, 10),
      scheduledAtIso: combineLocalDateTime(date, time),
      excludeFixtureId: fixture.id,
    });
  }, [allFixtures, courtId, date, time, fixture.id]);

  useEffect(() => {
    setConflictAck(false);
  }, [courtId, date, time]);

  async function handleSave() {
    if (!courtId) {
      setError("Select a court");
      return;
    }
    if (!date || !time) {
      setError("Date and time are required");
      return;
    }
    if (conflicts.length > 0 && !conflictAck) {
      setError(
        `Court conflict: ${conflicts.length} other fixture(s) within ±45 min. Confirm below to save anyway.`,
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      await badmintonFetch(tournamentId, `/fixtures/${fixture.id}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({
          courtId: parseInt(courtId, 10),
          scheduledAt: combineLocalDateTime(date, time),
          allowCourtConflict: conflictAck && conflicts.length > 0,
        }),
      });
      if (conflicts.length > 0) {
        onSaved({ hadConflict: true });
      } else {
        onSaved();
      }
    } catch (e) {
      setError(
        friendlyBadmintonError(
          e,
          "Could not save schedule. Check court and time, then try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={isScheduled(fixture) ? "Move fixture" : "Assign court & time"}
      subtitle={`${catLabel} · Match ${fixture.slotNumber ?? fixture.id}`}
      onClose={onClose}
      size="md"
    >
      {courts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No courts yet.{" "}
          <Link
            href={`/tournament/${tournamentId}/badminton/courts`}
            className="text-primary hover:underline"
          >
            Add courts
          </Link>{" "}
          first.
        </p>
      ) : (
        <>
          <FormField label="Court">
            <DarkSelect
              value={courtId || "none"}
              onValueChange={(v) => setCourtId(v === "none" ? "" : v)}
              options={[
                { value: "none", label: "Select court…" },
                ...courts.map((c) => ({
                  value: String(c.id),
                  label: c.shortName?.trim() || c.name,
                })),
              ]}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn(inputClass, "min-h-11")}
              />
            </FormField>
            <FormField label="Time">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={cn(inputClass, "min-h-11")}
              />
            </FormField>
          </div>
          {conflicts.length > 0 ? (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 space-y-2">
              <p className="text-amber-100 text-sm font-semibold">
                Same court already has {conflicts.length} fixture
                {conflicts.length !== 1 ? "s" : ""} within ±45 minutes
              </p>
              <ul className="text-amber-100/80 text-xs space-y-1">
                {conflicts.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    Match {c.slotNumber ?? c.id}
                    {c.scheduledAt ? ` · ${formatTime(c.scheduledAt)}` : ""}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2 text-amber-50 text-xs cursor-pointer min-h-11">
                <input
                  type="checkbox"
                  checked={conflictAck}
                  onChange={(e) => setConflictAck(e.target.checked)}
                  className="mt-1"
                />
                <span>I understand — schedule anyway (operators must avoid double-booking)</span>
              </label>
            </div>
          ) : null}
          <FormError message={error} />
          <FormActions
            onCancel={onClose}
            onSubmit={() => void handleSave()}
            submitLabel={
              conflicts.length > 0 && conflictAck
                ? "Save with conflict"
                : isScheduled(fixture)
                  ? "Save move"
                  : "Schedule fixture"
            }
            saving={saving}
            disabled={courts.length === 0 || (conflicts.length > 0 && !conflictAck)}
          />
        </>
      )}
    </FormModal>
  );
}
