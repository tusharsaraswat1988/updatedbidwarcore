import { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import { ModuleWorkspace } from "@/components/platform/module-workspace";
import { ReviewPanel, ReviewInfoRow } from "@/components/platform/review-panel";
import type { PlatformValidationIssue } from "@/components/platform/types";
import { CatalogOptionList } from "@/components/tournament-creation/catalog-option-list";
import { getSportCapabilities } from "@/lib/sport-capabilities";
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
    sportId: string;
    variantId: string | null;
    registrationModeId: string | null;
    teamFormationStrategyId: string | null;
    competitionTypeId: string | null;
    businessStageId: string;
    locked: boolean;
    squadRules: {
      minPlayers?: number | null;
      maxPlayers?: number | null;
      substitutes?: number | null;
      retentions?: number | null;
    };
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

type SquadDraft = {
  minPlayers: string;
  maxPlayers: string;
  substitutes: string;
  retentions: string;
};

function squadFromConfig(
  squadRules?: CompetitionAggregate["configuration"]["squadRules"],
): SquadDraft {
  return {
    minPlayers: squadRules?.minPlayers != null ? String(squadRules.minPlayers) : "",
    maxPlayers: squadRules?.maxPlayers != null ? String(squadRules.maxPlayers) : "",
    substitutes: squadRules?.substitutes != null ? String(squadRules.substitutes) : "",
    retentions: squadRules?.retentions != null ? String(squadRules.retentions) : "",
  };
}

function displayName(
  kind: "competition" | "registration" | "formation" | "variant",
  id: string | null | undefined,
): string {
  if (!id) return "Not set";
  if (kind === "competition") {
    return CatalogRegistry.getCompetitionType(id)?.displayName ?? id;
  }
  if (kind === "registration") {
    return CatalogRegistry.getRegistrationMode(id)?.displayName ?? id;
  }
  if (kind === "formation") {
    return CatalogRegistry.getTeamFormationStrategy(id)?.displayName ?? id;
  }
  return CatalogRegistry.getVariant(id)?.displayName ?? id;
}

export function CompetitionSetupCard({ tournamentId, onQuickPeek }: CompetitionSetupCardProps) {
  const [data, setData] = useState<CompetitionAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [competitionTypeId, setCompetitionTypeId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [registrationModeId, setRegistrationModeId] = useState("");
  const [teamFormationStrategyId, setTeamFormationStrategyId] = useState("");
  const [squadRules, setSquadRules] = useState<SquadDraft>(squadFromConfig());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/competition`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load competition");
      }
      const json = (await res.json()) as CompetitionAggregate;
      setData(json);
      setCompetitionTypeId(json.configuration.competitionTypeId ?? "");
      setVariantId(json.configuration.variantId ?? "");
      setRegistrationModeId(json.configuration.registrationModeId ?? "");
      setTeamFormationStrategyId(json.configuration.teamFormationStrategyId ?? "");
      setSquadRules(squadFromConfig(json.configuration.squadRules));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load competition");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sportId = data?.configuration.sportId ?? "cricket";
  const competitions = useMemo(
    () => CatalogRegistry.listCompetitionTypes(sportId),
    [sportId],
  );
  const variants = useMemo(() => CatalogRegistry.listVariants(sportId), [sportId]);
  const registrationModes = useMemo(
    () =>
      competitionTypeId
        ? CatalogRegistry.listRegistrationModes(competitionTypeId)
        : [],
    [competitionTypeId],
  );
  const teamFormationStrategies = useMemo(() => {
    const entries = competitionTypeId
      ? CatalogRegistry.listTeamFormationStrategies(competitionTypeId)
      : [];
    const caps = getSportCapabilities(sportId);
    if (caps.hasCaptain) return entries;
    return entries.filter((entry) => entry.id !== "captain_pick");
  }, [competitionTypeId, sportId]);

  const recommendedRegistrationModeId = competitionTypeId
    ? CatalogRegistry.suggestRegistrationModeId(competitionTypeId)
    : null;
  const recommendedTeamFormationId = competitionTypeId
    ? CatalogRegistry.suggestTeamFormationStrategyId(competitionTypeId)
    : null;

  async function persistSetup(): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const squadPayload: Record<string, number> = {};
      for (const [key, raw] of Object.entries(squadRules)) {
        if (raw && Number.isFinite(parseInt(raw, 10))) {
          squadPayload[key] = parseInt(raw, 10);
        }
      }
      const min = squadPayload.minPlayers;
      const max = squadPayload.maxPlayers;
      if (min != null && max != null && min > max) {
        throw new Error("Minimum players cannot exceed maximum players.");
      }

      const res = await apiFetch(`/tournaments/${tournamentId}/competition/configuration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionTypeId: competitionTypeId || null,
          variantId: variantId || null,
          registrationModeId: registrationModeId || null,
          teamFormationStrategyId: teamFormationStrategyId || null,
          squadRules: Object.keys(squadPayload).length > 0 ? squadPayload : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not save tournament setup");
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await persistSetup();
  }

  async function handleLock() {
    setLocking(true);
    setError("");
    try {
      const saved = await persistSetup();
      if (!saved) return;
      const res = await apiFetch(`/tournaments/${tournamentId}/competition/ready`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock tournament setup");
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
  const localReadyToLock = Boolean(competitionTypeId && registrationModeId);
  const canLock = !locked && localReadyToLock;
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
        peekSummary: { title: "Tournament", lines: ["Loading…"] },
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
        moduleLabel: "Tournament",
        issues,
      }),
      peekSummary: {
        title: "Tournament",
        lines: [
          `Format: ${displayName("competition", data.configuration.competitionTypeId)}`,
          `Participants: ${data.summary.participantCount}`,
          locked ? "Setup locked" : `Readiness: ${data.summary.status.readiness}`,
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
        title="Tournament setup"
        description="Choose how teams enter and compete — before draws and fixtures."
        health="blocked"
        error={error || "Tournament setup unavailable"}
        workspaceRef={workspaceRef}
      >
        <p className="text-sm text-destructive">{error || "Tournament setup unavailable"}</p>
      </ModuleWorkspace>
    );
  }

  return (
    <ModuleWorkspace
      id="competition"
      icon={Lock}
      title="Tournament setup"
      description="Choose how teams enter and compete — before draws and fixtures."
      locked={locked}
      readiness={summary?.status.readiness}
      errorCount={validation?.errorCount ?? 0}
      lockedLabel="Setup Locked"
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full sm:w-auto"
              disabled={saving || locking}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                "Save setup"
              )}
            </Button>
            <Button
              type="button"
              className="min-h-12 w-full sm:w-auto"
              disabled={!canLock || locking || saving}
              onClick={() => void handleLock()}
            >
              {locking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Locking…
                </>
              ) : (
                "Lock setup"
              )}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tournament setup is locked for this release. Unlocking is not available yet.
          </p>
        )
      }
    >
      {locked ? (
        <ReviewPanel>
          <ReviewInfoRow
            label="How teams compete"
            value={displayName("competition", configuration?.competitionTypeId)}
          />
          <ReviewInfoRow
            label="Variant"
            value={displayName("variant", configuration?.variantId)}
          />
          <ReviewInfoRow
            label="How participants enter"
            value={displayName("registration", configuration?.registrationModeId)}
          />
          <ReviewInfoRow
            label="How teams are formed"
            value={displayName("formation", configuration?.teamFormationStrategyId)}
          />
          <ReviewInfoRow label="Participants" value={String(summary?.participantCount ?? 0)} />
          {plan ? <ReviewInfoRow label="Plan Version" value={`v${plan.version}`} /> : null}
        </ReviewPanel>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">How teams compete</h3>
              <p className="text-xs text-muted-foreground">
                Pick the competition format for Sports scoring and fixtures.
              </p>
            </div>
            <CatalogOptionList
              entries={competitions}
              value={competitionTypeId}
              onSelect={(entry) => {
                setCompetitionTypeId(entry.id);
                setRegistrationModeId("");
                setTeamFormationStrategyId("");
              }}
            />
          </section>

          {variants.length > 1 ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Sport variant</h3>
                <p className="text-xs text-muted-foreground">
                  Choose the variant that matches how this event is played.
                </p>
              </div>
              <CatalogOptionList
                entries={variants}
                value={variantId}
                onSelect={(entry) => setVariantId(entry.id)}
                emptyLabel="No variants available for this sport."
              />
            </section>
          ) : null}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">How participants enter</h3>
              {recommendedRegistrationModeId ? (
                <p className="text-xs text-muted-foreground">
                  Recommended:{" "}
                  {CatalogRegistry.getRegistrationMode(recommendedRegistrationModeId)
                    ?.displayName ?? recommendedRegistrationModeId}
                </p>
              ) : null}
            </div>
            <CatalogOptionList
              entries={registrationModes}
              value={registrationModeId}
              onSelect={(entry) => setRegistrationModeId(entry.id)}
              emptyLabel="Select how teams compete first."
            />
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">How teams are formed</h3>
              {recommendedTeamFormationId ? (
                <p className="text-xs text-muted-foreground">
                  Recommended:{" "}
                  {CatalogRegistry.getTeamFormationStrategy(recommendedTeamFormationId)
                    ?.displayName ?? recommendedTeamFormationId}
                </p>
              ) : null}
            </div>
            <CatalogOptionList
              entries={teamFormationStrategies}
              value={teamFormationStrategyId}
              onSelect={(entry) => setTeamFormationStrategyId(entry.id)}
              emptyLabel="Select how teams compete first."
            />
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Squad size</h3>
              <p className="text-xs text-muted-foreground">
                Optional limits. Leave blank if not needed yet.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["minPlayers", "Minimum players"],
                  ["maxPlayers", "Maximum players"],
                  ["substitutes", "Substitutes"],
                  ["retentions", "Retentions"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={squadRules[key]}
                    onChange={(e) =>
                      setSquadRules((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="min-h-12"
                    placeholder="Optional"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </ModuleWorkspace>
  );
}
