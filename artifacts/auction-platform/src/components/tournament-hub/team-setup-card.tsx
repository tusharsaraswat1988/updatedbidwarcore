import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Users } from "lucide-react";
import { ModuleWorkspace } from "@/components/platform/module-workspace";
import { ModuleEntityRow } from "@/components/platform/module-entity-row";
import type { PlatformValidationIssue } from "@/components/platform/types";
import {
  aggregateValidationIssues,
  buildTeamDependencies,
  buildValidationAttentionItems,
  deriveModuleHealth,
} from "@/lib/module-workspace-utils";
import {
  useModuleSnapshots,
  useModuleWorkspaceRef,
  useRegisterModuleSnapshot,
} from "@/components/tournament-hub/use-module-registry";

type ValidationIssue = PlatformValidationIssue;

type TeamIdentity = {
  id: string;
  tournamentId: number;
  typeId: string;
  masterTeamId: string | null;
};

type TeamConfiguration = {
  teamId: string;
  name: string;
  displayName: string;
  shortName: string;
  typeId: string;
  status: string;
  locked: boolean;
  planVersion: number | null;
};

type TeamValidation = {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  readiness: string;
};

type TeamRow = {
  identity: TeamIdentity;
  configuration: TeamConfiguration;
  validation: TeamValidation;
  memberCount: number;
};

type TeamSetupCardProps = {
  tournamentId: number;
  onQuickPeek?: () => void;
};

export function TeamSetupCard({ tournamentId, onQuickPeek }: TeamSetupCardProps) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const snapshots = useModuleSnapshots();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const idRes = await apiFetch(`/tournaments/${tournamentId}/teams/identities`);
      if (!idRes.ok) {
        const body = await idRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load teams");
      }
      const { identities } = (await idRes.json()) as { identities: TeamIdentity[] };

      const loaded = await Promise.all(
        identities.map(async (identity) => {
          const [configRes, membersRes, validationRes] = await Promise.all([
            apiFetch(`/tournaments/${tournamentId}/teams/${identity.id}/configuration`),
            apiFetch(`/tournaments/${tournamentId}/teams/${identity.id}/members`),
            apiFetch(`/tournaments/${tournamentId}/teams/${identity.id}/validation`),
          ]);
          if (!configRes.ok || !membersRes.ok || !validationRes.ok) {
            throw new Error(`Failed to load team ${identity.id}`);
          }
          const { configuration } = (await configRes.json()) as {
            configuration: TeamConfiguration;
          };
          const { members } = (await membersRes.json()) as { members: unknown[] };
          const { validation } = (await validationRes.json()) as {
            validation: TeamValidation;
          };
          return {
            identity,
            configuration,
            validation,
            memberCount: members.length,
          };
        }),
      );
      setRows(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Team Setup");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLock(teamId: string) {
    setLockingId(teamId);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/teams/${teamId}/ready`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock Team Setup");
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
  const warningCount = rows.reduce((sum, row) => sum + row.validation.warningCount, 0);
  const allIssues = aggregateValidationIssues(
    rows.flatMap((row) => row.validation.issues),
  );

  const snapshot = useMemo(() => {
    const peekLines =
      rows.length === 0
        ? ["No teams yet"]
        : [
            `${rows.length} team${rows.length === 1 ? "" : "s"}`,
            `${lockedCount} locked`,
            errorCount > 0 ? `${errorCount} blocking issue${errorCount === 1 ? "" : "s"}` : "No blocking issues",
          ];

    return {
      id: "teams" as const,
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
        moduleId: "teams",
        moduleLabel: "Teams",
        issues: allIssues,
      }),
      peekSummary: { title: "Teams", lines: peekLines },
      entityCount: rows.length,
      lockedCount,
      loading,
    };
  }, [allIssues, errorCount, lockedCount, loading, rows.length, warningCount]);

  useRegisterModuleSnapshot(snapshot);
  const workspaceRef = useModuleWorkspaceRef("teams");

  const manageTeamsLink = (
    <Link
      href={`/tournament/${tournamentId}/teams?from=${encodeURIComponent(`/tournament/${tournamentId}`)}`}
      className="text-xs font-medium text-primary hover:underline shrink-0"
    >
      Manage teams
    </Link>
  );

  return (
    <ModuleWorkspace
      id="teams"
      icon={Users}
      title="Team Setup"
      description="Configure and lock each Team identity — branding and lifecycle only."
      health={snapshot.health}
      dependencies={buildTeamDependencies(snapshots.competition)}
      error={error}
      loading={loading && rows.length === 0}
      headerLink={manageTeamsLink}
      onQuickPeek={onQuickPeek}
      workspaceRef={workspaceRef}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No teams yet. Create teams first, then return here to lock configuration.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const locked = row.configuration.locked;
            const canLock = !locked && row.validation.errorCount === 0;
            return (
              <ModuleEntityRow
                key={row.identity.id}
                title={row.configuration.displayName}
                subtitle={
                  <>
                    {row.configuration.shortName} · {row.configuration.typeId} ·{" "}
                    {row.configuration.status}
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
                          <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Team Setup
                        </>
                      )}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Configuration frozen. Roster history is not stored here.
                    </p>
                  )
                }
              >
                <p className="text-xs text-muted-foreground">
                  {row.memberCount} membership relationship
                  {row.memberCount === 1 ? "" : "s"} (identity is independent)
                </p>
              </ModuleEntityRow>
            );
          })}
        </ul>
      )}
    </ModuleWorkspace>
  );
}
