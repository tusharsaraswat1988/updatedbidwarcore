import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Info,
  Lock,
  Loader2,
} from "lucide-react";

type ValidationIssue = {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
};

type SchedulingIdentity = {
  id: string;
  tournamentId: number;
  planKindId: string;
  source: string;
  fixtureId: string;
};

type SchedulingConfiguration = {
  schedulingId: string;
  strategyId: string;
  locked: boolean;
  planVersion: number | null;
  bufferMinutes: number | null;
  parallelLimit: number | null;
};

type SchedulingLifecycle = {
  status: string;
  locked: boolean;
};

type SchedulingValidation = {
  issues: ValidationIssue[];
  errorCount: number;
  readiness: string;
};

type ScheduleSlot = {
  slotId: string;
  status: string;
  blueprintId: string | null;
};

type SchedulingRow = {
  identity: SchedulingIdentity;
  configuration: SchedulingConfiguration;
  lifecycle: SchedulingLifecycle;
  validation: SchedulingValidation;
  slots: ScheduleSlot[];
  assignmentCount: number;
};

type SchedulingSetupCardProps = {
  tournamentId: number;
};

export function SchedulingSetupCard({ tournamentId }: SchedulingSetupCardProps) {
  const [rows, setRows] = useState<SchedulingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const idRes = await apiFetch(`/tournaments/${tournamentId}/scheduling`);
      if (!idRes.ok) {
        const body = await idRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load scheduling plans");
      }
      const { identities } = (await idRes.json()) as { identities: SchedulingIdentity[] };

      const loaded = await Promise.all(
        identities.map(async (identity) => {
          const base = `/tournaments/${tournamentId}/scheduling/${identity.id}`;
          const [configRes, slotsRes, resourcesRes, validationRes, lifecycleRes] =
            await Promise.all([
              apiFetch(`${base}/configuration`),
              apiFetch(`${base}/slots`),
              apiFetch(`${base}/resources`),
              apiFetch(`${base}/validation`),
              apiFetch(`${base}/lifecycle`),
            ]);
          if (
            !configRes.ok ||
            !slotsRes.ok ||
            !resourcesRes.ok ||
            !validationRes.ok ||
            !lifecycleRes.ok
          ) {
            throw new Error(`Failed to load scheduling ${identity.id}`);
          }
          const { configuration } = (await configRes.json()) as {
            configuration: SchedulingConfiguration;
          };
          const { slots } = (await slotsRes.json()) as { slots: ScheduleSlot[] };
          const { assignments } = (await resourcesRes.json()) as {
            assignments: unknown[];
          };
          const { validation } = (await validationRes.json()) as {
            validation: SchedulingValidation;
          };
          const { lifecycle } = (await lifecycleRes.json()) as {
            lifecycle: SchedulingLifecycle;
          };
          return {
            identity,
            configuration,
            lifecycle,
            validation,
            slots,
            assignmentCount: assignments.length,
          };
        }),
      );
      setRows(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Scheduling Setup");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLock(schedulingId: string) {
    setLockingId(schedulingId);
    setError("");
    try {
      const res = await apiFetch(
        `/tournaments/${tournamentId}/scheduling/${schedulingId}/ready`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock Scheduling Setup");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lock failed");
    } finally {
      setLockingId(null);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="org-surface-rail p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="org-surface-rail p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" /> Scheduling Setup
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lock the execution plan — no calendar editor, scoring, or runtime controls.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scheduling plans yet. Create fixture structure first, then lock scheduling here.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const locked = row.configuration.locked;
            const canLock = !locked && row.validation.errorCount === 0;
            const assignedSlots = row.slots.filter((s) => s.status === "assigned").length;
            return (
              <li
                key={row.identity.id}
                className="rounded-lg border border-border/40 bg-muted/10 px-3 py-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {row.identity.fixtureId} · {row.configuration.strategyId}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.identity.planKindId} · {row.identity.source} · lifecycle{" "}
                      {row.lifecycle.status}
                      {row.configuration.planVersion
                        ? ` · v${row.configuration.planVersion}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                      locked
                        ? "border-green-500/30 bg-green-500/10 text-green-400"
                        : row.validation.errorCount > 0
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {locked
                      ? "Locked"
                      : row.validation.readiness === "ready"
                        ? "Ready"
                        : row.validation.readiness === "almost_ready"
                          ? "Almost Ready"
                          : "Not Ready"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  {row.slots.length} slot{row.slots.length === 1 ? "" : "s"} · {assignedSlots}{" "}
                  assigned · {row.assignmentCount} resource assignment
                  {row.assignmentCount === 1 ? "" : "s"}
                </p>

                {row.validation.issues.length > 0 ? (
                  <ul className="space-y-1">
                    {row.validation.issues.slice(0, 4).map((issue) => (
                      <li
                        key={`${row.identity.id}-${issue.code}-${issue.message}`}
                        className="flex items-start gap-2 text-xs"
                      >
                        {issue.severity === "ERROR" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                        ) : issue.severity === "WARNING" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <span>
                          <span className="font-medium">{issue.severity}</span> — {issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    No validation issues
                  </p>
                )}

                {!locked ? (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-10"
                    disabled={!canLock || lockingId === row.identity.id}
                    onClick={() => void handleLock(row.identity.id)}
                  >
                    {lockingId === row.identity.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Locking…
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Scheduling Setup
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Plan frozen. Runtime matches and actual times are not stored here.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
