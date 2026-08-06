import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { GitBranch, Lock, Loader2 } from "lucide-react";
import { ModuleWorkspace } from "@/components/platform/module-workspace";
import { ModuleEntityRow } from "@/components/platform/module-entity-row";
import type { PlatformValidationIssue } from "@/components/platform/types";
import {
  aggregateValidationIssues,
  buildFixtureDependencies,
  buildValidationAttentionItems,
  deriveModuleHealth,
} from "@/lib/module-workspace-utils";
import {
  useModuleSnapshots,
  useModuleWorkspaceRef,
  useRegisterModuleSnapshot,
} from "@/components/tournament-hub/use-module-registry";

type ValidationIssue = PlatformValidationIssue;

type FixtureIdentity = {
  id: string;
  tournamentId: number;
  typeId: string;
  source: string;
};

type FixtureConfiguration = {
  fixtureId: string;
  name: string;
  typeId: string;
  competitionFormat: string | null;
  locked: boolean;
  planVersion: number | null;
};

type FixtureLifecycle = {
  status: string;
  locked: boolean;
};

type FixtureValidation = {
  issues: ValidationIssue[];
  errorCount: number;
  readiness: string;
};

type FixtureNode = {
  nodeId: string;
  kindId: string;
  blueprint: { blueprintId: string } | null;
};

type FixtureRow = {
  identity: FixtureIdentity;
  configuration: FixtureConfiguration;
  lifecycle: FixtureLifecycle;
  validation: FixtureValidation;
  nodes: FixtureNode[];
  advancementCount: number;
};

type FixtureSetupCardProps = {
  tournamentId: number;
  onQuickPeek?: () => void;
};

export function FixtureSetupCard({ tournamentId, onQuickPeek }: FixtureSetupCardProps) {
  const [rows, setRows] = useState<FixtureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const snapshots = useModuleSnapshots();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const idRes = await apiFetch(`/tournaments/${tournamentId}/fixtures`);
      if (!idRes.ok) {
        const body = await idRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load fixtures");
      }
      const { identities } = (await idRes.json()) as { identities: FixtureIdentity[] };

      const loaded = await Promise.all(
        identities.map(async (identity) => {
          const base = `/tournaments/${tournamentId}/fixtures/${identity.id}`;
          const [configRes, nodesRes, advancementRes, validationRes, lifecycleRes] =
            await Promise.all([
              apiFetch(`${base}/configuration`),
              apiFetch(`${base}/nodes`),
              apiFetch(`${base}/advancement`),
              apiFetch(`${base}/validation`),
              apiFetch(`${base}/lifecycle`),
            ]);
          if (
            !configRes.ok ||
            !nodesRes.ok ||
            !advancementRes.ok ||
            !validationRes.ok ||
            !lifecycleRes.ok
          ) {
            throw new Error(`Failed to load fixture ${identity.id}`);
          }
          const { configuration } = (await configRes.json()) as {
            configuration: FixtureConfiguration;
          };
          const { nodes } = (await nodesRes.json()) as { nodes: FixtureNode[] };
          const { advancement } = (await advancementRes.json()) as {
            advancement: { rules: unknown[] };
          };
          const { validation } = (await validationRes.json()) as {
            validation: FixtureValidation;
          };
          const { lifecycle } = (await lifecycleRes.json()) as {
            lifecycle: FixtureLifecycle;
          };
          return {
            identity,
            configuration,
            lifecycle,
            validation,
            nodes,
            advancementCount: advancement.rules.length,
          };
        }),
      );
      setRows(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Fixture Setup");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLock(fixtureId: string) {
    setLockingId(fixtureId);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/fixtures/${fixtureId}/ready`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock Fixture Setup");
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
        ? ["No fixtures yet"]
        : [
            `${rows.length} fixture${rows.length === 1 ? "" : "s"}`,
            `${lockedCount} locked`,
            errorCount > 0 ? `${errorCount} blocking issue${errorCount === 1 ? "" : "s"}` : "No blocking issues",
          ];

    return {
      id: "fixtures" as const,
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
        moduleId: "fixtures",
        moduleLabel: "Fixtures",
        issues: allIssues,
      }),
      peekSummary: { title: "Fixtures", lines: peekLines },
      entityCount: rows.length,
      lockedCount,
      loading,
    };
  }, [allIssues, errorCount, lockedCount, loading, rows.length, warningCount]);

  useRegisterModuleSnapshot(snapshot);
  const workspaceRef = useModuleWorkspaceRef("fixtures");

  return (
    <ModuleWorkspace
      id="fixtures"
      icon={GitBranch}
      title="Fixture Setup"
      description="Lock the planned competitive structure — no scheduling, scoring, or bracket editor."
      health={snapshot.health}
      dependencies={buildFixtureDependencies(snapshots.competition, snapshots.teams)}
      error={error}
      loading={loading && rows.length === 0}
      onQuickPeek={onQuickPeek}
      workspaceRef={workspaceRef}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No fixtures yet. Generate or import draws in the sport runtime, then lock structure here.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const locked = row.configuration.locked;
            const canLock = !locked && row.validation.errorCount === 0;
            const blueprintCount = row.nodes.filter((n) => n.blueprint).length;
            return (
              <ModuleEntityRow
                key={row.identity.id}
                title={row.configuration.name}
                subtitle={
                  <>
                    {row.configuration.typeId} · {row.identity.source} · lifecycle{" "}
                    {row.lifecycle.status}
                    {row.configuration.competitionFormat
                      ? ` · ${row.configuration.competitionFormat}`
                      : ""}
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
                          <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Fixture Setup
                        </>
                      )}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Structure frozen. Schedules and runtime matches are not stored here.
                    </p>
                  )
                }
              >
                <p className="text-xs text-muted-foreground">
                  {row.nodes.length} node{row.nodes.length === 1 ? "" : "s"} · {blueprintCount}{" "}
                  blueprint{blueprintCount === 1 ? "" : "s"} · {row.advancementCount} advancement
                  rule{row.advancementCount === 1 ? "" : "s"}
                </p>
              </ModuleEntityRow>
            );
          })}
        </ul>
      )}
    </ModuleWorkspace>
  );
}
