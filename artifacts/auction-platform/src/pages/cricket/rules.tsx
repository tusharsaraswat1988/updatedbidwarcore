/**
 * Cricket Rules & format — chips for short catalogs + editable key rule overrides.
 * Route: /tournament/:id/score/rules
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
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
  listCricketRulePresets,
  createCricketRulePreset,
  updateCricketRulePreset,
  deleteCricketRulePreset,
  type CricketRulePresetJson,
} from "@/lib/scoring-api";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Lock,
  PlayCircle,
  Plus,
  Scale,
  Settings2,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
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
  powerplayOvers: number[];
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
  "cricket.match.playing_squad_size": "Playing XI size",
  "cricket.match.playing_xi_enforced": "Exact Playing XI",
  "cricket.match.bench_size": "Bench / substitute players",
  "cricket.match.balls_per_over": "Balls per over",
  "cricket.match.ball_type": "Match ball",
  "cricket.batting.retire_at_runs": "Retire at runs",
  "cricket.dismissal.lbw_enabled": "LBW dismissals",
  "cricket.extras.leg_bye_enabled": "Leg byes",
  "cricket.bowling.free_hit_enabled": "Free hit (no balls)",
  "cricket.powerplay.enabled": "Powerplay overs",
  "cricket.powerplay.overs": "Powerplay overs selection",
  "cricket.special.super_ball_enabled": "Super Ball",
  "cricket.special.super_ball_doubles_boundaries_only": "Super Ball doubling mode",
  "cricket.tie_break.super_over_enabled": "Super Over tie-break",
  "cricket.tie_break.super_over_overs": "Super Over overs",
  "cricket.tie_break.super_over_wickets": "Super Over wickets",
  "cricket.tie_break.super_over_trigger": "Super Over trigger",
};

const BALL_TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "tennis", label: "Tennis Ball" },
  { id: "leather", label: "Leather Ball" },
  { id: "tape", label: "Tape Ball" },
  { id: "indoor", label: "Indoor / Soft" },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

function choiceChipClass(selected: boolean, isLocked: boolean) {
  return cn(
    "min-h-10 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
    focusRing,
    selected
      ? isLocked
        ? "border-border bg-muted text-foreground"
        : "border-primary bg-primary/20 text-primary ring-1 ring-primary/40 font-bold"
      : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground",
    isLocked && "cursor-default",
  );
}

function rulesSnapshot(input: {
  variantId: string;
  ruleProfileId: string;
  ruleProfileVersion: string;
  keyRules: KeyRulesDraft;
}) {
  return JSON.stringify(input);
}

function powerplayHint(isLocked: boolean, enabled: boolean, count: number) {
  if (!enabled) {
    return isLocked
      ? "Powerplay is off for this format."
      : "Powerplay is off. Turn it on to choose overs.";
  }
  if (count === 0) {
    return isLocked
      ? "Powerplay is on, but no overs are selected. Unlock rules to choose them."
      : "Select over numbers, or use Standard for the opening overs.";
  }
  return isLocked
    ? "These overs stay fixed until you unlock the rules."
    : "Select an over again to remove it from the powerplay.";
}

function RuleHelpTooltip({
  title,
  content,
}: {
  title: string;
  content: string;
  category?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="relative inline-flex" ref={wrapRef}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center ml-1 rounded-sm text-muted-foreground/70 hover:text-foreground",
          focusRing,
        )}
        aria-expanded={open}
        aria-label={`${title}. ${content}`}
        onClick={() => setOpen((current) => !current)}
      >
        <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-border bg-popover px-3 py-2 text-left text-[11px] font-normal normal-case tracking-normal text-popover-foreground shadow-lg"
        >
          <span className="mb-0.5 block font-semibold">{title}</span>
          {content}
        </span>
      ) : null}
    </span>
  );
}

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
    powerplayOvers: (() => {
      const ppOversRaw = merged["cricket.powerplay.overs"];
      if (Array.isArray(ppOversRaw)) {
        return ppOversRaw.filter(
          (x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 1,
        );
      }
      if (bool("cricket.powerplay.enabled", false)) {
        const oversNum = parseInt(num("cricket.match.overs_per_innings", 6), 10) || 6;
        const defaultCount = Math.min(6, Math.max(1, Math.ceil(oversNum * 0.3)));
        return Array.from({ length: defaultCount }, (_, i) => i + 1);
      }
      return [];
    })(),
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
    "cricket.powerplay.overs": draft.powerplayEnabled ? draft.powerplayOvers : [],
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

function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string" && err.trim()) return err;
  if (err instanceof Error && err.message && err.message !== "[object Object]") return err.message;
  if (err && typeof err === "object") {
    const rec = err as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message && rec.message !== "[object Object]") return rec.message;
    if (typeof rec.error === "string" && rec.error && rec.error !== "[object Object]") return rec.error;
    if (rec.error && typeof rec.error === "object") {
      const inner = rec.error as Record<string, unknown>;
      if (typeof inner.message === "string") return inner.message;
      if (Array.isArray(inner.formErrors) && inner.formErrors.length > 0) return String(inner.formErrors[0]);
      if (inner.fieldErrors && typeof inner.fieldErrors === "object") {
        const msgs = Object.entries(inner.fieldErrors as Record<string, unknown[]>)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("; ");
        if (msgs) return msgs;
      }
      try {
        return JSON.stringify(rec.error);
      } catch {
        // ignore
      }
    }
  }
  return fallback;
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
  const qc = useQueryClient();

  const [data, setData] = useState<CompetitionAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const [presets, setPresets] = useState<CricketRulePresetJson[]>([]);
  const [activePresetId, setActivePresetId] = useState<number | null>(null);
  const [createPresetOpen, setCreatePresetOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [deletingPreset, setDeletingPreset] = useState(false);
  const [applyConfirm, setApplyConfirm] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const presetDialogRef = useRef<HTMLDivElement>(null);
  const presetNameRef = useRef<HTMLInputElement>(null);

  const [competitionTypeId, setCompetitionTypeId] = useState("auction");
  const [variantId, setVariantId] = useState("cricket.box");
  const [registrationModeId, setRegistrationModeId] = useState("team");
  const [teamFormationStrategyId, setTeamFormationStrategyId] = useState("manual");
  const [ruleProfileId, setRuleProfileId] = useState("cricket.box.corporate_standard");
  const [ruleProfileVersion, setRuleProfileVersion] = useState("1.0.0");
  const [presentationProfileId, setPresentationProfileId] = useState("cricket.presentation.corporate_box");
  const [presentationProfileVersion, setPresentationProfileVersion] = useState("1.0.0");
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
      const [compRes, presetList] = await Promise.all([
        apiFetch(`/tournaments/${tournamentId}/competition`),
        listCricketRulePresets(tournamentId).catch(() => [] as CricketRulePresetJson[]),
      ]);
      if (!compRes.ok) {
        const body = await compRes.json().catch(() => ({}));
        throw new Error(extractErrorMessage(body, `Failed to load rules (HTTP ${compRes.status})`));
      }
      const body = (await compRes.json()) as CompetitionAggregate;
      setData(body);
      setPresets(presetList);

      let activePreset: CricketRulePresetJson | undefined;
      if (presetList.length > 0) {
        const currentActive = presetList.find((p) => p.id === activePresetId);
        activePreset = currentActive || presetList.find((p) => p.isDefault) || presetList[0];
        setActivePresetId(activePreset.id);
      }

      const sid = (body.configuration.sportId || "cricket").toLowerCase();
      const cfg = body.configuration;

      const nextVariant = activePreset?.variantId || cfg.variantId || "cricket.box";
      const nextCompType = cfg.competitionTypeId || "auction";
      const nextRuleId = activePreset?.ruleProfileId || cfg.ruleProfileId || "cricket.box.corporate_standard";
      const nextRuleVersion = activePreset?.ruleProfileVersion || cfg.ruleProfileVersion || "1.0.0";
      const nextPresId = cfg.presentationProfileId || "cricket.presentation.corporate_box";
      const nextPresVersion = cfg.presentationProfileVersion || "1.0.0";

      setVariantId(nextVariant);
      setCompetitionTypeId(nextCompType);
      setRegistrationModeId(cfg.registrationModeId || "team");
      setTeamFormationStrategyId(cfg.teamFormationStrategyId || "manual");
      setRuleProfileId(nextRuleId);
      setRuleProfileVersion(nextRuleVersion);
      setPresentationProfileId(nextPresId);
      setPresentationProfileVersion(nextPresVersion);
      setSquadRules(squadFromConfig((activePreset?.squadRulesJson as any) || cfg.squadRules));

      const profile =
        CatalogRegistry.getRuleProfile(nextRuleId, nextRuleVersion) ??
        CatalogRegistry.getRuleProfile(nextRuleId) ??
        null;
      const nextKeyRules = draftFromProfileAndOverrides(
        profile,
        (activePreset?.ruleOverridesJson as RuleOverridesDocument) || cfg.ruleOverrides || null,
      );
      setKeyRules(nextKeyRules);
      setSavedSnapshot(
        rulesSnapshot({
          variantId: nextVariant,
          ruleProfileId: nextRuleId,
          ruleProfileVersion: nextRuleVersion,
          keyRules: nextKeyRules,
        }),
      );
      setApplyConfirm(false);
    } catch (e) {
      setError(extractErrorMessage(e, "Failed to load tournament rules"));
    } finally {
      setLoading(false);
    }
  }, [tournamentId, activePresetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    !locked &&
    savedSnapshot !== "" &&
    savedSnapshot !==
      rulesSnapshot({
        variantId,
        ruleProfileId,
        ruleProfileVersion,
        keyRules,
      });

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!createPresetOpen) return;
    presetNameRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreatePresetOpen(false);
        return;
      }
      if (event.key !== "Tab" || !presetDialogRef.current) return;
      const focusable = presetDialogRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [createPresetOpen]);

  // Primary 3 Cricket Variants
  const variantOptions: Option[] = useMemo(() => [
    { id: "cricket.box", label: "Box Cricket", description: "Indoor / turf box cricket with shorter overs." },
    { id: "cricket.outdoor", label: "Outdoor Cricket", description: "Standard outdoor cricket ground." },
    { id: "cricket.custom", label: "Custom", description: "Custom organizer rules." },
  ], []);

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

  // Sync defaults when variant changes
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
        suggested.ruleProfile?.id ?? ruleProfileOptions[0]?.id ?? "cricket.box.corporate_standard";
      const nextVersion =
        suggested.ruleProfile?.version ?? ruleProfileOptions[0]?.version ?? "1.0.0";
      setRuleProfileId(nextId);
      setRuleProfileVersion(nextVersion);
      const profile =
        CatalogRegistry.getRuleProfile(nextId, nextVersion) ??
        CatalogRegistry.getRuleProfile(nextId) ??
        null;
      setKeyRules(draftFromProfileAndOverrides(profile, null));
    }
    if (suggested.presentationProfile?.id) {
      setPresentationProfileId(suggested.presentationProfile.id);
      setPresentationProfileVersion(suggested.presentationProfile.version ?? "1.0.0");
    }
  }, [
    locked,
    sportId,
    variantId,
    competitionTypeId,
    ruleProfileId,
    ruleProfileOptions,
  ]);

  function selectRuleProfile(id: string, version?: string) {
    setRuleProfileId(id);
    setRuleProfileVersion(version ?? "");
    const profile =
      CatalogRegistry.getRuleProfile(id, version) ??
      CatalogRegistry.getRuleProfile(id) ??
      null;
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

      const defaultPresId =
        presentationProfileId ||
        (variantId === "cricket.outdoor"
          ? "cricket.presentation.outdoor"
          : "cricket.presentation.corporate_box");

      if (activePresetId) {
        await updateCricketRulePreset(tournamentId, activePresetId, {
          variantId: variantId || "cricket.box",
          ruleProfileId: ruleProfileId || "cricket.box.corporate_standard",
          ruleProfileVersion: ruleProfileVersion || "1.0.0",
          ruleOverridesJson: pendingOverrides ? { values: pendingOverrides.values } : null,
          squadRulesJson: Object.keys(squadPayload).length > 0 ? squadPayload : null,
        });
      }

      const res = await apiFetch(
        `/tournaments/${tournamentId}/competition/configuration`,
        {
          method: "PATCH",
          json: {
            competitionTypeId: competitionTypeId || "auction",
            variantId: variantId || "cricket.box",
            registrationModeId: registrationModeId || "team",
            teamFormationStrategyId: teamFormationStrategyId || "manual",
            ruleProfileId: ruleProfileId || "cricket.box.corporate_standard",
            ruleProfileVersion: ruleProfileVersion || null,
            presentationProfileId: defaultPresId,
            presentationProfileVersion: presentationProfileVersion || null,
            squadRules:
              Object.keys(squadPayload).length > 0 ? squadPayload : null,
            ruleOverrides: pendingOverrides,
          },
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(body, "Could not save rules"));
      await load();
      void qc.invalidateQueries({ queryKey: ["cricket-rule-presets", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
      toast({
        title: "Changes saved",
        description: "Rule settings have been saved successfully.",
      });
      return true;
    } catch (e) {
      setError(extractErrorMessage(e, "Save failed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleSelectPreset(p: CricketRulePresetJson) {
    setActivePresetId(p.id);
    const nextVar = p.variantId || "cricket.box";
    const nextRuleId = p.ruleProfileId || "cricket.box.corporate_standard";
    const nextRuleVer = p.ruleProfileVersion || "1.0.0";
    setVariantId(nextVar);
    setRuleProfileId(nextRuleId);
    setRuleProfileVersion(nextRuleVer);
    if (p.squadRulesJson) {
      setSquadRules(squadFromConfig(p.squadRulesJson as Record<string, unknown>));
    }
    const profile =
      CatalogRegistry.getRuleProfile(nextRuleId, nextRuleVer) ??
      CatalogRegistry.getRuleProfile(nextRuleId) ??
      null;
    setKeyRules(
      draftFromProfileAndOverrides(profile, (p.ruleOverridesJson as RuleOverridesDocument) ?? null),
    );
  }

  async function handleCreatePreset() {
    const trimmed = newPresetName.trim();
    if (!trimmed) {
      toast({ title: "Name required", description: "Please enter a preset name.", variant: "destructive" });
      return;
    }
    try {
      const created = await createCricketRulePreset(tournamentId, {
        name: trimmed,
        description: newPresetDesc.trim() || null,
        variantId: variantId || "cricket.box",
        ruleProfileId: ruleProfileId || "cricket.box.corporate_standard",
        ruleProfileVersion: ruleProfileVersion || "1.0.0",
        ruleOverridesJson: pendingOverrides ? { values: pendingOverrides.values } : null,
        squadRulesJson: Object.keys(squadRules).length > 0 ? {
          minPlayers: squadRules.minPlayers ? parseInt(squadRules.minPlayers, 10) : null,
          maxPlayers: squadRules.maxPlayers ? parseInt(squadRules.maxPlayers, 10) : null,
          substitutes: squadRules.substitutes ? parseInt(squadRules.substitutes, 10) : null,
        } : null,
      });
      setCreatePresetOpen(false);
      setNewPresetName("");
      setNewPresetDesc("");
      await load();
      void qc.invalidateQueries({ queryKey: ["cricket-rule-presets", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
      setActivePresetId(created.id);
      toast({ title: "Rule Preset Created", description: `"${created.name}" is now available for fixtures and matches.` });
    } catch (e) {
      toast({ title: "Failed to create preset", description: extractErrorMessage(e, "Error creating preset"), variant: "destructive" });
    }
  }

  async function handleDeletePreset(presetId: number) {
    setDeletingPreset(true);
    try {
      await deleteCricketRulePreset(tournamentId, presetId);
      await load();
      void qc.invalidateQueries({ queryKey: ["cricket-rule-presets", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
      toast({ title: "Rule Preset Deleted" });
    } catch (e) {
      toast({
        title: "Cannot Delete Preset",
        description: extractErrorMessage(e, "Preset is in use by fixtures or matches."),
        variant: "destructive",
      });
    } finally {
      setDeletingPreset(false);
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
      if (!res.ok) throw new Error(extractErrorMessage(body, "Could not lock rules"));
      await load();
      toast({
        title: "Rules locked & finalized",
        description: "Apply rules to matches when you want upcoming fixtures to use them.",
      });
    } catch (e) {
      setError(extractErrorMessage(e, "Lock failed"));
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
      if (!res.ok) throw new Error(extractErrorMessage(body, "Could not unlock rules"));
      await load();
      toast({
        title: "Rules unlocked for editing",
        description: "You can now edit any rule, preset, or squad limit and re-lock when ready.",
      });
    } catch (e) {
      setError(extractErrorMessage(e, "Unlock failed"));
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
        throw new Error(extractErrorMessage(body, "Could not apply rules to matches"));
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
            prepared > 0 ? "Matches ready with rules" : "Rules applied",
          description:
            prepared > 0
              ? `Synced ${prepared} upcoming match(es). Completed matches are preserved.`
              : "No upcoming matches found to sync.",
        });
      }
    } catch (e) {
      setError(extractErrorMessage(e, "Apply failed"));
    } finally {
      setApplying(false);
      setApplyConfirm(false);
    }
  }

  const canLock =
    !locked &&
    Boolean(
      variantId &&
      ruleProfileId,
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
        subtitle="Set tournament format, overs, squad limits and dismissal rules for scoring."
        tournamentId={tournamentId}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 pb-16 space-y-4">
        {loading && !data ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-8 space-y-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
            <div className="xl:col-span-4 space-y-3">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {error ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-destructive/40 bg-destructive/15 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-destructive"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="break-words">{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  className={cn("underline font-semibold hover:opacity-80 shrink-0 rounded-sm", focusRing)}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {/* Top Status Banner */}
            {locked ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-foreground">
                    Rules are locked
                  </span>
                  <span className="text-muted-foreground hidden sm:inline">
                    This page is view only. Unlock to edit. Completed matches stay unchanged.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={unlocking}
                  onClick={() => void handleUnlock()}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-background/90 hover:bg-background text-xs font-semibold text-foreground transition-colors shrink-0",
                    focusRing,
                  )}
                >
                  {unlocking ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Unlocking…
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3 h-3 text-primary" aria-hidden="true" /> Unlock & Edit Rules
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 motion-safe:animate-pulse" />
                  <span className="text-amber-200 font-medium">
                    {dirty ? (
                      <>
                        <b>Unsaved changes.</b> Save the draft, or lock the rules when you are finished.
                      </>
                    ) : (
                      <>
                        <b>Draft mode.</b> Save the draft, or lock the rules when you are finished.
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Rule Presets Selector Bar */}
            <div className="rounded-xl border border-border/70 bg-card/70 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold tracking-wide text-foreground text-balance">
                    Fixture Rule Presets
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Saved setups you can assign to fixtures
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatePresetOpen(true)}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-lg border border-primary/20 transition-colors",
                    focusRing,
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Rule Preset
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Fixture rule presets">
                {presets.map((p) => {
                  const isActive = p.id === activePresetId;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "inline-flex items-center rounded-lg border text-xs font-semibold transition-colors",
                        isActive
                          ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/40"
                          : "border-border/70 bg-background text-muted-foreground",
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => handleSelectPreset(p)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg hover:text-foreground",
                          focusRing,
                        )}
                      >
                        <span>{p.name}</span>
                        {p.isDefault ? (
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">
                            Default
                          </span>
                        ) : null}
                      </button>
                      {isActive && !p.isDefault && presets.length > 1 ? (
                        <button
                          type="button"
                          disabled={deletingPreset}
                          aria-label={`Delete preset ${p.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete preset “${p.name}”?`)) {
                              void handleDeletePreset(p.id);
                            }
                          }}
                          className={cn(
                            "text-muted-foreground hover:text-destructive mr-1.5 p-1 rounded-md",
                            focusRing,
                          )}
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* Left Column: Compact Rules Configuration */}
              <div className="xl:col-span-8 space-y-4">
                {/* 1. Format & Ball Type (Ultra Compact) */}
                <section className={cn(hubPanelClass, "p-4 space-y-3.5")}>
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-bold tracking-wide text-foreground text-balance">
                        1. Format & Ball
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Cricket Format Chips */}
                    <div className="space-y-1.5">
                      <label id="cricket-format-label" className="text-[11px] font-semibold tracking-wide text-muted-foreground flex items-center">
                        <span>Cricket Format</span>
                        <RuleHelpTooltip
                          title="Cricket Format"
                          content="Choose the match environment: Box Cricket for indoor/turf arenas with boundary nets, Outdoor Cricket for open grounds and standard pitches, or Custom for local tournament rules."
                          category="cricket"
                        />
                      </label>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="cricket-format-label">
                        {variantOptions.map((o) => {
                          const sel = o.id === variantId;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              disabled={locked}
                              aria-pressed={sel}
                              onClick={() => setVariantId(o.id)}
                              className={choiceChipClass(sel, locked)}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Match Ball Chips */}
                    <div className="space-y-1.5">
                      <label id="match-ball-label" className="text-[11px] font-semibold tracking-wide text-muted-foreground flex items-center">
                        <span>Match Ball</span>
                        <RuleHelpTooltip
                          title="Match Ball"
                          content="The type of ball used for this tournament (Tennis, Leather, Tape, or Indoor Soft). Displayed on match cards and scorecards."
                          category="cricket"
                        />
                      </label>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="match-ball-label">
                        {BALL_TYPE_OPTIONS.map((ball) => {
                          const sel = keyRules.ballType === ball.id;
                          return (
                            <button
                              key={ball.id}
                              type="button"
                              disabled={locked}
                              aria-pressed={sel}
                              onClick={() =>
                                setKeyRules((p) => ({ ...p, ballType: ball.id }))
                              }
                              className={choiceChipClass(sel, locked)}
                            >
                              {ball.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 2. Preset & Core Match Numbers */}
                <section className={cn(hubPanelClass, "p-4 space-y-3.5")}>
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/50 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-bold tracking-wide text-foreground text-balance">
                        2. Match Parameters
                      </h2>
                    </div>
                    {isCustomised ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        Customised from preset
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                        Preset defaults
                      </span>
                    )}
                  </div>

                  {/* Preset Chips */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label id="playing-template-label" className="text-[11px] font-semibold tracking-wide text-muted-foreground flex items-center">
                        <span>Playing Template</span>
                        <RuleHelpTooltip
                          title="Playing Template"
                          content="A starting set of numbers and scoring rules, such as Corporate Standard or Society Box. Choosing a template fills the fields below. Fixture presets, above, are the named setups you assign to matches."
                          category="bidwar"
                        />
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        Fills the fields below. It does not assign a fixture preset.
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="playing-template-label">
                      {ruleProfileOptions.map((p) => {
                        const sel = p.id === ruleProfileId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={locked}
                            aria-pressed={sel}
                            onClick={() => selectRuleProfile(p.id, p.version)}
                            className={choiceChipClass(sel, locked)}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Squad, then innings, then the overs those innings contain. */}
                  <div className="pt-1 space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                        Squad
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg border border-border/70 bg-card/40 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label htmlFor="rule-playing-xi" className="text-[11px] font-medium text-muted-foreground truncate">
                            Playing XI
                          </label>
                          <RuleHelpTooltip
                            title="Playing XI"
                            content="Number of players allowed on the field in the active playing group for each team during the match (e.g. 11 for outdoor cricket, 7 or 8 for box cricket)."
                            category="cricket"
                          />
                        </div>
                        <input
                          id="rule-playing-xi"
                          name="playingSquadSize"
                          autoComplete="off"
                          className={cn(inputClass, "h-10 text-center text-xs font-bold tabular-nums")}
                          inputMode="numeric"
                          disabled={locked}
                          value={keyRules.playingSquadSize}
                          onChange={(e) =>
                            setKeyRules((p) => ({ ...p, playingSquadSize: e.target.value }))
                          }
                        />
                      </div>

                      <div className="rounded-lg border border-border/70 bg-card/40 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label htmlFor="rule-bench" className="text-[11px] font-medium text-muted-foreground truncate">
                            Bench / Subs
                          </label>
                          <RuleHelpTooltip
                            title="Bench / Substitute Players"
                            content="Number of reserve or substitute players available for the team in addition to the active Playing XI."
                            category="cricket"
                          />
                        </div>
                        <input
                          id="rule-bench"
                          name="benchSize"
                          autoComplete="off"
                          className={cn(inputClass, "h-10 text-center text-xs font-bold tabular-nums")}
                          inputMode="numeric"
                          disabled={locked}
                          value={keyRules.benchSize}
                          onChange={(e) =>
                            setKeyRules((p) => ({ ...p, benchSize: e.target.value }))
                          }
                        />
                      </div>

                      <div className="col-span-2 flex items-center justify-between px-3 py-1.5 rounded-lg border border-primary/25 bg-primary/10 text-xs">
                        <span className="text-muted-foreground text-[11px]">
                          Squad Capacity ({playingCount} Playing + {benchCount} Bench)
                        </span>
                        <span className="font-bold text-primary text-xs tabular-nums">
                          Total {totalSquadCapacity} Players / team
                        </span>
                      </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                        Innings
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg border border-border/70 bg-card/40 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label htmlFor="rule-overs" className="text-[11px] font-medium text-muted-foreground truncate">
                            Overs / Innings
                          </label>
                          <RuleHelpTooltip
                            title="Overs per Innings"
                            content="The maximum number of overs scheduled for each batting team per innings, unless all out earlier."
                            category="cricket"
                          />
                        </div>
                        <input
                          id="rule-overs"
                          name="overs"
                          autoComplete="off"
                          className={cn(inputClass, "h-10 text-center text-xs font-bold tabular-nums")}
                          inputMode="numeric"
                          disabled={locked}
                          value={keyRules.overs}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            const nextNum = parseInt(nextVal, 10);
                            setKeyRules((p) => {
                              const pruned =
                                Number.isFinite(nextNum) && nextNum > 0
                                  ? p.powerplayOvers.filter((o) => o <= nextNum)
                                  : p.powerplayOvers;
                              return { ...p, overs: nextVal, powerplayOvers: pruned };
                            });
                          }}
                        />
                      </div>

                      <div className="rounded-lg border border-border/70 bg-card/40 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label htmlFor="rule-balls-per-over" className="text-[11px] font-medium text-muted-foreground truncate">
                            Balls / Over
                          </label>
                          <RuleHelpTooltip
                            title="Balls per Over"
                            content="The number of legal deliveries required to complete one over. Standard cricket uses 6 balls per over."
                            category="cricket"
                          />
                        </div>
                        <input
                          id="rule-balls-per-over"
                          name="ballsPerOver"
                          autoComplete="off"
                          className={cn(inputClass, "h-10 text-center text-xs font-bold tabular-nums")}
                          inputMode="numeric"
                          disabled={locked}
                          value={keyRules.ballsPerOver}
                          onChange={(e) =>
                            setKeyRules((p) => ({ ...p, ballsPerOver: e.target.value }))
                          }
                        />
                      </div>

                      <div className="rounded-lg border border-border/70 bg-card/40 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label htmlFor="rule-max-wickets" className="text-[11px] font-medium text-muted-foreground truncate">
                            Max Wickets
                          </label>
                          <RuleHelpTooltip
                            title="Max Wickets"
                            content="The number of wickets after which the batting innings is declared all out (e.g. 10 for standard 11-player cricket, or fewer for box cricket)."
                            category="cricket"
                          />
                        </div>
                        <input
                          id="rule-max-wickets"
                          name="maxWickets"
                          autoComplete="off"
                          className={cn(inputClass, "h-10 text-center text-xs font-bold tabular-nums")}
                          inputMode="numeric"
                          disabled={locked}
                          value={keyRules.maxWickets}
                          onChange={(e) =>
                            setKeyRules((p) => ({ ...p, maxWickets: e.target.value }))
                          }
                        />
                      </div>
                      </div>
                    </div>

                    {/* Powerplay follows the overs it selects. */}
                    <div className="rounded-lg border border-border/70 bg-card/40 p-3 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            Powerplay Overs
                            <RuleHelpTooltip
                              title="Powerplay Overs"
                              content="Designated opening overs where mandatory fielding restrictions apply and Super Ball is unavailable. Click each over number to toggle."
                              category="cricket"
                            />
                          </label>
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums",
                              keyRules.powerplayEnabled && keyRules.powerplayOvers.length > 0
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : keyRules.powerplayEnabled
                                  ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {keyRules.powerplayEnabled
                              ? keyRules.powerplayOvers.length > 0
                                ? `${keyRules.powerplayOvers.length} selected`
                                : "On, none selected"
                              : "Off"}
                          </span>
                        </div>

                        {!locked && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {keyRules.powerplayEnabled ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const oversNum = parseInt(keyRules.overs, 10) || 6;
                                    const defaultCount = Math.min(6, Math.max(1, Math.ceil(oversNum * 0.3)));
                                    setKeyRules((p) => ({
                                      ...p,
                                      powerplayOvers: Array.from({ length: defaultCount }, (_, i) => i + 1),
                                    }));
                                  }}
                                  className={cn(
                                    "min-h-9 px-2.5 py-1 rounded border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium text-xs",
                                    focusRing,
                                  )}
                                >
                                  Standard (1–{Math.min(6, Math.max(1, Math.ceil((parseInt(keyRules.overs, 10) || 6) * 0.3)))})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setKeyRules((p) => ({ ...p, powerplayOvers: [] }))}
                                  className={cn(
                                    "min-h-9 px-2.5 py-1 rounded border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium text-xs",
                                    focusRing,
                                  )}
                                >
                                  Clear
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setKeyRules((p) => ({
                                      ...p,
                                      powerplayEnabled: false,
                                      powerplayOvers: [],
                                    }))
                                  }
                                  className={cn(
                                    "min-h-9 px-2.5 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors font-medium text-xs",
                                    focusRing,
                                  )}
                                >
                                  Turn Off
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const oversNum = parseInt(keyRules.overs, 10) || 6;
                                  const defaultCount = Math.min(6, Math.max(1, Math.ceil(oversNum * 0.3)));
                                  setKeyRules((p) => ({
                                    ...p,
                                    powerplayEnabled: true,
                                    powerplayOvers: Array.from({ length: defaultCount }, (_, i) => i + 1),
                                  }));
                                }}
                                className={cn(
                                  "min-h-9 px-2.5 py-1 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold text-xs",
                                  focusRing,
                                )}
                              >
                                Enable Powerplay
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {keyRules.powerplayEnabled ? (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Powerplay overs">
                            {Array.from(
                              {
                                length: Math.min(
                                  50,
                                  Math.max(1, parseInt(keyRules.overs, 10) || 6),
                                ),
                              },
                              (_, i) => i + 1,
                            ).map((overNum) => {
                              const isSelected = keyRules.powerplayOvers.includes(overNum);
                              return (
                                <button
                                  key={overNum}
                                  type="button"
                                  disabled={locked}
                                  aria-pressed={isSelected}
                                  aria-label={`Over ${overNum}${isSelected ? ", in powerplay" : ""}`}
                                  onClick={() => {
                                    setKeyRules((p) => {
                                      const next = isSelected
                                        ? p.powerplayOvers.filter((o) => o !== overNum)
                                        : [...p.powerplayOvers, overNum].toSorted((a, b) => a - b);
                                      return { ...p, powerplayOvers: next };
                                    });
                                  }}
                                  className={cn(
                                    "h-10 min-w-10 px-2 rounded-lg text-xs font-bold tabular-nums transition-colors border select-none flex items-center justify-center",
                                    focusRing,
                                    isSelected
                                      ? locked
                                        ? "bg-muted text-foreground border-border"
                                        : "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-muted-foreground border-border/80 hover:border-foreground/40 hover:text-foreground",
                                    locked && "cursor-default",
                                  )}
                                >
                                  {overNum}
                                </button>
                              );
                            })}
                          </div>
                          <p
                            className={cn(
                              "text-[11px]",
                              keyRules.powerplayOvers.length === 0
                                ? "text-amber-200"
                                : "text-muted-foreground",
                            )}
                          >
                            {powerplayHint(locked, true, keyRules.powerplayOvers.length)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          {powerplayHint(locked, false, 0)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                        Batting
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        <div className="rounded-lg border border-border/70 bg-card/40 p-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <label htmlFor="rule-retire-runs" className="text-[11px] font-medium text-muted-foreground truncate">
                              Retire Runs
                            </label>
                            <RuleHelpTooltip
                              title="Retire Runs"
                              content="The individual score threshold at which a batter is required to retire. When a batter reaches this score during live scoring, the app prompts the scorer to retire them so teammates get a turn to bat. Leave empty for no limit."
                              category="bidwar"
                            />
                          </div>
                          <input
                            id="rule-retire-runs"
                            name="retireAtRuns"
                            autoComplete="off"
                            className={cn(inputClass, "h-10 text-center text-xs font-bold tabular-nums placeholder:font-normal")}
                            inputMode="numeric"
                            disabled={locked}
                            value={keyRules.retireAtRuns}
                            onChange={(e) =>
                              setKeyRules((p) => ({ ...p, retireAtRuns: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 3. Match & ICC Rules Toggles with Inline Super Ball */}
                <section className={cn(hubPanelClass, "p-4 space-y-3.5")}>
                  <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                    <Trophy className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-bold tracking-wide text-foreground text-balance">
                      3. Scoring Rules
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 text-xs">
                    {[
                      {
                        label: "LBW Dismissals",
                        active: keyRules.lbwEnabled,
                        toggle: () => setKeyRules((p) => ({ ...p, lbwEnabled: !p.lbwEnabled })),
                        help: {
                          title: "LBW (Leg Before Wicket)",
                          content: "When enabled, umpires can award LBW dismissals. Usually turned OFF for tennis ball and box cricket matches where accurate tracking is not practical.",
                          category: "cricket" as const,
                        },
                      },
                      {
                        label: "Free Hit (No Balls)",
                        active: keyRules.freeHitEnabled,
                        toggle: () => setKeyRules((p) => ({ ...p, freeHitEnabled: !p.freeHitEnabled })),
                        help: {
                          title: "Free Hit",
                          content: "After a bowling no-ball, the next legal delivery is a Free Hit. The batter cannot be dismissed by most dismissal modes (can only be out via Run Out, Obstructing the Field, or Hit Ball Twice).",
                          category: "cricket" as const,
                        },
                      },
                      {
                        label: "Leg Byes",
                        active: keyRules.legByeEnabled,
                        toggle: () => setKeyRules((p) => ({ ...p, legByeEnabled: !p.legByeEnabled })),
                        help: {
                          title: "Leg Byes",
                          content: "Runs scored when the ball deflects off the batter's body/protective gear without touching the bat. Turn OFF for formats where body deflections do not count.",
                          category: "cricket" as const,
                        },
                      },
                      {
                        label: "Powerplay Overs",
                        active: keyRules.powerplayEnabled,
                        toggle: () =>
                          setKeyRules((p) => {
                            const nextEnabled = !p.powerplayEnabled;
                            const oversNum = parseInt(p.overs, 10) || 6;
                            let nextOvers = p.powerplayOvers;
                            if (nextEnabled && nextOvers.length === 0) {
                              const defaultCount = Math.min(6, Math.max(1, Math.ceil(oversNum * 0.3)));
                              nextOvers = Array.from({ length: defaultCount }, (_, i) => i + 1);
                            }
                            return {
                              ...p,
                              powerplayEnabled: nextEnabled,
                              powerplayOvers: nextEnabled ? nextOvers : [],
                            };
                          }),
                        help: {
                          title: "Powerplay Overs",
                          content: "Designated opening overs where mandatory fielding restrictions apply, limiting how many fielders are permitted outside the inner circle.",
                          category: "cricket" as const,
                        },
                      },
                      {
                        label: "Exact Playing XI",
                        active: keyRules.playingXiEnforced,
                        toggle: () => setKeyRules((p) => ({ ...p, playingXiEnforced: !p.playingXiEnforced })),
                        help: {
                          title: "Exact Playing XI Enforcement",
                          content: "When enabled, team lineups must strictly contain the exact configured number of active players before match scoring can begin. When disabled, matches can proceed with a smaller playing group if agreed.",
                          category: "enforcement" as const,
                        },
                      },
                      {
                        label: "Super Over Tie-Break",
                        active: keyRules.superOverEnabled,
                        toggle: () => setKeyRules((p) => ({ ...p, superOverEnabled: !p.superOverEnabled })),
                        help: {
                          title: "Super Over Tie-Break",
                          content: "An extra tie-break over bowled by each team if regulation scores are level to determine a definitive match winner.",
                          category: "cricket" as const,
                        },
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          "flex items-center gap-1 min-h-11 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                          locked && "cursor-default",
                          item.active
                            ? locked
                              ? "border-border bg-muted/60 text-foreground"
                              : "border-primary/50 bg-primary/15 text-primary"
                            : "border-border/60 bg-card/50 text-muted-foreground",
                        )}
                      >
                        <button
                          type="button"
                          disabled={locked}
                          aria-pressed={item.active}
                          onClick={item.toggle}
                          className={cn(
                            "flex flex-1 items-center justify-between gap-2 min-w-0 min-h-10 px-1 rounded-md text-left",
                            focusRing,
                            !locked && "hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{item.label}</span>
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0",
                              item.active
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {item.active ? "On" : "Off"}
                          </span>
                        </button>
                        <RuleHelpTooltip
                          title={item.help.title}
                          content={item.help.content}
                          category={item.help.category}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Super Ball Card with Inline Segmented Doubling Pill */}
                  <div className="rounded-xl border border-border bg-card/40 p-3 space-y-2.5">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                      BidWar special
                    </p>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="flex items-center">
                            <p className="text-xs font-bold text-foreground">
                              Super Ball
                            </p>
                            <RuleHelpTooltip
                              title="Super Ball"
                              content="A special BidWar delivery that can be designated before it is bowled. Eligible runs from that delivery count at double value. Extras are not doubled."
                              category="bidwar"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            One pre-declared Super Ball per innings
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={locked}
                        aria-pressed={keyRules.superBallEnabled}
                        onClick={() =>
                          setKeyRules((p) => ({
                            ...p,
                            superBallEnabled: !p.superBallEnabled,
                          }))
                        }
                        className={cn(
                          "min-h-9 px-2.5 py-1 rounded-lg border text-xs font-bold transition-colors",
                          focusRing,
                          keyRules.superBallEnabled
                            ? "border-amber-400/70 bg-amber-500/15 text-amber-200"
                            : "border-border/70 bg-card text-muted-foreground",
                          locked && "cursor-default",
                        )}
                      >
                        {keyRules.superBallEnabled ? "On" : "Off"}
                      </button>
                    </div>

                    {/* Inline Compact Run Doubling Mode */}
                    {keyRules.superBallEnabled ? (
                      <div className="pt-1 flex items-center gap-2 flex-wrap border-t border-amber-500/20">
                        <div className="flex items-center">
                          <span className="text-[11px] font-semibold text-amber-200 shrink-0">
                            Doubling Mode:
                          </span>
                          <RuleHelpTooltip
                            title="Super Ball Doubling Mode"
                            content="Controls which runs receive double value on a Super Ball. '4 & 6 only' doubles only boundary shots (4 becomes 8, 6 becomes 12). 'All Runs' doubles all runs scored off the bat (1 becomes 2, 2 becomes 4, 4 becomes 8, 6 becomes 12). Extras are not doubled."
                            category="bidwar"
                          />
                        </div>
                        <div className="inline-flex rounded-lg border border-border bg-background/60 p-0.5 text-xs" role="group" aria-label="Super Ball doubling mode">
                          <button
                            type="button"
                            disabled={locked}
                            aria-pressed={keyRules.superBallDoublesBoundariesOnly}
                            onClick={() =>
                              setKeyRules((p) => ({
                                ...p,
                                superBallDoublesBoundariesOnly: true,
                              }))
                            }
                            className={cn(
                              "min-h-9 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors",
                              focusRing,
                              keyRules.superBallDoublesBoundariesOnly
                                ? "bg-amber-500/20 text-amber-200"
                                : "text-muted-foreground hover:text-foreground",
                              locked && "cursor-default",
                            )}
                          >
                            4 & 6 only (2x)
                          </button>
                          <button
                            type="button"
                            disabled={locked}
                            aria-pressed={!keyRules.superBallDoublesBoundariesOnly}
                            onClick={() =>
                              setKeyRules((p) => ({
                                ...p,
                                superBallDoublesBoundariesOnly: false,
                              }))
                            }
                            className={cn(
                              "min-h-9 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors",
                              focusRing,
                              !keyRules.superBallDoublesBoundariesOnly
                                ? "bg-amber-500/20 text-amber-200"
                                : "text-muted-foreground hover:text-foreground",
                              locked && "cursor-default",
                            )}
                          >
                            All Runs (2x)
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Super Over Inline Details if ON */}
                  {keyRules.superOverEnabled ? (
                    <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 flex items-center justify-between gap-3 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px]">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Super Over Config:</span>
                        <RuleHelpTooltip
                          title="Super Over Configuration"
                          content="Tie-break parameters: configure overs per side (default 1), max wickets allowed (default 2), and trigger condition (Automatic prompt on knockout tie, or manual trigger by the scorer)."
                          category="bidwar"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground" htmlFor="super-over-overs">
                          <span>Overs</span>
                          <input
                            id="super-over-overs"
                            name="superOverOvers"
                            autoComplete="off"
                            inputMode="numeric"
                            className={cn(
                              "w-12 h-9 text-center text-xs font-bold tabular-nums rounded border border-border bg-background text-foreground",
                              focusRing,
                            )}
                            disabled={locked}
                            value={keyRules.superOverOvers}
                            onChange={(e) =>
                              setKeyRules((p) => ({ ...p, superOverOvers: e.target.value }))
                            }
                          />
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground" htmlFor="super-over-wickets">
                          <span>Wickets</span>
                          <input
                            id="super-over-wickets"
                            name="superOverWickets"
                            autoComplete="off"
                            inputMode="numeric"
                            className={cn(
                              "w-12 h-9 text-center text-xs font-bold tabular-nums rounded border border-border bg-background text-foreground",
                              focusRing,
                            )}
                            disabled={locked}
                            value={keyRules.superOverWickets}
                            onChange={(e) =>
                              setKeyRules((p) => ({ ...p, superOverWickets: e.target.value }))
                            }
                          />
                        </label>
                        <label className="sr-only" htmlFor="super-over-trigger">
                          Super Over trigger
                        </label>
                        <select
                          id="super-over-trigger"
                          name="superOverTrigger"
                          aria-label="Super Over trigger"
                          className={cn(
                            "h-9 text-xs font-medium rounded border border-border bg-background text-foreground px-2",
                            focusRing,
                          )}
                          disabled={locked}
                          value={keyRules.superOverTrigger}
                          onChange={(e) =>
                            setKeyRules((p) => ({ ...p, superOverTrigger: e.target.value }))
                          }
                        >
                          <option value="manual">Manual trigger</option>
                          <option value="knockout_tie">Knockout tie only</option>
                        </select>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>

              {/* Right Column: Distinct Live Summary & Action Box */}
              <div className="xl:col-span-4 space-y-4 xl:sticky xl:top-4">
                <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-b from-card/90 via-slate-900/90 to-background p-4 sm:p-5 space-y-4 shadow-xl shadow-primary/5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-primary/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                      <h3 className="text-sm font-bold tracking-wide text-foreground text-balance">
                        Rules in Effect
                      </h3>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
                        locked
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                          : "bg-amber-500/20 border border-amber-500/40 text-amber-300",
                      )}
                    >
                      {locked ? "Locked" : dirty ? "Unsaved" : "Draft"}
                    </span>
                  </div>

                  {/* Summary Grid with Distinct Styling */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border/80 bg-background/70 p-2.5 space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        Cricket Format
                      </p>
                      <p className="font-extrabold text-foreground truncate text-xs">
                        {variantOptions.find((v) => v.id === variantId)?.label || "Box Cricket"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-background/70 p-2.5 space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        Ball Type
                      </p>
                      <p className="font-extrabold text-foreground truncate text-xs">
                        {BALL_TYPE_OPTIONS.find((b) => b.id === keyRules.ballType)?.label || "Tennis"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-background/70 p-2.5 space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        Squad / Bench
                      </p>
                      <p className="font-extrabold text-foreground truncate text-xs tabular-nums">
                        {playingCount} XI + {benchCount} bench
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-background/70 p-2.5 space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        Overs / Wickets
                      </p>
                      <p className="font-extrabold text-foreground truncate text-xs tabular-nums">
                        {keyRules.overs} overs · {keyRules.maxWickets} wickets
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-background/70 p-2.5 space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        Balls / Over
                      </p>
                      <p className="font-bold text-foreground truncate text-xs tabular-nums">
                        {keyRules.ballsPerOver}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-background/70 p-2.5 space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        Powerplay
                      </p>
                      <p
                        className={cn(
                          "font-bold truncate text-xs tabular-nums",
                          keyRules.powerplayEnabled && keyRules.powerplayOvers.length === 0
                            ? "text-amber-300"
                            : "text-foreground",
                        )}
                      >
                        {!keyRules.powerplayEnabled
                          ? "Off"
                          : keyRules.powerplayOvers.length === 0
                            ? "On, none selected"
                            : `Overs ${keyRules.powerplayOvers.join(", ")}`}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-background/70 p-2.5 space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        Super Over
                      </p>
                      <p className="font-bold text-foreground truncate text-xs tabular-nums">
                        {keyRules.superOverEnabled ? `${keyRules.superOverOvers} over, on` : "Off"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-background/70 p-2.5 space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        Super Ball
                      </p>
                      <p className={cn("font-bold truncate text-xs", keyRules.superBallEnabled ? "text-amber-300" : "text-foreground")}>
                        {keyRules.superBallEnabled
                          ? keyRules.superBallDoublesBoundariesOnly
                            ? "4 & 6 (2x)"
                            : "All runs (2x)"
                          : "Off"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-1">
                    {!locked ? (
                      <>
                        <BtnPrimary
                          className="w-full justify-center h-9 text-xs font-bold"
                          disabled={!canLock || locking || saving}
                          onClick={() => void handleLock()}
                        >
                          {locking ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finalizing…
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" /> Lock & Finalize Rules
                            </>
                          )}
                        </BtnPrimary>

                        <BtnSecondary
                          className="w-full justify-center h-8 text-xs font-semibold"
                          disabled={saving || locking}
                          onClick={() => void persistSetup()}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                            </>
                          ) : (
                            "Save Draft Changes"
                          )}
                        </BtnSecondary>
                      </>
                    ) : applyConfirm ? (
                      <div className="rounded-lg border border-border bg-background/70 p-3 space-y-2">
                        <p className="text-xs text-foreground">
                          Apply these rules to upcoming matches? Completed matches stay unchanged.
                        </p>
                        <BtnPrimary
                          className={cn("w-full justify-center h-9 text-xs font-bold", focusRing)}
                          disabled={applying}
                          onClick={() => void handleApplyToMatches()}
                        >
                          {applying ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Applying…
                            </>
                          ) : (
                            "Apply to Upcoming Matches"
                          )}
                        </BtnPrimary>
                        <BtnSecondary
                          className={cn("w-full justify-center h-8 text-xs font-semibold", focusRing)}
                          disabled={applying}
                          onClick={() => setApplyConfirm(false)}
                        >
                          Cancel
                        </BtnSecondary>
                      </div>
                    ) : (
                      <>
                        <BtnPrimary
                          className={cn("w-full justify-center h-9 text-xs font-bold", focusRing)}
                          disabled={unlocking}
                          onClick={() => void handleUnlock()}
                        >
                          {unlocking ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Unlocking…
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5" aria-hidden="true" /> Unlock & Edit Rules
                            </>
                          )}
                        </BtnPrimary>

                        <BtnSecondary
                          className={cn("w-full justify-center h-8 text-xs font-semibold", focusRing)}
                          disabled={applying}
                          onClick={() => setApplyConfirm(true)}
                        >
                          <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" /> Apply Rules to Matches
                        </BtnSecondary>
                      </>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-snug text-center text-pretty">
                    {locked
                      ? "Unlock to edit. Apply copies these rules onto upcoming matches. Completed matches stay as played."
                      : "Lock the rules when scoring should use this setup."}
                  </p>
                </div>
              </div>
            </div>

            {/* Create Rule Preset Modal */}
            {createPresetOpen ? (
              <div
                className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setCreatePresetOpen(false);
                }}
              >
                <div
                  ref={presetDialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="new-preset-title"
                  className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-primary" aria-hidden="true" />
                      <h3 id="new-preset-title" className="font-bold text-base text-balance">
                        New Cricket Rule Preset
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Name a setup from the rules on this page, then assign it to fixtures.
                  </p>

                  <div className="space-y-3 text-sm">
                    <div className="space-y-1.5">
                      <label htmlFor="preset-name" className="text-xs font-semibold text-foreground">
                        Preset Name
                      </label>
                      <input
                        ref={presetNameRef}
                        id="preset-name"
                        name="presetName"
                        type="text"
                        autoComplete="off"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground",
                          focusRing,
                        )}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="preset-description" className="text-xs font-semibold text-muted-foreground">
                        Description (optional)
                      </label>
                      <input
                        id="preset-description"
                        name="presetDescription"
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        value={newPresetDesc}
                        onChange={(e) => setNewPresetDesc(e.target.value)}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground",
                          focusRing,
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() => void handleCreatePreset()}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors",
                        focusRing,
                      )}
                    >
                      Create Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatePresetOpen(false)}
                      className={cn(
                        "px-4 py-2 rounded-lg border border-border bg-muted/30 text-foreground text-xs font-semibold hover:bg-muted/60 transition-colors",
                        focusRing,
                      )}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
