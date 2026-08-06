import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { CalendarClock, Lock, Loader2 } from "lucide-react";
import { ModuleWorkspace } from "@/components/platform/module-workspace";
import { ModuleEntityRow } from "@/components/platform/module-entity-row";
import type { PlatformValidationIssue } from "@/components/platform/types";
import {
  aggregateValidationIssues,
  buildSchedulingDependencies,
  buildValidationAttentionItems,
  deriveModuleHealth,
} from "@/lib/module-workspace-utils";
import {
  useModuleSnapshots,
  useModuleWorkspaceRef,
  useRegisterModuleSnapshot,
} from "@/components/tournament-hub/use-module-registry";

type ValidationIssue = PlatformValidationIssue;

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
  onQuickPeek?: () => void;
};

export function SchedulingSetupCard({ tournamentId, onQuickPeek }: SchedulingSetupCardProps) {
  const [rows, setRows] = useState<SchedulingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const snapshots = useModuleSnapshots();

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

  const lockedCount = rows.filter((row) => row.configuration.locked).length;
  const errorCount = rows.reduce((sum, row) => sum + row.validation.errorCount, 0);
  const warningCount = rows.reduce(
    (sum, row) => sum + row.validation.issues.filter((i) => i.severity === "WARNING").length,
    0,
  );
  const allIssues = aggregateValidationIssues(
    rows.flatMap((row) => row.validation.issues),
  );

  const snapshot = useMemo(() => {
    const peekLines =
      rows.length === 0
        ? ["No scheduling plans yet"]
        : [
            `${rows.length} plan${rows.length === 1 ? "" : "s"}`,
            `${lockedCount} locked`,
            errorCount > 0 ? `${errorCount} blocking issue${errorCount === 1 ? "" : "s"}` : "No blocking issues",
          ];

    return {
      id: "scheduling" as const,
      health: deriveModuleHealth({
        errorCount,
        warningCount,
        loading,
        entityCount: rows.length,
      }),
      errorCount,
      warningCount,
      validationIssues: allIssues,
      recommendations: [],
      attentionItems: buildValidationAttentionItems({
        moduleId: "scheduling",
        moduleLabel: "Scheduling",
        issues: allIssues,
      }),
      peekSummary: { title: "Scheduling", lines: peekLines },
      entityCount: rows.length,
      lockedCount,
      loading,
    };
  }, [allIssues, errorCount, lockedCount, loading, rows.length, warningCount]);

  useRegisterModuleSnapshot(snapshot);
  const workspaceRef = useModuleWorkspaceRef("scheduling");

  return (
    <ModuleWorkspace
      id="scheduling"
      icon={CalendarClock}
      title="Scheduling Setup"
      description="Lock the execution plan — no calendar editor, scoring, or runtime controls."
      health={snapshot.health}
      dependencies={buildSchedulingDependencies(snapshots.fixtures)}
      error={error}
      loading={loading && rows.length === 0}
      onQuickPeek={onQuickPeek}
      workspaceRef={workspaceRef}
    >
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
              <ModuleEntityRow
                key={row.identity.id}
                title={`${row.identity.fixtureId} · ${row.configuration.strategyId}`}
                subtitle={
                  <>
                    {row.identity.planKindId} · {row.identity.source} · lifecycle{" "}
                    {row.lifecycle.status}
                    {row.configuration.planVersion ? ` · v${row.configuration.planVersion}` : ""}
                  </>
                }
                locked={locked}
                readiness={row.validation.readiness}
                errorCount={row.validation.errorCount}
                issues={row.validation.issues}
                footer={
                  !locked ? (
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
                  )
                }
              >
                <p className="text-xs text-muted-foreground">
                  {row.slots.length} slot{row.slots.length === 1 ? "" : "s"} · {assignedSlots}{" "}
                  assigned · {row.assignmentCount} resource assignment
                  {row.assignmentCount === 1 ? "" : "s"}
                </p>
              </ModuleEntityRow>
            );
          })}
        </ul>
      )}
    </ModuleWorkspace>
  );
}
