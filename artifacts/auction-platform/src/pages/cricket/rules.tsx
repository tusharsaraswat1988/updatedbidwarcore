/**
 * Cricket Rules & format — chips for short catalogs + editable key rule overrides.
 * Route: /tournament/:id/score/rules
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  CatalogRegistry,
  type ConcreteRuleValue,
  type RuleProfileCatalogEntry,
} from "@workspace/platform-core/catalog";
import {
  CRICKET_KEY_RULE_OVERRIDE_IDS,
  sparseRuleOverrides,
  type RuleOverridesDocument,
} from "@workspace/platform-core/competition";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  getGetTournamentQueryKey,
  useGetTournament,
} from "@workspace/api-client-react";
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
    ruleOverrides: RuleOverridesDocument | null;
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

type Option = {
  id: string;
  version?: string;
  label: string;
  description?: string;
};

type KeyRulesDraft = {
  overs: string;
  maxWickets: string;
  playingSquadSize: string;
  benchSize: string;
  retireAtRuns: string;
  lbwEnabled: boolean;
  legByeEnabled: boolean;
  freeHitEnabled: boolean;
  playingXiEnforced: boolean;
  superBallEnabled: boolean;
  superOverEnabled: boolean;
  superOverOvers: string;
  superOverWickets: string;
  superOverTrigger: string;
};

const KEY_RULE_LABELS: Record<
  (typeof CRICKET_KEY_RULE_OVERRIDE_IDS)[number],
  string
> = {
  "cricket.match.overs_per_innings": "Overs per innings",
  "cricket.match.max_wickets": "Max wickets",
  "cricket.match.playing_squad_size": "Playing squad size",
  "cricket.match.playing_xi_enforced": "Exact Playing XI",
  "cricket.match.bench_size": "Bench size",
  "cricket.batting.retire_at_runs": "Retire at runs",
  "cricket.dismissal.lbw_enabled": "LBW",
  "cricket.extras.leg_bye_enabled": "Leg bye",
  "cricket.bowling.free_hit_enabled": "Free hit",
  "cricket.special.super_ball_enabled": "Super Ball",
  "cricket.tie_break.super_over_enabled": "Super Over",
  "cricket.tie_break.super_over_overs": "Super Over overs",
  "cricket.tie_break.super_over_wickets": "Super Over wickets",
  "cricket.tie_break.super_over_trigger": "Super Over trigger",
};

function squadFromConfig(
  squadRules?: CompetitionAggregate["configuration"]["squadRules"],
): SquadDraft {
  return {
    minPlayers:
      squadRules?.minPlayers != null ? String(squadRules.minPlayers) : "11",
    maxPlayers:
      squadRules?.maxPlayers != null ? String(squadRules.maxPlayers) : "15",
    substitutes:
      squadRules?.substitutes != null ? String(squadRules.substitutes) : "4",
    retentions:
      squadRules?.retentions != null ? String(squadRules.retentions) : "",
  };
}

function profileBaselineValues(
  profile: RuleProfileCatalogEntry | null,
): Record<string, ConcreteRuleValue> {
  const out: Record<string, ConcreteRuleValue> = {};
  if (!profile) return out;
  for (const entry of profile.values) {
    if (
      !CRICKET_KEY_RULE_OVERRIDE_IDS.includes(
        entry.definitionId as (typeof CRICKET_KEY_RULE_OVERRIDE_IDS)[number],
      )
    ) {
      continue;
    }
    if (entry.value === "inherit") continue;
    out[entry.definitionId] = entry.value;
  }
  return out;
}

function draftFromProfileAndOverrides(
  profile: RuleProfileCatalogEntry | null,
  overrides: RuleOverridesDocument | null,
): KeyRulesDraft {
  const base = profileBaselineValues(profile);
  const merged = { ...base, ...(overrides?.values ?? {}) };
  const num = (id: string, fallback: number) => {
    const v = merged[id];
    return typeof v === "number" ? String(v) : String(fallback);
  };
  const bool = (id: string, fallback: boolean) => {
    const v = merged[id];
    return typeof v === "boolean" ? v : fallback;
  };
  const retire = merged["cricket.batting.retire_at_runs"];
  return {
    overs: num("cricket.match.overs_per_innings", 20),
    maxWickets: num("cricket.match.max_wickets", 10),
    playingSquadSize: num("cricket.match.playing_squad_size", 11),
    benchSize: num("cricket.match.bench_size", 4),
    retireAtRuns: retire === null || retire === undefined ? "" : String(retire),
    lbwEnabled: bool("cricket.dismissal.lbw_enabled", true),
    legByeEnabled: bool("cricket.extras.leg_bye_enabled", true),
    freeHitEnabled: bool("cricket.bowling.free_hit_enabled", true),
    playingXiEnforced: bool("cricket.match.playing_xi_enforced", false),
    superBallEnabled: bool("cricket.special.super_ball_enabled", false),
    superOverEnabled: bool("cricket.tie_break.super_over_enabled", true),
    superOverOvers: num("cricket.tie_break.super_over_overs", 1),
    superOverWickets: num("cricket.tie_break.super_over_wickets", 2),
    superOverTrigger:
      typeof merged["cricket.tie_break.super_over_trigger"] === "string"
        ? String(merged["cricket.tie_break.super_over_trigger"])
        : "manual",
  };
}

function draftToEffectiveValues(
  draft: KeyRulesDraft,
): Record<string, ConcreteRuleValue> {
  const overs = parseInt(draft.overs, 10);
  const maxWickets = parseInt(draft.maxWickets, 10);
  const playingSquadSize = parseInt(draft.playingSquadSize, 10);
  const benchSize = parseInt(draft.benchSize, 10);
  const superOverOvers = parseInt(draft.superOverOvers, 10);
  const superOverWickets = parseInt(draft.superOverWickets, 10);
  const retireRaw = draft.retireAtRuns.trim();
  const retireAtRuns = retireRaw === "" ? null : parseInt(retireRaw, 10);
  return {
    "cricket.match.overs_per_innings": Number.isFinite(overs) ? overs : 20,
    "cricket.match.max_wickets": Number.isFinite(maxWickets) ? maxWickets : 10,
    "cricket.match.playing_squad_size": Number.isFinite(playingSquadSize)
      ? playingSquadSize
      : 11,
    "cricket.match.playing_xi_enforced": draft.playingXiEnforced,
    "cricket.match.bench_size": Number.isFinite(benchSize) ? benchSize : 4,
    "cricket.batting.retire_at_runs":
      retireAtRuns != null && Number.isFinite(retireAtRuns)
        ? retireAtRuns
        : null,
    "cricket.dismissal.lbw_enabled": draft.lbwEnabled,
    "cricket.extras.leg_bye_enabled": draft.legByeEnabled,
    "cricket.bowling.free_hit_enabled": draft.freeHitEnabled,
    "cricket.special.super_ball_enabled": draft.superBallEnabled,
    "cricket.tie_break.super_over_enabled": draft.superOverEnabled,
    "cricket.tie_break.super_over_overs": Number.isFinite(superOverOvers)
      ? superOverOvers
      : 1,
    "cricket.tie_break.super_over_wickets": Number.isFinite(superOverWickets)
      ? superOverWickets
      : 2,
    "cricket.tie_break.super_over_trigger":
      draft.superOverTrigger === "knockout_tie" ? "knockout_tie" : "manual",
  };
}

function OptionChips({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  disabled?: boolean;
  onChange: (id: string, version?: string) => void;
}) {
  return (
    <FormField label={label}>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No options available for this sport.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const selected = o.id === value;
            return (
              <button
                key={`${o.id}@${o.version ?? "v"}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(o.id, o.version)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors text-left",
                  selected
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border",
                  disabled && "opacity-60 cursor-not-allowed",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {value ? (
        <p className="text-xs text-muted-foreground mt-1.5">
          {options.find((o) => o.id === value)?.description ?? null}
        </p>
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
    variants.find((v) => v.id === "cricket.outdoor")?.id ??
    variants[0]?.id ??
    "";
  const competitionTypeId =
    competitions.find((c) => c.id === "auction")?.id ??
    competitions[0]?.id ??
    "";
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

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(
    tournamentId,
    {
      query: {
        queryKey: getGetTournamentQueryKey(tournamentId),
        enabled: !!tournamentId,
      },
    },
  );
  const scoringActive = useCricketScoringActive(
    tournament?.sport,
    tournament?.scoringEnabled,
  );

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
  const [presentationProfileVersion, setPresentationProfileVersion] =
    useState("");
  const [squadRules, setSquadRules] = useState<SquadDraft>(squadFromConfig());
  const [keyRules, setKeyRules] = useState<KeyRulesDraft>(() =>
    draftFromProfileAndOverrides(null, null),
  );

  const sportId = (
    data?.configuration.sportId ||
    tournament?.sport ||
    "cricket"
  ).toLowerCase();
  const locked = Boolean(
    data?.summary.status.locked || data?.plan || data?.configuration.locked,
  );

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/competition`);
      const body = (await res
        .json()
        .catch(() => ({}))) as CompetitionAggregate & {
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Failed to load rules");
      setData(body);

      const sid = (body.configuration.sportId || "cricket").toLowerCase();
      const seeded = seedCricketDefaults(sid);
      const cfg = body.configuration;

      const nextRuleId = cfg.ruleProfileId || seeded.ruleProfileId;
      const nextRuleVersion =
        cfg.ruleProfileVersion || seeded.ruleProfileVersion;
      setVariantId(cfg.variantId || seeded.variantId);
      setCompetitionTypeId(cfg.competitionTypeId || seeded.competitionTypeId);
      setRegistrationModeId(
        cfg.registrationModeId || seeded.registrationModeId,
      );
      setTeamFormationStrategyId(
        cfg.teamFormationStrategyId || seeded.teamFormationStrategyId,
      );
      setRuleProfileId(nextRuleId);
      setRuleProfileVersion(nextRuleVersion);
      setPresentationProfileId(
        cfg.presentationProfileId || seeded.presentationProfileId,
      );
      setPresentationProfileVersion(
        cfg.presentationProfileVersion || seeded.presentationProfileVersion,
      );
      setSquadRules(squadFromConfig(cfg.squadRules));
      const profile =
        CatalogRegistry.getRuleProfile(nextRuleId, nextRuleVersion) ??
        CatalogRegistry.getRuleProfile(nextRuleId) ??
        null;
      setKeyRules(
        draftFromProfileAndOverrides(profile, cfg.ruleOverrides ?? null),
      );
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

  const baseline = useMemo(
    () => profileBaselineValues(selectedRuleProfile),
    [selectedRuleProfile],
  );
  const effectiveValues = useMemo(
    () => draftToEffectiveValues(keyRules),
    [keyRules],
  );
  const pendingOverrides = useMemo(
    () => sparseRuleOverrides(baseline, effectiveValues),
    [baseline, effectiveValues],
  );
  const isCustomised = Boolean(pendingOverrides);

  const otherPresetRules = useMemo(() => {
    if (!selectedRuleProfile) return [];
    return selectedRuleProfile.values.filter(
      (entry) =>
        !CRICKET_KEY_RULE_OVERRIDE_IDS.includes(
          entry.definitionId as (typeof CRICKET_KEY_RULE_OVERRIDE_IDS)[number],
        ),
    );
  }, [selectedRuleProfile]);

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
      const nextId =
        suggested.ruleProfile?.id ?? ruleProfileOptions[0]?.id ?? "";
      const nextVersion =
        suggested.ruleProfile?.version ?? ruleProfileOptions[0]?.version ?? "";
      setRuleProfileId(nextId);
      setRuleProfileVersion(nextVersion);
      const profile =
        CatalogRegistry.getRuleProfile(nextId, nextVersion) ??
        CatalogRegistry.getRuleProfile(nextId) ??
        null;
      setKeyRules(draftFromProfileAndOverrides(profile, null));
    }
    if (!presentationOptions.some((o) => o.id === presentationProfileId)) {
      setPresentationProfileId(
        suggested.presentationProfile?.id ?? presentationOptions[0]?.id ?? "",
      );
      setPresentationProfileVersion(
        suggested.presentationProfile?.version ??
          presentationOptions[0]?.version ??
          "",
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

  function selectRuleProfile(id: string, version?: string) {
    setRuleProfileId(id);
    setRuleProfileVersion(version ?? "");
    const profile =
      CatalogRegistry.getRuleProfile(id, version) ??
      CatalogRegistry.getRuleProfile(id) ??
      null;
    // Spec: changing profile clears overrides — reset draft to profile defaults.
    setKeyRules(draftFromProfileAndOverrides(profile, null));
  }

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
      if (
        !variantId ||
        !competitionTypeId ||
        !registrationModeId ||
        !teamFormationStrategyId
      ) {
        throw new Error("Complete format, registration, and formation.");
      }
      if (!ruleProfileId || !presentationProfileId) {
        throw new Error("Choose playing rules and display look.");
      }

      const overs = parseInt(keyRules.overs, 10);
      const maxWickets = parseInt(keyRules.maxWickets, 10);
      const xi = parseInt(keyRules.playingSquadSize, 10);
      const bench = parseInt(keyRules.benchSize, 10);
      if (!Number.isFinite(overs) || overs < 1)
        throw new Error("Overs per innings must be ≥ 1");
      if (!Number.isFinite(maxWickets) || maxWickets < 1)
        throw new Error("Max wickets must be ≥ 1");
      if (!Number.isFinite(xi) || xi < 0)
        throw new Error("Playing squad size must be ≥ 0");
      if (!Number.isFinite(bench) || bench < 0)
        throw new Error("Bench size must be ≥ 0");
      if (keyRules.retireAtRuns.trim() !== "") {
        const retire = parseInt(keyRules.retireAtRuns, 10);
        if (!Number.isFinite(retire) || retire < 1) {
          throw new Error("Retire at runs must be empty or ≥ 1");
        }
      }

      const res = await apiFetch(
        `/tournaments/${tournamentId}/competition/configuration`,
        {
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
            squadRules:
              Object.keys(squadPayload).length > 0 ? squadPayload : null,
            ruleOverrides: pendingOverrides,
          }),
        },
      );
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
      const res = await apiFetch(
        `/tournaments/${tournamentId}/competition/ready`,
        {
          method: "POST",
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not lock rules");
      await load();
      toast({
        title: "Rules locked",
        description: "Next: apply them to matches.",
      });
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
      if (!res.ok)
        throw new Error(body.error || "Could not apply rules to matches");
      const prepared = body.preparedCount ?? 0;
      const failed = body.failedCount ?? 0;
      if (failed > 0) {
        const firstError = (
          body.matchResults as Array<{ error?: string }> | undefined
        )?.find((r) => r.error)?.error;
        toast({
          title: `Applied to ${prepared} match${prepared === 1 ? "" : "es"}`,
          description: firstError
            ? `${failed} failed — ${firstError}`
            : `${failed} match${failed === 1 ? "" : "es"} still blocked`,
          variant: "destructive",
        });
      } else {
        toast({
          title:
            prepared > 0 ? "Matches ready to start" : "No cricket matches yet",
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
    return (
      <CricketScoringSportRedirect
        tournamentId={tournamentId}
        sport={tournament?.sport}
      />
    );
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
                <p className="text-sm font-semibold text-foreground">
                  Rules are locked
                </p>
                <p className="text-xs text-muted-foreground">
                  Apply them to matches so Start match gets overs, XI, and bench
                  limits.
                </p>
              </div>
            </div>
          ) : null}

          <section className={cn(hubPanelClass, "space-y-4 p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              1. Format
            </h2>
            <OptionChips
              label="Cricket type"
              value={variantId}
              options={variantOptions}
              disabled={locked}
              onChange={(id) => setVariantId(id)}
            />
            <OptionChips
              label="Competition type"
              value={competitionTypeId}
              options={competitionOptions}
              disabled={locked}
              onChange={(id) => setCompetitionTypeId(id)}
            />
          </section>

          <section className={cn(hubPanelClass, "space-y-4 p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold">2. Formation & squad</h2>
            <OptionChips
              label="Player registration"
              value={registrationModeId}
              options={registrationOptions}
              disabled={locked}
              onChange={(id) => setRegistrationModeId(id)}
            />
            <OptionChips
              label="Team formation"
              value={teamFormationStrategyId}
              options={formationOptions}
              disabled={locked}
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
                      setSquadRules((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                  />
                </FormField>
              ))}
            </div>
          </section>

          <section className={cn(hubPanelClass, "space-y-4 p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold">
              3. Playing & display rules
            </h2>
            <OptionChips
              label="Playing rules preset"
              value={ruleProfileId}
              options={ruleProfileOptions}
              disabled={locked}
              onChange={(id, version) => selectRuleProfile(id, version)}
            />

            {selectedRuleProfile ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    {selectedRuleProfile.displayName}
                  </p>
                  {isCustomised ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                      Customised from preset
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label={KEY_RULE_LABELS["cricket.match.overs_per_innings"]}
                  >
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      disabled={locked}
                      value={keyRules.overs}
                      onChange={(e) =>
                        setKeyRules((p) => ({ ...p, overs: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField
                    label={KEY_RULE_LABELS["cricket.match.max_wickets"]}
                  >
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      disabled={locked}
                      value={keyRules.maxWickets}
                      onChange={(e) =>
                        setKeyRules((p) => ({
                          ...p,
                          maxWickets: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField
                    label={KEY_RULE_LABELS["cricket.match.playing_squad_size"]}
                  >
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      disabled={locked}
                      value={keyRules.playingSquadSize}
                      onChange={(e) =>
                        setKeyRules((p) => ({
                          ...p,
                          playingSquadSize: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField
                    label={KEY_RULE_LABELS["cricket.match.bench_size"]}
                  >
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      disabled={locked}
                      value={keyRules.benchSize}
                      onChange={(e) =>
                        setKeyRules((p) => ({
                          ...p,
                          benchSize: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField
                    label={KEY_RULE_LABELS["cricket.batting.retire_at_runs"]}
                  >
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      disabled={locked}
                      placeholder="None"
                      value={keyRules.retireAtRuns}
                      onChange={(e) =>
                        setKeyRules((p) => ({
                          ...p,
                          retireAtRuns: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setKeyRules((p) => ({ ...p, lbwEnabled: !p.lbwEnabled }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold",
                      keyRules.lbwEnabled
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/70 text-muted-foreground",
                      locked && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    LBW {keyRules.lbwEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setKeyRules((p) => ({
                        ...p,
                        freeHitEnabled: !p.freeHitEnabled,
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold",
                      keyRules.freeHitEnabled
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/70 text-muted-foreground",
                      locked && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    Free hit {keyRules.freeHitEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setKeyRules((p) => ({
                        ...p,
                        legByeEnabled: !p.legByeEnabled,
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold",
                      keyRules.legByeEnabled
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/70 text-muted-foreground",
                      locked && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    Leg bye {keyRules.legByeEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setKeyRules((p) => ({
                        ...p,
                        playingXiEnforced: !p.playingXiEnforced,
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold",
                      keyRules.playingXiEnforced
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/70 text-muted-foreground",
                      locked && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    Exact XI {keyRules.playingXiEnforced ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setKeyRules((p) => ({
                        ...p,
                        superBallEnabled: !p.superBallEnabled,
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold",
                      keyRules.superBallEnabled
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-500"
                        : "border-border/70 text-muted-foreground",
                      locked && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    Super Ball {keyRules.superBallEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setKeyRules((p) => ({
                        ...p,
                        superOverEnabled: !p.superOverEnabled,
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold",
                      keyRules.superOverEnabled
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/70 text-muted-foreground",
                      locked && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    Super Over {keyRules.superOverEnabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField
                    label={
                      KEY_RULE_LABELS["cricket.tie_break.super_over_overs"]
                    }
                  >
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      disabled={locked}
                      value={keyRules.superOverOvers}
                      onChange={(e) =>
                        setKeyRules((p) => ({
                          ...p,
                          superOverOvers: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField
                    label={
                      KEY_RULE_LABELS["cricket.tie_break.super_over_wickets"]
                    }
                  >
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      disabled={locked}
                      value={keyRules.superOverWickets}
                      onChange={(e) =>
                        setKeyRules((p) => ({
                          ...p,
                          superOverWickets: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField
                    label={
                      KEY_RULE_LABELS["cricket.tie_break.super_over_trigger"]
                    }
                  >
                    <select
                      className={inputClass}
                      disabled={locked}
                      value={keyRules.superOverTrigger}
                      onChange={(e) =>
                        setKeyRules((p) => ({
                          ...p,
                          superOverTrigger: e.target.value,
                        }))
                      }
                    >
                      <option value="manual">Manual</option>
                      <option value="knockout_tie">Knockout tie only</option>
                    </select>
                  </FormField>
                </div>
                {otherPresetRules.length > 0 ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-semibold text-foreground/80">
                      Other rules from preset
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {otherPresetRules.map((entry) => {
                        const def = CatalogRegistry.getRuleDefinition(
                          entry.definitionId,
                          entry.definitionVersion,
                        );
                        return (
                          <li
                            key={`${entry.definitionId}@${entry.definitionVersion}`}
                            className="flex justify-between gap-3"
                          >
                            <span>{def?.name ?? entry.definitionId}</span>
                            <span className="font-mono shrink-0">
                              {entry.value === null
                                ? "null"
                                : String(entry.value)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}

            <OptionChips
              label="LED / screen look"
              value={presentationProfileId}
              options={presentationOptions}
              disabled={locked}
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
