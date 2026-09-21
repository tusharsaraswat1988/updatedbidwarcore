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
} from "@/components/scoring/cricket-page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  getGetTournamentQueryKey,
  useGetTournament,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  PlayCircle,
  Scale,
  Settings2,
  Sliders,
  Sparkles,
  Trophy,
  Unlock,
  Users,
  Zap,
} from "lucide-react";

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
  ballsPerOver: string;
  ballType: string;
  retireAtRuns: string;
  lbwEnabled: boolean;
  legByeEnabled: boolean;
  freeHitEnabled: boolean;
  powerplayEnabled: boolean;
  playingXiEnforced: boolean;
  superBallEnabled: boolean;
  superBallDoublesBoundariesOnly: boolean;
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
  "cricket.match.balls_per_over": "Balls per over",
  "cricket.match.ball_type": "Ball type",
  "cricket.batting.retire_at_runs": "Retire at runs",
  "cricket.dismissal.lbw_enabled": "LBW",
  "cricket.extras.leg_bye_enabled": "Leg bye",
  "cricket.bowling.free_hit_enabled": "Free hit",
  "cricket.powerplay.enabled": "Powerplay",
  "cricket.special.super_ball_enabled": "Super Ball",
  "cricket.special.super_ball_doubles_boundaries_only": "Super Ball Doubling Mode",
  "cricket.tie_break.super_over_enabled": "Super Over",
  "cricket.tie_break.super_over_overs": "Super Over overs",
  "cricket.tie_break.super_over_wickets": "Super Over wickets",
  "cricket.tie_break.super_over_trigger": "Super Over trigger",
};

const BALL_TYPE_OPTIONS: Array<{ id: string; label: string; description: string }> = [
  { id: "leather", label: "Leather Ball", description: "Standard professional leather cricket ball." },
  { id: "tennis", label: "Tennis Ball", description: "Heavy or light tennis ball for turf & community games." },
  { id: "tape", label: "Tape Ball", description: "Fast-action taped tennis ball format." },
  { id: "indoor", label: "Indoor / Soft", description: "Soft synthetic ball for indoor turf and arena games." },
];

function squadFromConfig(
  squadRules?: CompetitionAggregate["configuration"]["squadRules"],
): SquadDraft {
  return {
    minPlayers:
      squadRules?.minPlayers != null ? String(squadRules.minPlayers) : "6",
    maxPlayers:
      squadRules?.maxPlayers != null ? String(squadRules.maxPlayers) : "15",
    substitutes:
      squadRules?.substitutes != null ? String(squadRules.substitutes) : "2",
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
  const str = (id: string, fallback: string) => {
    const v = merged[id];
    return typeof v === "string" ? v : fallback;
  };
  const retire = merged["cricket.batting.retire_at_runs"];
  return {
    overs: num("cricket.match.overs_per_innings", 6),
    maxWickets: num("cricket.match.max_wickets", 10),
    playingSquadSize: num("cricket.match.playing_squad_size", 8),
    benchSize: num("cricket.match.bench_size", 2),
    ballsPerOver: num("cricket.match.balls_per_over", 6),
    ballType: str("cricket.match.ball_type", "tennis"),
    retireAtRuns: retire === null || retire === undefined ? "" : String(retire),
    lbwEnabled: bool("cricket.dismissal.lbw_enabled", false),
    legByeEnabled: bool("cricket.extras.leg_bye_enabled", true),
    freeHitEnabled: bool("cricket.bowling.free_hit_enabled", true),
    powerplayEnabled: bool("cricket.powerplay.enabled", false),
    playingXiEnforced: bool("cricket.match.playing_xi_enforced", false),
    superBallEnabled: bool("cricket.special.super_ball_enabled", false),
    superBallDoublesBoundariesOnly: bool("cricket.special.super_ball_doubles_boundaries_only", true),
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
  const ballsPerOver = parseInt(draft.ballsPerOver, 10);
  const superOverOvers = parseInt(draft.superOverOvers, 10);
  const superOverWickets = parseInt(draft.superOverWickets, 10);
  const retireRaw = draft.retireAtRuns.trim();
  const retireAtRuns = retireRaw === "" ? null : parseInt(retireRaw, 10);
  return {
    "cricket.match.overs_per_innings": Number.isFinite(overs) ? overs : 6,
    "cricket.match.max_wickets": Number.isFinite(maxWickets) ? maxWickets : 10,
    "cricket.match.playing_squad_size": Number.isFinite(playingSquadSize)
      ? playingSquadSize
      : 8,
    "cricket.match.playing_xi_enforced": draft.playingXiEnforced,
    "cricket.match.bench_size": Number.isFinite(benchSize) ? benchSize : 2,
    "cricket.match.balls_per_over": Number.isFinite(ballsPerOver) ? ballsPerOver : 6,
    "cricket.match.ball_type": draft.ballType || "tennis",
    "cricket.batting.retire_at_runs":
      retireAtRuns != null && Number.isFinite(retireAtRuns)
        ? retireAtRuns
        : null,
    "cricket.dismissal.lbw_enabled": draft.lbwEnabled,
    "cricket.extras.leg_bye_enabled": draft.legByeEnabled,
    "cricket.bowling.free_hit_enabled": draft.freeHitEnabled,
    "cricket.powerplay.enabled": draft.powerplayEnabled,
    "cricket.special.super_ball_enabled": draft.superBallEnabled,
    "cricket.special.super_ball_doubles_boundaries_only": draft.superBallDoublesBoundariesOnly,
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
  const selectedOption = options.find((o) => o.id === value);
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90 block">
        {label}
      </label>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No options available for this selection.
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
                  "relative rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all duration-150 text-left flex items-center gap-2",
                  selected
                    ? "border-primary bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40 font-bold"
                    : "border-border/80 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border",
                  disabled && "opacity-60 cursor-not-allowed",
                )}
              >
                {selected ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                ) : null}
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {selectedOption?.description ? (
        <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 text-primary/70 shrink-0 mt-0.5" />
          <span>{selectedOption.description}</span>
        </div>
      ) : null}
    </div>
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
  const [unlocking, setUnlocking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [lastAppliedCount, setLastAppliedCount] = useState<number | null>(null);
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

  // Primary 3 Cricket Variants for clean UI
  const variantOptions: Option[] = useMemo(() => {
    const all = CatalogRegistry.listVariants(sportId);
    const primaryIds = ["cricket.outdoor", "cricket.box", "cricket.custom"];
    return all
      .filter((v) => primaryIds.includes(v.id))
      .map((v) => ({
        id: v.id,
        version: v.version,
        label: v.displayName,
        description: v.description,
      }));
  }, [sportId]);

  const ruleProfileOptions: Option[] = useMemo(() => {
    if (!variantId) return [];
    return CatalogRegistry.listRuleProfiles({
      sportId,
      variantId,
      competitionTypeId: competitionTypeId || "auction",
    }).map((p) => ({
      id: p.id,
      version: p.version,
      label: p.displayName,
      description: p.description,
    }));
  }, [sportId, variantId, competitionTypeId]);

  const presentationOptions: Option[] = useMemo(() => {
    if (!variantId) return [];
    return CatalogRegistry.listPresentationProfiles({
      sportId,
      variantId,
      competitionTypeId: competitionTypeId || "auction",
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

  // Ensure variant is valid
  useEffect(() => {
    if (locked) return;
    if (variantOptions.length > 0 && !variantOptions.some((o) => o.id === variantId)) {
      setVariantId(variantOptions[0].id);
    }
  }, [locked, variantId, variantOptions]);

  // Keep dependent defaults valid
  useEffect(() => {
    if (locked || !variantId) return;
    const compType = competitionTypeId || "auction";
    const suggested = CatalogRegistry.suggestDefaults({
      sportId,
      variantId,
      competitionTypeId: compType,
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
      if (!variantId) {
        throw new Error("Select a cricket type format.");
      }
      if (!ruleProfileId || !presentationProfileId) {
        throw new Error("Choose playing rules and display look.");
      }

      const overs = parseInt(keyRules.overs, 10);
      const maxWickets = parseInt(keyRules.maxWickets, 10);
      const xi = parseInt(keyRules.playingSquadSize, 10);
      const bench = parseInt(keyRules.benchSize, 10);
      const ballsPerOver = parseInt(keyRules.ballsPerOver, 10);
      if (!Number.isFinite(overs) || overs < 1)
        throw new Error("Overs per innings must be ≥ 1");
      if (!Number.isFinite(maxWickets) || maxWickets < 1)
        throw new Error("Max wickets must be ≥ 1");
      if (!Number.isFinite(xi) || xi < 0)
        throw new Error("Playing squad size must be ≥ 0");
      if (!Number.isFinite(bench) || bench < 0)
        throw new Error("Bench size must be ≥ 0");
      if (!Number.isFinite(ballsPerOver) || ballsPerOver < 1)
        throw new Error("Balls per over must be between 1 and 10");
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
            competitionTypeId: competitionTypeId || "auction",
            variantId,
            registrationModeId: registrationModeId || "team",
            teamFormationStrategyId: teamFormationStrategyId || "manual",
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
        title: "Rules locked & finalized",
        description: "Click 'Apply Rules to Matches' to sync settings with matches.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lock failed");
    } finally {
      setLocking(false);
    }
  }

  async function handleUnlock() {
    setUnlocking(true);
    setError("");
    try {
      const res = await apiFetch(
        `/tournaments/${tournamentId}/competition/unlock`,
        {
          method: "POST",
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not unlock rules");
      await load();
      toast({
        title: "Rules unlocked for editing",
        description: "You can now edit any rule, preset, or squad limit and re-lock when ready.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setUnlocking(false);
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
      setLastAppliedCount(prepared);
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
            prepared > 0 ? "Matches ready with rules" : "Rules applied",
          description:
            prepared > 0
              ? `Synced ${prepared} upcoming match(es). Completed matches are preserved.`
              : "No upcoming matches found to sync.",
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
      ruleProfileId &&
      presentationProfileId,
    );

  const playingCount = parseInt(keyRules.playingSquadSize, 10) || 0;
  const benchCount = parseInt(keyRules.benchSize, 10) || 0;
  const totalSquadCapacity = playingCount + benchCount;

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
        subtitle="Set how this cricket tournament plays, customize standard ICC & local rules, then lock and apply to matches."
        tournamentId={tournamentId}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
        {loading && !data ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-72 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-start gap-3 text-sm text-destructive">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            {/* Top Status Banner */}
            {locked ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      Tournament rules are locked
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                        Active
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rules are active for scoring. Completed matches remain immutable. Click Unlock to make changes.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={unlocking}
                    onClick={() => void handleUnlock()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border/80 bg-background/80 hover:bg-background text-xs font-semibold text-foreground transition-all"
                  >
                    {unlocking ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Unlocking…
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-primary" /> Unlock & Edit Rules
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-200">
                    <b>Draft Mode:</b> All rules and presets below are fully editable. Once finished, click <b>Lock & Finalize Rules</b>.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Rules Config Forms */}
              <div className="lg:col-span-8 space-y-6">
                {/* 1. Format & Ball Type */}
                <section className={cn(hubPanelClass, "space-y-5 p-5 sm:p-6")}>
                  <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
                    <Scale className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">
                      1. Cricket Format & Ball Type
                    </h2>
                  </div>
                  
                  <OptionChips
                    label="Cricket type"
                    value={variantId}
                    options={variantOptions}
                    disabled={locked}
                    onChange={(id) => setVariantId(id)}
                  />

                  {/* Ball Type Selector */}
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90 block">
                      Match Ball Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {BALL_TYPE_OPTIONS.map((ball) => {
                        const selected = keyRules.ballType === ball.id;
                        return (
                          <button
                            key={ball.id}
                            type="button"
                            disabled={locked}
                            onClick={() =>
                              setKeyRules((p) => ({ ...p, ballType: ball.id }))
                            }
                            className={cn(
                              "rounded-lg border p-2.5 text-left transition-all",
                              selected
                                ? "border-primary bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40 font-bold"
                                : "border-border/80 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card",
                              locked && "opacity-60 cursor-not-allowed",
                            )}
                          >
                            <p className="text-xs font-semibold text-foreground">
                              {ball.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                              {ball.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* 2. Playing Rules Preset */}
                <section className={cn(hubPanelClass, "space-y-5 p-5 sm:p-6")}>
                  <div className="flex items-center justify-between pb-2 border-b border-border/50 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <Sliders className="w-5 h-5 text-primary" />
                      <h2 className="text-base font-semibold text-foreground">
                        2. Playing Rules Preset
                      </h2>
                    </div>
                    {isCustomised ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        Customised from preset
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                        Preset defaults
                      </span>
                    )}
                  </div>

                  {/* Friendly notice that presets are editable */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5 text-xs text-primary/90">
                    <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                    <span>
                      <b>Editable Presets:</b> Selecting a preset automatically pre-fills standard ICC/local rules below. You can freely change any value or toggle to match your tournament!
                    </span>
                  </div>

                  <OptionChips
                    label="Choose Preset"
                    value={ruleProfileId}
                    options={ruleProfileOptions}
                    disabled={locked}
                    onChange={(id, version) => selectRuleProfile(id, version)}
                  />
                </section>

                {/* 3. Squad Size Limits & Live Total Calculation */}
                <section className={cn(hubPanelClass, "space-y-5 p-5 sm:p-6")}>
                  <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">
                      3. Squad Size Limits
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-border/70 bg-card/40 p-3.5 space-y-1.5 focus-within:border-primary/50">
                      <label className="text-xs font-medium text-foreground block">
                        Playing Squad (XI)
                      </label>
                      <input
                        className={cn(
                          inputClass,
                          "h-9 font-semibold text-center text-sm bg-background/80",
                        )}
                        inputMode="numeric"
                        disabled={locked}
                        value={keyRules.playingSquadSize}
                        onChange={(e) =>
                          setKeyRules((prev) => ({
                            ...prev,
                            playingSquadSize: e.target.value,
                          }))
                        }
                      />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Active on field per team
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-card/40 p-3.5 space-y-1.5 focus-within:border-primary/50">
                      <label className="text-xs font-medium text-foreground block">
                        Bench / Substitutes
                      </label>
                      <input
                        className={cn(
                          inputClass,
                          "h-9 font-semibold text-center text-sm bg-background/80",
                        )}
                        inputMode="numeric"
                        disabled={locked}
                        value={keyRules.benchSize}
                        onChange={(e) =>
                          setKeyRules((prev) => ({
                            ...prev,
                            benchSize: e.target.value,
                          }))
                        }
                      />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Bench substitute slots
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-card/40 p-3.5 space-y-1.5 focus-within:border-primary/50">
                      <label className="text-xs font-medium text-foreground block">
                        Min Squad Size
                      </label>
                      <input
                        className={cn(
                          inputClass,
                          "h-9 font-semibold text-center text-sm bg-background/80",
                        )}
                        inputMode="numeric"
                        disabled={locked}
                        value={squadRules.minPlayers}
                        onChange={(e) =>
                          setSquadRules((prev) => ({
                            ...prev,
                            minPlayers: e.target.value,
                          }))
                        }
                      />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Minimum players for team
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-card/40 p-3.5 space-y-1.5 focus-within:border-primary/50">
                      <label className="text-xs font-medium text-foreground block">
                        Max Squad Size
                      </label>
                      <input
                        className={cn(
                          inputClass,
                          "h-9 font-semibold text-center text-sm bg-background/80",
                        )}
                        inputMode="numeric"
                        disabled={locked}
                        value={squadRules.maxPlayers}
                        onChange={(e) =>
                          setSquadRules((prev) => ({
                            ...prev,
                            maxPlayers: e.target.value,
                          }))
                        }
                      />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Max roster limit per team
                      </p>
                    </div>
                  </div>

                  {/* Live Total Squad Calculation Summary */}
                  <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Total Acceptable Players in Team
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sum of playing XI ({playingCount}) and bench substitutes ({benchCount}).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-extrabold text-foreground">
                        {totalSquadCapacity} Players
                      </span>
                      <span className="text-xs text-muted-foreground">
                        / team
                      </span>
                    </div>
                  </div>
                </section>

                {/* 4. Match Rules & ICC Parameters */}
                <section className={cn(hubPanelClass, "space-y-5 p-5 sm:p-6")}>
                  <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
                    <Trophy className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">
                      4. Match Rules & Parameters
                    </h2>
                  </div>

                  {/* Key Numeric Parameters */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
                      Core Match Settings
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <FormField
                        label={KEY_RULE_LABELS["cricket.match.overs_per_innings"]}
                      >
                        <input
                          className={cn(inputClass, "font-medium")}
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
                          className={cn(inputClass, "font-medium")}
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
                        label={KEY_RULE_LABELS["cricket.match.balls_per_over"]}
                      >
                        <input
                          className={cn(inputClass, "font-medium")}
                          inputMode="numeric"
                          disabled={locked}
                          value={keyRules.ballsPerOver}
                          onChange={(e) =>
                            setKeyRules((p) => ({
                              ...p,
                              ballsPerOver: e.target.value,
                            }))
                          }
                        />
                      </FormField>

                      <FormField
                        label={KEY_RULE_LABELS["cricket.batting.retire_at_runs"]}
                      >
                        <input
                          className={cn(inputClass, "font-medium")}
                          inputMode="numeric"
                          disabled={locked}
                          placeholder="None (Disabled)"
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
                  </div>

                  {/* Special & ICC Rule Toggles */}
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
                      ICC & Special Match Rules
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        {
                          label: "LBW Dismissals",
                          desc: "Standard ICC LBW dismissals",
                          active: keyRules.lbwEnabled,
                          toggle: () =>
                            setKeyRules((p) => ({ ...p, lbwEnabled: !p.lbwEnabled })),
                        },
                        {
                          label: "Free Hit (No Balls)",
                          desc: "Award free hit delivery after no balls",
                          active: keyRules.freeHitEnabled,
                          toggle: () =>
                            setKeyRules((p) => ({
                              ...p,
                              freeHitEnabled: !p.freeHitEnabled,
                            })),
                        },
                        {
                          label: "Leg Byes",
                          desc: "Score runs off batsman body contact",
                          active: keyRules.legByeEnabled,
                          toggle: () =>
                            setKeyRules((p) => ({
                              ...p,
                              legByeEnabled: !p.legByeEnabled,
                            })),
                        },
                        {
                          label: "Powerplay Overs",
                          desc: "Mandatory fielding restrictions",
                          active: keyRules.powerplayEnabled,
                          toggle: () =>
                            setKeyRules((p) => ({
                              ...p,
                              powerplayEnabled: !p.powerplayEnabled,
                            })),
                        },
                        {
                          label: "Exact Playing XI",
                          desc: "Strictly enforce roster size before start",
                          active: keyRules.playingXiEnforced,
                          toggle: () =>
                            setKeyRules((p) => ({
                              ...p,
                              playingXiEnforced: !p.playingXiEnforced,
                            })),
                        },
                        {
                          label: "Super Over Tie-Break",
                          desc: "Play tie-break over on tie score",
                          active: keyRules.superOverEnabled,
                          toggle: () =>
                            setKeyRules((p) => ({
                              ...p,
                              superOverEnabled: !p.superOverEnabled,
                            })),
                        },
                        {
                          label: "Super Ball Feature",
                          desc: "One pre-declared 2x run ball per innings",
                          active: keyRules.superBallEnabled,
                          toggle: () =>
                            setKeyRules((p) => ({
                              ...p,
                              superBallEnabled: !p.superBallEnabled,
                            })),
                          gold: true,
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          disabled={locked}
                          onClick={item.toggle}
                          className={cn(
                            "flex flex-col justify-between gap-1.5 rounded-xl border p-3 text-xs text-left transition-all",
                            item.active
                              ? item.gold
                                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                                : "border-primary/50 bg-primary/15 text-primary"
                              : "border-border/60 bg-muted/10 text-muted-foreground hover:text-foreground",
                            locked && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-foreground truncate">{item.label}</span>
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                                item.active
                                  ? "bg-primary/20 text-primary-foreground font-extrabold"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {item.active ? "ON" : "OFF"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {item.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Super Over Configuration Card */}
                  {keyRules.superOverEnabled ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <p className="text-xs font-bold uppercase tracking-wider text-primary">
                          Super Over Configuration
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <FormField
                          label={KEY_RULE_LABELS["cricket.tie_break.super_over_overs"]}
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
                          label={KEY_RULE_LABELS["cricket.tie_break.super_over_wickets"]}
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
                          label={KEY_RULE_LABELS["cricket.tie_break.super_over_trigger"]}
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
                            <option value="manual">Manual trigger</option>
                            <option value="knockout_tie">Knockout tie only</option>
                          </select>
                        </FormField>
                      </div>
                    </div>
                  ) : null}

                  {/* Super Ball Sub-Option Configuration Card */}
                  {keyRules.superBallEnabled ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          Super Ball Run Doubling Mode
                        </p>
                      </div>
                      <p className="text-xs text-amber-200/90">
                        Choose how runs will be doubled when a team declares the Super Ball:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() =>
                            setKeyRules((p) => ({
                              ...p,
                              superBallDoublesBoundariesOnly: true,
                            }))
                          }
                          className={cn(
                            "rounded-lg border p-3 text-left transition-all",
                            keyRules.superBallDoublesBoundariesOnly
                              ? "border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40 font-bold"
                              : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground",
                            locked && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <p className="text-xs font-bold text-foreground">
                            Only Boundaries (4 & 6 Doubled)
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            4 becomes 8 runs, 6 becomes 12 runs. Singles and doubles remain normal.
                          </p>
                        </button>

                        <button
                          type="button"
                          disabled={locked}
                          onClick={() =>
                            setKeyRules((p) => ({
                              ...p,
                              superBallDoublesBoundariesOnly: false,
                            }))
                          }
                          className={cn(
                            "rounded-lg border p-3 text-left transition-all",
                            !keyRules.superBallDoublesBoundariesOnly
                              ? "border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40 font-bold"
                              : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground",
                            locked && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <p className="text-xs font-bold text-foreground">
                            All Runs Doubled (1, 2, 3, 4, 6)
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Any scored run is doubled (1&rarr;2, 2&rarr;4, 3&rarr;6, 4&rarr;8, 6&rarr;12).
                          </p>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Collapsible preset inspector */}
                  {otherPresetRules.length > 0 ? (
                    <details className="text-xs text-muted-foreground rounded-lg border border-border/40 p-3 bg-muted/10">
                      <summary className="cursor-pointer font-semibold text-foreground/80 hover:text-primary">
                        View {otherPresetRules.length} other background rules from preset
                      </summary>
                      <ul className="mt-2.5 space-y-1.5 border-t border-border/40 pt-2">
                        {otherPresetRules.map((entry) => {
                          const def = CatalogRegistry.getRuleDefinition(
                            entry.definitionId,
                            entry.definitionVersion,
                          );
                          return (
                            <li
                              key={`${entry.definitionId}@${entry.definitionVersion}`}
                              className="flex justify-between gap-3 text-xs"
                            >
                              <span>{def?.name ?? entry.definitionId}</span>
                              <span className="font-mono text-muted-foreground shrink-0">
                                {entry.value === null ? "null" : String(entry.value)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}

                  {/* Screen Theme / Look */}
                  <OptionChips
                    label="LED / Screen Presentation Theme"
                    value={presentationProfileId}
                    options={presentationOptions}
                    disabled={locked}
                    onChange={(id, version) => {
                      setPresentationProfileId(id);
                      setPresentationProfileVersion(version ?? "");
                    }}
                  />
                </section>
              </div>

              {/* Right Column: Sticky Summary & Actions Sidebar */}
              <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">
                {/* Status & Actions Card */}
                <div className={cn(hubPanelClass, "p-5 space-y-5 border-primary/20")}>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/50">
                    <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-primary" />
                      Tournament Rules Status
                    </h3>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                        locked
                          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                          : "bg-amber-500/15 border border-amber-500/30 text-amber-300",
                      )}
                    >
                      {locked ? "Locked (Active)" : "In Draft"}
                    </span>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Cricket Type
                      </p>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {variantOptions.find((v) => v.id === variantId)?.label || "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Ball Type
                      </p>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {BALL_TYPE_OPTIONS.find((b) => b.id === keyRules.ballType)?.label || "Tennis"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Overs / Innings
                      </p>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {keyRules.overs ? `${keyRules.overs} Overs` : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Playing / Bench
                      </p>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {playingCount} XI + {benchCount} B
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Super Over
                      </p>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {keyRules.superOverEnabled ? `${keyRules.superOverOvers} Over (ON)` : "OFF"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Super Ball
                      </p>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {keyRules.superBallEnabled
                          ? keyRules.superBallDoublesBoundariesOnly
                            ? "4&6 (2x)"
                            : "All (2x)"
                          : "OFF"}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2">
                    {!locked ? (
                      <>
                        <BtnPrimary
                          className="w-full justify-center h-10"
                          disabled={!canLock || locking || saving}
                          onClick={() => void handleLock()}
                        >
                          {locking ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Locking Rules…
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" /> Lock & Finalize Rules
                            </>
                          )}
                        </BtnPrimary>
                        <BtnSecondary
                          className="w-full justify-center h-9 text-xs"
                          disabled={saving || locking}
                          onClick={() => void persistSetup()}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Draft…
                            </>
                          ) : (
                            "Save Draft Changes"
                          )}
                        </BtnSecondary>
                      </>
                    ) : (
                      <>
                        <BtnPrimary
                          className="w-full justify-center h-10"
                          disabled={applying}
                          onClick={() => void handleApplyToMatches()}
                        >
                          {applying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Applying to Matches…
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-4 h-4" /> Apply Rules to Matches
                            </>
                          )}
                        </BtnPrimary>
                        <BtnSecondary
                          className="w-full justify-center h-9 text-xs"
                          disabled={unlocking}
                          onClick={() => void handleUnlock()}
                        >
                          {unlocking ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Unlocking…
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5" /> Unlock & Edit Rules
                            </>
                          )}
                        </BtnSecondary>
                      </>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {locked
                      ? "Rules are active. Clicking 'Apply' syncs these rules with scheduled matches (completed matches are untouched)."
                      : "Locking rules finalizes overs, dismissals, and squad capacities before scoring matches."}
                  </p>
                </div>

                {/* Workflow steps card */}
                <div className={cn(hubPanelClass, "p-4 space-y-3 text-xs")}>
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-primary" />
                    Setup Steps
                  </p>
                  <ol className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span>Select Cricket Format & Ball Type.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span>Pick a Preset and customize rules/toggles.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <span>Click <b>Lock Rules</b> to finalize configuration.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                        4
                      </span>
                      <span>Click <b>Apply to matches</b> to sync with matches.</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
