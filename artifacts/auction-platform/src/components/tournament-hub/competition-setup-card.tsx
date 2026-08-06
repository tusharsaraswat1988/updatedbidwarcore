import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import { ModuleWorkspace } from "@/components/platform/module-workspace";
import { ReviewPanel, ReviewInfoRow } from "@/components/platform/review-panel";
import type { PlatformValidationIssue } from "@/components/platform/types";
import {
  aggregateValidationIssues,
  buildCompetitionDependencies,
  buildRecommendationHistory,
  buildValidationAttentionItems,
  deriveModuleHealth,
} from "@/lib/module-workspace-utils";
import {
  useModuleWorkspaceRef,
  useRegisterModuleSnapshot,
} from "@/components/tournament-hub/use-module-registry";

type CompetitionAggregate = {
  plan: { version: number } | null;
  configuration: {
    registrationModeId: string | null;
    teamFormationStrategyId: string | null;
    competitionTypeId: string | null;
    businessStageId: string;
    locked: boolean;
  };
  validation: {
    issues: PlatformValidationIssue[];
    errorCount: number;
    warningCount: number;
    readiness: string;
  };
  summary: {
    status: {
      readiness: string;
      locked: boolean;
      blockingIssueCount: number;
      warningCount: number;
      recommendations: string[];
      businessStageId: string;
    };
    participantCount: number;
  };
};

type CompetitionSetupCardProps = {
  tournamentId: number;
  onQuickPeek?: () => void;
};

export function CompetitionSetupCard({ tournamentId, onQuickPeek }: CompetitionSetupCardProps) {
  const [data, setData] = useState<CompetitionAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/competition`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load competition");
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load competition");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLock() {
    setLocking(true);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/competition/ready`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock Competition Setup");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lock failed");
    } finally {
      setLocking(false);
    }
  }

  const summary = data?.summary;
  const validation = data?.validation;
  const configuration = data?.configuration;
  const plan = data?.plan;
  const locked = Boolean(summary?.status.locked || plan);
  const canLock = !locked && (validation?.errorCount ?? 0) === 0;
  const validationIssues = aggregateValidationIssues(validation?.issues ?? []);

  const snapshot = useMemo(() => {
    if (!data) {
      return {
        id: "competition" as const,
        health: deriveModuleHealth({ errorCount: 0, warningCount: 0, loading: true }),
        errorCount: 0,
        warningCount: 0,
        validationIssues: [],
        recommendations: [],
        attentionItems: [],
        peekSummary: { title: "Competition", lines: ["Loading…"] },
        entityCount: 0,
        lockedCount: 0,
        loading: true,
      };
    }

    const recommendations = data.summary.status.recommendations ?? [];
    const issues = aggregateValidationIssues(data.validation.issues);

    return {
      id: "competition" as const,
      health: deriveModuleHealth({
        errorCount: data.validation.errorCount,
        warningCount: data.validation.warningCount,
        entityCount: 1,
      }),
      locked,
      readiness: data.summary.status.readiness,
      errorCount: data.validation.errorCount,
      warningCount: data.validation.warningCount,
      validationIssues: issues,
      recommendations,
      attentionItems: buildValidationAttentionItems({
        moduleId: "competition",
        moduleLabel: "Competition",
        issues,
      }),
      peekSummary: {
        title: "Competition",
        lines: [
          `Type: ${data.configuration.competitionTypeId ?? "—"}`,
          `Participants: ${data.summary.participantCount}`,
          locked ? "Configuration locked" : `Readiness: ${data.summary.status.readiness}`,
        ],
      },
      entityCount: 1,
      lockedCount: locked ? 1 : 0,
      loading: false,
    };
  }, [data, locked]);

  useRegisterModuleSnapshot(snapshot);
  const workspaceRef = useModuleWorkspaceRef("competition");

  if (!data && !loading) {
    return (
      <ModuleWorkspace
        id="competition"
        icon={Lock}
        title="Competition Setup"
        description="Configure and lock how this competition runs — before draws and fixtures."
        health="blocked"
        error={error || "Competition Setup unavailable"}
        workspaceRef={workspaceRef}
      >
        <p className="text-sm text-destructive">{error || "Competition Setup unavailable"}</p>
      </ModuleWorkspace>
    );
  }

  return (
    <ModuleWorkspace
      id="competition"
      icon={Lock}
      title="Competition Setup"
      description="Configure and lock how this competition runs — before draws and fixtures."
      locked={locked}
      readiness={summary?.status.readiness}
      errorCount={validation?.errorCount ?? 0}
      lockedLabel="Configuration Locked"
      health={snapshot.health}
      dependencies={buildCompetitionDependencies()}
      validationIssues={validationIssues}
      validationVariant="bordered"
      validationMaxItems={8}
      history={buildRecommendationHistory(summary?.status.recommendations ?? [])}
      error={error}
      loading={loading && !data}
      onQuickPeek={onQuickPeek}
      workspaceRef={workspaceRef}
      actionBar={
        !locked ? (
          <Button
            type="button"
            className="min-h-12 w-full sm:w-auto"
            disabled={!canLock || locking}
            onClick={() => void handleLock()}
          >
            {locking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Locking…
              </>
            ) : (
              "Lock Competition Setup"
            )}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Competition Plan is frozen. Re-freeze is not available in this release.
          </p>
        )
      }
    >
      <ReviewPanel>
        <ReviewInfoRow label="Competition Type" value={configuration?.competitionTypeId ?? "—"} />
        <ReviewInfoRow label="Registration Mode" value={configuration?.registrationModeId ?? "—"} />
        <ReviewInfoRow
          label="Team Formation"
          value={configuration?.teamFormationStrategyId ?? "—"}
        />
        <ReviewInfoRow label="Participants" value={String(summary?.participantCount ?? 0)} />
        {plan ? <ReviewInfoRow label="Plan Version" value={`v${plan.version}`} /> : null}
      </ReviewPanel>
    </ModuleWorkspace>
  );
}
