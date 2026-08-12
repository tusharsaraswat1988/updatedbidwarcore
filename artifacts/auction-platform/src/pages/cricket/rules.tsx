/**
 * Cricket Rules & format — competition, formation, profiles, lock, apply to matches.
 * Route: /tournament/:id/score/rules
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  FormField,
  PageHeader,
  hubPanelClass,
  inputClass,
} from "@/components/badminton/page-chrome";
import { CatalogOptionList } from "@/components/tournament-creation/catalog-option-list";
import { RuleProfileCatalogPanel } from "@/components/tournament-creation/rule-profile-catalog-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { getGetTournamentQueryKey, useGetTournament } from "@workspace/api-client-react";
import { getSportCapabilities } from "@/lib/sport-capabilities";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Lock, Scale } from "lucide-react";

type CompetitionAggregate = {
  plan: { version: number } | null;
  configuration: {
    sportId: string;
    variantId: string | null;
    registrationModeId: string | null;
    teamFormationStrategyId: string | null;
    competitionTypeId: string | null;
    ruleProfileId: string | null;
    ruleProfileVersion: string | null;
    presentationProfileId: string | null;
    presentationProfileVersion: string | null;
    locked: boolean;
    squadRules: {
      minPlayers?: number | null;
      maxPlayers?: number | null;
      substitutes?: number | null;
      retentions?: number | null;
    };
  };
  validation: {
    issues: Array<{ severity: string; code: string; message: string }>;
    errorCount: number;
    readiness: string;
  };
  summary: {
    status: {
      readiness: string;
      locked: boolean;
      blockingIssueCount: number;
    };
    participantCount: number;
  };
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

export default function CricketRulesPage() {
  const [, params] = useRoute("/tournament/:id/score/rules");
  const tournamentId = parseInt(params?.id || "0", 10);
  const { toast } = useToast();

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const [data, setData] = useState<CompetitionAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const [competitionTypeId, setCompetitionTypeId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [registrationModeId, setRegistrationModeId] = useState("");
  const [teamFormationStrategyId, setTeamFormationStrategyId] = useState("");
  const [ruleProfileId, setRuleProfileId] = useState("");
  const [ruleProfileVersion, setRuleProfileVersion] = useState("");
  const [presentationProfileId, setPresentationProfileId] = useState("");
  const [presentationProfileVersion, setPresentationProfileVersion] = useState("");
  const [squadRules, setSquadRules] = useState<SquadDraft>(squadFromConfig());

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/competition`);
      const body = (await res.json().catch(() => ({}))) as CompetitionAggregate & {
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Failed to load rules");
      setData(body);
      setCompetitionTypeId(body.configuration.competitionTypeId ?? "");
      setVariantId(body.configuration.variantId ?? "");
      setRegistrationModeId(body.configuration.registrationModeId ?? "");
      setTeamFormationStrategyId(body.configuration.teamFormationStrategyId ?? "");
      setRuleProfileId(body.configuration.ruleProfileId ?? "");
      setRuleProfileVersion(body.configuration.ruleProfileVersion ?? "");
      setPresentationProfileId(body.configuration.presentationProfileId ?? "");
      setPresentationProfileVersion(body.configuration.presentationProfileVersion ?? "");
      setSquadRules(squadFromConfig(body.configuration.squadRules));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sportId = data?.configuration.sportId ?? "cricket";
  const locked = Boolean(data?.summary.status.locked || data?.plan || data?.configuration.locked);

  const competitions = useMemo(
    () => CatalogRegistry.listCompetitionTypes(sportId),
    [sportId],
  );
  const variants = useMemo(() => CatalogRegistry.listVariants(sportId), [sportId]);
  const registrationModes = useMemo(
    () => (competitionTypeId ? CatalogRegistry.listRegistrationModes(competitionTypeId) : []),
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

  const ruleProfiles = useMemo(() => {
    if (!variantId || !competitionTypeId) return [];
    return CatalogRegistry.listRuleProfiles({
      sportId,
      variantId,
      competitionTypeId,
    });
  }, [sportId, variantId, competitionTypeId]);

  const presentationProfiles = useMemo(() => {
    if (!variantId || !competitionTypeId) return [];
    return CatalogRegistry.listPresentationProfiles({
      sportId,
      variantId,
      competitionTypeId,
    });
  }, [sportId, variantId, competitionTypeId]);

  const selectedRuleProfile = useMemo(
    () =>
      ruleProfiles.find((p) => p.id === ruleProfileId && p.version === ruleProfileVersion) ??
      ruleProfiles.find((p) => p.id === ruleProfileId) ??
      null,
    [ruleProfiles, ruleProfileId, ruleProfileVersion],
  );

  // Suggest defaults when sport/competition/variant known but profiles empty.
  useEffect(() => {
    if (locked || !variantId || !competitionTypeId) return;
    if (ruleProfileId && presentationProfileId) return;
    const suggested = CatalogRegistry.suggestDefaults({
      sportId,
      variantId,
      competitionTypeId,
    });
    if (!ruleProfileId && suggested.ruleProfile) {
      setRuleProfileId(suggested.ruleProfile.id);
      setRuleProfileVersion(suggested.ruleProfile.version);
    }
    if (!presentationProfileId && suggested.presentationProfile) {
      setPresentationProfileId(suggested.presentationProfile.id);
      setPresentationProfileVersion(suggested.presentationProfile.version);
    }
  }, [
    locked,
    sportId,
    variantId,
    competitionTypeId,
    ruleProfileId,
    presentationProfileId,
  ]);

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
      if (!competitionTypeId || !registrationModeId) {
        throw new Error("Choose competition type and registration mode.");
      }
      if (!ruleProfileId || !presentationProfileId) {
        throw new Error("Choose rule and presentation profiles.");
      }

      const res = await apiFetch(`/tournaments/${tournamentId}/competition/configuration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionTypeId: competitionTypeId || null,
          variantId: variantId || null,
          registrationModeId: registrationModeId || null,
          teamFormationStrategyId: teamFormationStrategyId || null,
          ruleProfileId: ruleProfileId || null,
          ruleProfileVersion: ruleProfileVersion || null,
          presentationProfileId: presentationProfileId || null,
          presentationProfileVersion: presentationProfileVersion || null,
          squadRules: Object.keys(squadPayload).length > 0 ? squadPayload : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save rules");
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
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
      if (!res.ok) throw new Error(body.error || "Could not lock rules");
      await load();
      toast({ title: "Rules locked", description: "Next: apply them to matches." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lock failed");
    } finally {
      setLocking(false);
    }
  }

  async function handleApplyToMatches() {
    setApplying(true);
    setError("");
    try {
      const res = await apiFetch(
        `/tournaments/${tournamentId}/scoring/rules/apply-to-matches`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not apply rules to matches");
      const prepared = body.preparedCount ?? 0;
      const failed = body.failedCount ?? 0;
      if (failed > 0) {
        const firstError = (body.matchResults as Array<{ error?: string }> | undefined)?.find(
          (r) => r.error,
        )?.error;
        toast({
          title: `Applied to ${prepared} match${prepared === 1 ? "" : "es"}`,
          description: firstError
            ? `${failed} failed — ${firstError}`
            : `${failed} match${failed === 1 ? "" : "es"} still blocked`,
          variant: "destructive",
        });
      } else {
        toast({
          title: prepared > 0 ? "Matches ready to start" : "No cricket matches yet",
          description:
            prepared > 0
              ? "Open Matches & Scoring and start the match."
              : "Create a match, then apply again.",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  const canLock =
    !locked &&
    Boolean(competitionTypeId && registrationModeId && ruleProfileId && presentationProfileId);

  if (!scoringActive && !tournamentLoading) {
    return <CricketScoringSportRedirect tournamentId={tournamentId} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Rules & format"
        subtitle="Competition type, formation, rule profiles — lock once, then apply to matches."
        tournamentId={tournamentId}
      />

      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-5 max-w-3xl">
          {error ? (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              {error}
            </p>
          ) : null}

          {locked ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Rules are locked</p>
                <p className="text-xs text-muted-foreground">
                  Apply them to existing matches so Start match can use overs, XI, and bench limits.
                </p>
              </div>
            </div>
          ) : null}

          <section className={cn(hubPanelClass, "space-y-4 p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              Format & competition
            </h2>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Variant
              </p>
              <CatalogOptionList
                entries={variants}
                value={variantId}
                onSelect={(entry) => {
                  if (locked) return;
                  setVariantId(entry.id);
                  setRuleProfileId("");
                  setRuleProfileVersion("");
                  setPresentationProfileId("");
                  setPresentationProfileVersion("");
                }}
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Competition type
              </p>
              <CatalogOptionList
                entries={competitions}
                value={competitionTypeId}
                onSelect={(entry) => {
                  if (locked) return;
                  setCompetitionTypeId(entry.id);
                  setRegistrationModeId("");
                  setTeamFormationStrategyId("");
                  setRuleProfileId("");
                  setRuleProfileVersion("");
                  setPresentationProfileId("");
                  setPresentationProfileVersion("");
                }}
              />
            </div>
          </section>

          <section className={cn(hubPanelClass, "space-y-4 p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold">Formation & squad</h2>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Registration mode
              </p>
              <CatalogOptionList
                entries={registrationModes}
                value={registrationModeId}
                onSelect={(entry) => {
                  if (locked) return;
                  setRegistrationModeId(entry.id);
                }}
                emptyLabel="Select a competition type first."
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Team formation
              </p>
              <CatalogOptionList
                entries={teamFormationStrategies}
                value={teamFormationStrategyId}
                onSelect={(entry) => {
                  if (locked) return;
                  setTeamFormationStrategyId(entry.id);
                }}
                emptyLabel="Select a competition type first."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["minPlayers", "Min players"],
                  ["maxPlayers", "Max players"],
                  ["substitutes", "Substitutes"],
                  ["retentions", "Retentions"],
                ] as const
              ).map(([key, label]) => (
                <FormField key={key} label={label}>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    disabled={locked}
                    value={squadRules[key]}
                    onChange={(e) =>
                      setSquadRules((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </FormField>
              ))}
            </div>
          </section>

          <section className={cn(hubPanelClass, "space-y-4 p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold">Rule & presentation profiles</h2>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rule profile
              </p>
              <CatalogOptionList
                entries={ruleProfiles}
                value={ruleProfileId}
                onSelect={(entry) => {
                  if (locked) return;
                  setRuleProfileId(entry.id);
                  setRuleProfileVersion(entry.version);
                }}
                emptyLabel="Select variant and competition type first."
              />
              <RuleProfileCatalogPanel profile={selectedRuleProfile} />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Presentation profile
              </p>
              <CatalogOptionList
                entries={presentationProfiles}
                value={presentationProfileId}
                onSelect={(entry) => {
                  if (locked) return;
                  setPresentationProfileId(entry.id);
                  setPresentationProfileVersion(entry.version);
                }}
                emptyLabel="Select variant and competition type first."
              />
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-2 sticky bottom-3 z-10">
            {!locked ? (
              <>
                <BtnSecondary
                  className="flex-1"
                  disabled={saving || locking}
                  onClick={() => void persistSetup()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </BtnSecondary>
                <BtnPrimary
                  className="flex-1"
                  disabled={!canLock || locking || saving}
                  onClick={() => void handleLock()}
                >
                  {locking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Locking…
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Lock rules
                    </>
                  )}
                </BtnPrimary>
              </>
            ) : (
              <BtnPrimary
                className="flex-1"
                disabled={applying}
                onClick={() => void handleApplyToMatches()}
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Applying…
                  </>
                ) : (
                  "Apply to matches"
                )}
              </BtnPrimary>
            )}
          </div>
        </div>
      )}
    </CricketOrganizerPageShell>
  );
}
