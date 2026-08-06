import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Swords } from "lucide-react";
import { ModuleWorkspace } from "@/components/platform/module-workspace";
import { ModuleEntityRow } from "@/components/platform/module-entity-row";
import type { PlatformValidationIssue } from "@/components/platform/types";
import {
  aggregateValidationIssues,
  buildMatchDependencies,
  buildValidationAttentionItems,
  deriveModuleHealth,
} from "@/lib/module-workspace-utils";
import {
  useModuleSnapshots,
  useModuleWorkspaceRef,
  useRegisterModuleSnapshot,
} from "@/components/tournament-hub/use-module-registry";

type ValidationIssue = PlatformValidationIssue;

type MatchIdentity = {
  id: string;
  tournamentId: number;
  typeId: string;
};

type MatchConfiguration = {
  matchId: string;
  name: string;
  displayName: string;
  typeId: string;
  venue: string | null;
  locked: boolean;
  planVersion: number | null;
};

type MatchLifecycle = {
  status: string;
  locked: boolean;
};

type MatchValidation = {
  issues: ValidationIssue[];
  errorCount: number;
  readiness: string;
};

type MatchSide = {
  sideId: string;
  subject: { kind: string; displayName: string } | null;
};

type MatchRow = {
  identity: MatchIdentity;
  configuration: MatchConfiguration;
  lifecycle: MatchLifecycle;
  validation: MatchValidation;
  sides: MatchSide[];
  officialCount: number;
};

type MatchSetupCardProps = {
  tournamentId: number;
  onQuickPeek?: () => void;
};

export function MatchSetupCard({ tournamentId, onQuickPeek }: MatchSetupCardProps) {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const snapshots = useModuleSnapshots();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const idRes = await apiFetch(`/tournaments/${tournamentId}/matches/identities`);
      if (!idRes.ok) {
        const body = await idRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load matches");
      }
      const { identities } = (await idRes.json()) as { identities: MatchIdentity[] };

      const loaded = await Promise.all(
        identities.map(async (identity) => {
          const base = `/tournaments/${tournamentId}/matches/${identity.id}`;
          const [configRes, sidesRes, officialsRes, validationRes, lifecycleRes] =
            await Promise.all([
              apiFetch(`${base}/configuration`),
              apiFetch(`${base}/sides`),
              apiFetch(`${base}/officials`),
              apiFetch(`${base}/validation`),
              apiFetch(`${base}/lifecycle`),
            ]);
          if (
            !configRes.ok ||
            !sidesRes.ok ||
            !officialsRes.ok ||
            !validationRes.ok ||
            !lifecycleRes.ok
          ) {
            throw new Error(`Failed to load match ${identity.id}`);
          }
          const { configuration } = (await configRes.json()) as {
            configuration: MatchConfiguration;
          };
          const { sides } = (await sidesRes.json()) as { sides: MatchSide[] };
          const { officials } = (await officialsRes.json()) as { officials: unknown[] };
          const { validation } = (await validationRes.json()) as {
            validation: MatchValidation;
          };
          const { lifecycle } = (await lifecycleRes.json()) as {
            lifecycle: MatchLifecycle;
          };
          return {
            identity,
            configuration,
            lifecycle,
            validation,
            sides,
            officialCount: officials.length,
          };
        }),
      );
      setRows(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Match Setup");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLock(matchId: string) {
    setLockingId(matchId);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/matches/${matchId}/ready`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock Match Setup");
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
        ? ["No matches yet"]
        : [
            `${rows.length} match${rows.length === 1 ? "" : "es"}`,
            `${lockedCount} locked`,
            errorCount > 0 ? `${errorCount} blocking issue${errorCount === 1 ? "" : "s"}` : "No blocking issues",
          ];

    return {
      id: "matches" as const,
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
        moduleId: "matches",
        moduleLabel: "Matches",
        issues: allIssues,
      }),
      peekSummary: { title: "Matches", lines: peekLines },
      entityCount: rows.length,
      lockedCount,
      loading,
    };
  }, [allIssues, errorCount, lockedCount, loading, rows.length, warningCount]);

  useRegisterModuleSnapshot(snapshot);
  const workspaceRef = useModuleWorkspaceRef("matches");

  return (
    <ModuleWorkspace
      id="matches"
      icon={Swords}
      title="Match Setup"
      description="Configure and lock each Match identity — no scoring, broadcast, or fixtures."
      health={snapshot.health}
      dependencies={buildMatchDependencies(snapshots.fixtures)}
      error={error}
      loading={loading && rows.length === 0}
      onQuickPeek={onQuickPeek}
      workspaceRef={workspaceRef}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches yet. Create matches in scoring or badminton runtime, then lock configuration
          here.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const locked = row.configuration.locked;
            const canLock = !locked && row.validation.errorCount === 0;
            const sideLabel = row.sides
              .map((s) => s.subject?.displayName ?? `${s.sideId} (empty)`)
              .join(" vs ");
            return (
              <ModuleEntityRow
                key={row.identity.id}
                title={row.configuration.displayName}
                subtitle={
                  <>
                    {row.configuration.typeId} · lifecycle {row.lifecycle.status}
                    {row.configuration.venue ? ` · ${row.configuration.venue}` : ""}
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
                          <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Match Setup
                        </>
                      )}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Configuration frozen. Score and events are not stored here.
                    </p>
                  )
                }
              >
                <p className="text-xs text-muted-foreground truncate">
                  Sides: {sideLabel} · {row.officialCount} official
                  {row.officialCount === 1 ? "" : "s"}
                </p>
              </ModuleEntityRow>
            );
          })}
        </ul>
      )}
    </ModuleWorkspace>
  );
}
