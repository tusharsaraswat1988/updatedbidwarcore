/**
 * Cricket Rules & format — complete linear form (no empty “select first” stubs).
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
import { RuleProfileCatalogPanel } from "@/components/tournament-creation/rule-profile-catalog-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Option = { id: string; version?: string; label: string; description?: string };

function squadFromConfig(
  squadRules?: CompetitionAggregate["configuration"]["squadRules"],
): SquadDraft {
  return {
    minPlayers: squadRules?.minPlayers != null ? String(squadRules.minPlayers) : "11",
    maxPlayers: squadRules?.maxPlayers != null ? String(squadRules.maxPlayers) : "15",
    substitutes: squadRules?.substitutes != null ? String(squadRules.substitutes) : "4",
    retentions: squadRules?.retentions != null ? String(squadRules.retentions) : "",
  };
}

function OptionSelect({
  label,
  value,
  options,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  disabled?: boolean;
  placeholder: string;
  onChange: (id: string, version?: string) => void;
}) {
  return (
    <FormField label={label}>
      <Select
        value={value || undefined}
        disabled={disabled || options.length === 0}
        onValueChange={(id) => {
          const match = options.find((o) => o.id === id);
          onChange(id, match?.version);
        }}
      >
        <SelectTrigger className="h-11 w-full bg-background">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={`${o.id}@${o.version ?? "v"}`} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value ? (
        <p className="text-xs text-muted-foreground mt-1.5">
          {options.find((o) => o.id === value)?.description ?? null}
        </p>
      ) : null}
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-1.5">No options available for this sport.</p>
      ) : null}
    </FormField>
  );
}

function seedCricketDefaults(sportId: string): {
  variantId: string;
  competitionTypeId: string;
  registrationModeId: string;
  teamFormationStrategyId: string;
  ruleProfileId: string;
  ruleProfileVersion: string;
  presentationProfileId: string;
  presentationProfileVersion: string;
} {
  const variants = CatalogRegistry.listVariants(sportId);
  const competitions = CatalogRegistry.listCompetitionTypes(sportId);
  const variantId =
    variants.find((v) => v.id === "cricket.outdoor")?.id ?? variants[0]?.id ?? "";
  const competitionTypeId =
    competitions.find((c) => c.id === "auction")?.id ?? competitions[0]?.id ?? "";
  const registrationModeId =
    CatalogRegistry.suggestRegistrationModeId(competitionTypeId) ??
    CatalogRegistry.listRegistrationModes(competitionTypeId)[0]?.id ??
    "";
  const teamFormationStrategyId =
    CatalogRegistry.suggestTeamFormationStrategyId(competitionTypeId) ??
    CatalogRegistry.listTeamFormationStrategies(competitionTypeId)[0]?.id ??
    "";
  const suggested = CatalogRegistry.suggestDefaults({
    sportId,
    variantId,
    competitionTypeId,
  });
  return {
    variantId,
    competitionTypeId,
    registrationModeId,
    teamFormationStrategyId,
    ruleProfileId: suggested.ruleProfile?.id ?? "",
    ruleProfileVersion: suggested.ruleProfile?.version ?? "",
    presentationProfileId: suggested.presentationProfile?.id ?? "",
    presentationProfileVersion: suggested.presentationProfile?.version ?? "",
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

  const sportId = (data?.configuration.sportId || tournament?.sport || "cricket").toLowerCase();
  const locked = Boolean(data?.summary.status.locked || data?.plan || data?.configuration.locked);

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

      const sid = (body.configuration.sportId || "cricket").toLowerCase();
      const seeded = seedCricketDefaults(sid);
      const cfg = body.configuration;

      setVariantId(cfg.variantId || seeded.variantId);
      setCompetitionTypeId(cfg.competitionTypeId || seeded.competitionTypeId);
      setRegistrationModeId(cfg.registrationModeId || seeded.registrationModeId);
      setTeamFormationStrategyId(
        cfg.teamFormationStrategyId || seeded.teamFormationStrategyId,
      );
      setRuleProfileId(cfg.ruleProfileId || seeded.ruleProfileId);
      setRuleProfileVersion(cfg.ruleProfileVersion || seeded.ruleProfileVersion);
      setPresentationProfileId(cfg.presentationProfileId || seeded.presentationProfileId);
      setPresentationProfileVersion(
        cfg.presentationProfileVersion || seeded.presentationProfileVersion,
      );
      setSquadRules(squadFromConfig(cfg.squadRules));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const variantOptions: Option[] = useMemo(
    () =>
      CatalogRegistry.listVariants(sportId).map((v) => ({
        id: v.id,
        version: v.version,
        label: v.displayName,
        description: v.description,
      })),
    [sportId],
  );

  const competitionOptions: Option[] = useMemo(
    () =>
      CatalogRegistry.listCompetitionTypes(sportId).map((c) => ({
        id: c.id,
        version: c.version,
        label: c.displayName,
        description: c.description,
      })),
    [sportId],
  );

  const registrationOptions: Option[] = useMemo(
    () =>
      (competitionTypeId
        ? CatalogRegistry.listRegistrationModes(competitionTypeId)
        : []
      ).map((r) => ({
        id: r.id,
        version: r.version,
        label: r.displayName,
        description: r.description,
      })),
    [competitionTypeId],
  );

  const formationOptions: Option[] = useMemo(() => {
    const entries = competitionTypeId
      ? CatalogRegistry.listTeamFormationStrategies(competitionTypeId)
      : [];
    const caps = getSportCapabilities(sportId);
    return entries
      .filter((entry) => (caps.hasCaptain ? true : entry.id !== "captain_pick"))
      .map((f) => ({
        id: f.id,
        version: f.version,
        label: f.displayName,
        description: f.description,
      }));
  }, [competitionTypeId, sportId]);

  const ruleProfileOptions: Option[] = useMemo(() => {
    if (!variantId || !competitionTypeId) return [];
    return CatalogRegistry.listRuleProfiles({
      sportId,
      variantId,
      competitionTypeId,
    }).map((p) => ({
      id: p.id,
      version: p.version,
      label: p.displayName,
      description: p.description,
    }));
  }, [sportId, variantId, competitionTypeId]);

  const presentationOptions: Option[] = useMemo(() => {
    if (!variantId || !competitionTypeId) return [];
    return CatalogRegistry.listPresentationProfiles({
      sportId,
      variantId,
      competitionTypeId,
    }).map((p) => ({
      id: p.id,
      version: p.version,
      label: p.displayName,
      description: p.description,
    }));
  }, [sportId, variantId, competitionTypeId]);

  const selectedRuleProfile = useMemo(
    () =>
      CatalogRegistry.getRuleProfile(ruleProfileId, ruleProfileVersion) ??
      CatalogRegistry.getRuleProfile(ruleProfileId) ??
      null,
    [ruleProfileId, ruleProfileVersion],
  );

  // Keep dependent fields valid when parent selection changes.
  useEffect(() => {
    if (locked || !competitionTypeId) return;
    if (!registrationOptions.some((o) => o.id === registrationModeId)) {
      const next =
        CatalogRegistry.suggestRegistrationModeId(competitionTypeId) ??
        registrationOptions[0]?.id ??
        "";
      setRegistrationModeId(next);
    }
    if (!formationOptions.some((o) => o.id === teamFormationStrategyId)) {
      const next =
        CatalogRegistry.suggestTeamFormationStrategyId(competitionTypeId) ??
        formationOptions[0]?.id ??
        "";
      setTeamFormationStrategyId(next);
    }
  }, [
    locked,
    competitionTypeId,
    registrationModeId,
    teamFormationStrategyId,
    registrationOptions,
    formationOptions,
  ]);

  useEffect(() => {
    if (locked || !variantId || !competitionTypeId) return;
    const suggested = CatalogRegistry.suggestDefaults({
      sportId,
      variantId,
      competitionTypeId,
    });
    if (!ruleProfileOptions.some((o) => o.id === ruleProfileId)) {
      setRuleProfileId(suggested.ruleProfile?.id ?? ruleProfileOptions[0]?.id ?? "");
      setRuleProfileVersion(
        suggested.ruleProfile?.version ?? ruleProfileOptions[0]?.version ?? "",
      );
    }
    if (!presentationOptions.some((o) => o.id === presentationProfileId)) {
      setPresentationProfileId(
        suggested.presentationProfile?.id ?? presentationOptions[0]?.id ?? "",
      );
      setPresentationProfileVersion(
        suggested.presentationProfile?.version ?? presentationOptions[0]?.version ?? "",
      );
    }
  }, [
    locked,
    sportId,
    variantId,
    competitionTypeId,
    ruleProfileId,
    presentationProfileId,
    ruleProfileOptions,
    presentationOptions,
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
      if (!variantId || !competitionTypeId || !registrationModeId || !teamFormationStrategyId) {
        throw new Error("Complete format, registration, and formation.");
      }
      if (!ruleProfileId || !presentationProfileId) {
        throw new Error("Choose playing rules and display look.");
      }

      const res = await apiFetch(`/tournaments/${tournamentId}/competition/configuration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionTypeId,
          variantId,
          registrationModeId,
          teamFormationStrategyId,
          ruleProfileId,
          ruleProfileVersion: ruleProfileVersion || null,
          presentationProfileId,
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
    Boolean(
      variantId &&
        competitionTypeId &&
        registrationModeId &&
        teamFormationStrategyId &&
        ruleProfileId &&
        presentationProfileId,
    );

  if (!scoringActive && !tournamentLoading) {
    return <CricketScoringSportRedirect tournamentId={tournamentId} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Rules & format"
        subtitle="Set how this cricket tournament plays, then lock and apply to matches."
        tournamentId={tournamentId}
      />

      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-5 max-w-2xl pb-24">
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
                  Apply them to matches so Start match gets overs, XI, and bench limits.
                </p>
              </div>
            </div>
          ) : null}

          <section className={cn(hubPanelClass, "space-y-4 p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              1. Format
            </h2>
            <OptionSelect
              label="Cricket type"
              value={variantId}
              options={variantOptions}
              disabled={locked}
              placeholder="Choose cricket type"
              onChange={(id) => setVariantId(id)}
            />
            <OptionSelect
              label="Competition type"
              value={competitionTypeId}
              options={competitionOptions}
              disabled={locked}
              placeholder="Choose competition type"
              onChange={(id) => setCompetitionTypeId(id)}
            />
          </section>

          <section className={cn(hubPanelClass, "space-y-4 p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold">2. Formation & squad</h2>
            <OptionSelect
              label="Player registration"
              value={registrationModeId}
              options={registrationOptions}
              disabled={locked}
              placeholder="Choose registration mode"
              onChange={(id) => setRegistrationModeId(id)}
            />
            <OptionSelect
              label="Team formation"
              value={teamFormationStrategyId}
              options={formationOptions}
              disabled={locked}
              placeholder="Choose how teams are formed"
              onChange={(id) => setTeamFormationStrategyId(id)}
            />
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
            <h2 className="text-sm font-semibold">3. Playing & display rules</h2>
            <OptionSelect
              label="Playing rules"
              value={ruleProfileId}
              options={ruleProfileOptions}
              disabled={locked}
              placeholder="Choose playing rules"
              onChange={(id, version) => {
                setRuleProfileId(id);
                setRuleProfileVersion(version ?? "");
              }}
            />
            {selectedRuleProfile ? (
              <RuleProfileCatalogPanel profile={selectedRuleProfile} />
            ) : null}
            <OptionSelect
              label="LED / screen look"
              value={presentationProfileId}
              options={presentationOptions}
              disabled={locked}
              placeholder="Choose display look"
              onChange={(id, version) => {
                setPresentationProfileId(id);
                setPresentationProfileVersion(version ?? "");
              }}
            />
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
