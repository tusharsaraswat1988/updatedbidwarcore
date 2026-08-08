/**
 * Tournament Dashboard presenter — experience translator only.
 *
 * Input: authoritative ModuleSnapshots (incl. Runtime).
 * Output: sport-aware organiser setup/ready/onboarding state + one CTA.
 * Does not invent readiness rules or expose Runtime as a journey step.
 */

import type { ModuleWorkspaceId } from "../components/platform/module-workspace";
import type { ModuleSnapshot } from "../components/tournament-hub/module-registry";
import type { SportCapabilities } from "./sports-shell-types";
import { sportsMissionControlPath } from "./tournament-navigation";
import {
  getSportOrganiserVocabulary,
  translateOrganiserIssue,
  type OrganiserJourneyStepId,
} from "./tournament-dashboard-vocabulary";

export type { OrganiserJourneyStepId };

export type OrganiserJourneyState = "complete" | "next" | "upcoming";

export type OrganiserJourneyStep = {
  id: OrganiserJourneyStepId;
  label: string;
  state: OrganiserJourneyState;
};

export type PresenterContinue =
  | { kind: "route"; href: string }
  | { kind: "focus-module"; moduleId: ModuleWorkspaceId };

export type MissionControlNextStep = {
  title: string;
  description: string;
  ctaLabel: string;
  continue: PresenterContinue;
  stepId: OrganiserJourneyStepId | "ready" | "onboarding";
};

export type TournamentDashboardMode = "onboarding" | "setup" | "ready";

export type OrganiserAttentionItem = {
  title: string;
  detail: string;
};

export type MissionControlPresenterView = {
  mode: TournamentDashboardMode;
  journey: OrganiserJourneyStep[];
  nextStep: MissionControlNextStep;
  scoring: {
    href: string | null;
    label: string;
  };
  liveOps: {
    available: boolean;
    primaryHref: string | null;
    primaryTitle: string | null;
  };
  remainingStepTitles: string[];
  /** Translated organiser-facing attention — never raw engine jargon. */
  attention: OrganiserAttentionItem[];
};

/** Module-backed setup order — Runtime is never included. */
export const ORGANISER_JOURNEY_ORDER: {
  id: OrganiserJourneyStepId;
  moduleId: ModuleWorkspaceId;
}[] = [
  { id: "competition", moduleId: "competition" },
  { id: "teams", moduleId: "teams" },
  { id: "fixtures", moduleId: "fixtures" },
  { id: "schedule", moduleId: "scheduling" },
  { id: "matches", moduleId: "matches" },
];

export function isModuleStepComplete(snapshot: ModuleSnapshot | undefined): boolean {
  if (!snapshot || snapshot.loading) return false;
  if (snapshot.locked === true) return true;
  if (snapshot.readiness === "ready") return true;
  if (snapshot.entityCount > 0 && snapshot.lockedCount >= snapshot.entityCount) {
    return true;
  }
  return false;
}

export function isRuntimeReady(snapshot: ModuleSnapshot | undefined): boolean {
  if (!snapshot || snapshot.loading) return false;
  if (snapshot.errorCount > 0) return false;
  if (snapshot.readiness === "ready") return true;
  if (snapshot.entityCount > 0 && snapshot.lockedCount >= snapshot.entityCount) {
    return true;
  }
  return false;
}

function snapshotsLoading(
  snapshots: Partial<Record<ModuleWorkspaceId, ModuleSnapshot>>,
): boolean {
  const setupIds: ModuleWorkspaceId[] = [
    "competition",
    "teams",
    "fixtures",
    "scheduling",
    "matches",
    "runtime",
  ];
  return setupIds.some((id) => {
    const snap = snapshots[id];
    return snap == null || snap.loading;
  });
}

/** Fresh tournament: no setup step complete yet. */
export function isFreshTournamentSetup(
  snapshots: Partial<Record<ModuleWorkspaceId, ModuleSnapshot>>,
): boolean {
  return ORGANISER_JOURNEY_ORDER.every(
    (step) => !isModuleStepComplete(snapshots[step.moduleId]),
  );
}

function buildTranslatedAttention(
  snapshots: Partial<Record<ModuleWorkspaceId, ModuleSnapshot>>,
  caps: SportCapabilities,
  activeStepId: OrganiserJourneyStepId | null,
): OrganiserAttentionItem[] {
  const items: OrganiserAttentionItem[] = [];
  const seen = new Set<string>();

  const modulesToScan: ModuleWorkspaceId[] = activeStepId
    ? [
        ORGANISER_JOURNEY_ORDER.find((s) => s.id === activeStepId)?.moduleId ?? "competition",
        "runtime",
      ]
    : ["competition", "teams", "fixtures", "scheduling", "matches", "runtime"];

  for (const moduleId of modulesToScan) {
    const snap = snapshots[moduleId];
    if (!snap) continue;
    for (const issue of snap.validationIssues) {
      if (issue.severity !== "ERROR") continue;
      const translated = translateOrganiserIssue(
        { code: issue.code, message: issue.message },
        caps,
      );
      if (!translated?.actionable) continue;
      const key = `${translated.title}|${translated.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ title: translated.title, detail: translated.detail });
      if (items.length >= 3) return items;
    }
  }
  return items;
}

function resolveContinue(input: {
  stepId: OrganiserJourneyStepId | "onboarding";
  tournamentId: number;
  caps: SportCapabilities;
  matchDayPrep: boolean;
}): PresenterContinue {
  const { stepId, tournamentId, caps, matchDayPrep } = input;
  const destinations = caps.missionControlDestinations;

  if (stepId === "onboarding" || stepId === "competition") {
    const href = destinations?.tournament?.(tournamentId) ?? destinations?.teams?.(tournamentId);
    if (href) return { kind: "route", href };
    // Prefer not to dump organisers into the technical competition card when a
    // sport destination exists; only focus as last resort.
    return { kind: "focus-module", moduleId: "competition" };
  }

  if (stepId === "teams") {
    const href = destinations?.teams?.(tournamentId);
    if (href) return { kind: "route", href };
    return {
      kind: "route",
      href: `/tournament/${tournamentId}/teams?from=${encodeURIComponent(sportsMissionControlPath(tournamentId))}`,
    };
  }

  if (stepId === "fixtures") {
    const href = destinations?.fixtures?.(tournamentId);
    if (href) return { kind: "route", href };
    return { kind: "focus-module", moduleId: "fixtures" };
  }

  if (stepId === "schedule") {
    const href = destinations?.schedule?.(tournamentId);
    if (href) return { kind: "route", href };
    return { kind: "focus-module", moduleId: "scheduling" };
  }

  // Match day prep / match setup: never surface Runtime module to organisers.
  if (matchDayPrep) {
    const href =
      destinations?.scoring?.(tournamentId) ?? destinations?.schedule?.(tournamentId);
    if (href) return { kind: "route", href };
    return { kind: "focus-module", moduleId: "matches" };
  }
  return { kind: "focus-module", moduleId: "matches" };
}

function scoringHref(
  tournamentId: number,
  caps: SportCapabilities,
  liveHref: string | null,
): string | null {
  return caps.missionControlDestinations?.scoring?.(tournamentId) ?? liveHref;
}

export function buildMissionControlPresenterView(input: {
  tournamentId: number;
  snapshots: Partial<Record<ModuleWorkspaceId, ModuleSnapshot>>;
  capabilities: SportCapabilities;
  encodedReturnTo?: string;
}): MissionControlPresenterView {
  const { tournamentId, snapshots, capabilities } = input;
  const vocab = getSportOrganiserVocabulary(capabilities);
  const encodedReturnTo =
    input.encodedReturnTo ??
    encodeURIComponent(sportsMissionControlPath(tournamentId));

  const loading = snapshotsLoading(snapshots);
  const matchesComplete = isModuleStepComplete(snapshots.matches);
  const runtimeReady = isRuntimeReady(snapshots.runtime);
  const tournamentReady = matchesComplete && runtimeReady;

  const primaryLink = capabilities.liveOpsLinks[0] ?? null;
  const primaryLiveHref = primaryLink
    ? primaryLink.buildHref({ tournamentId, encodedReturnTo })
    : null;
  const openScoringHref = scoringHref(tournamentId, capabilities, primaryLiveHref);

  const labeledJourney = (activeStepId: OrganiserJourneyStepId | null) => {
    const activeIndex =
      activeStepId == null
        ? -1
        : ORGANISER_JOURNEY_ORDER.findIndex((s) => s.id === activeStepId);
    return ORGANISER_JOURNEY_ORDER.map((step, stepIndex) => {
      const label = vocab.journeyLabels[step.id];
      if (activeStepId != null && step.id === activeStepId) {
        return { id: step.id, label, state: "next" as const };
      }
      if (activeIndex >= 0 && stepIndex < activeIndex) {
        return { id: step.id, label, state: "complete" as const };
      }
      if (activeStepId == null) {
        return { id: step.id, label, state: "upcoming" as const };
      }
      return { id: step.id, label, state: "upcoming" as const };
    });
  };

  if (loading) {
    return {
      mode: "onboarding",
      journey: labeledJourney(null),
      nextStep: {
        ...vocab.onboarding,
        stepId: "onboarding",
        continue: resolveContinue({
          stepId: "onboarding",
          tournamentId,
          caps: capabilities,
          matchDayPrep: false,
        }),
      },
      scoring: { href: null, label: vocab.openScoringLabel },
      liveOps: { available: false, primaryHref: null, primaryTitle: null },
      remainingStepTitles: ORGANISER_JOURNEY_ORDER.map((s) => vocab.journeyLabels[s.id]),
      attention: [],
    };
  }

  // Fresh tournament — calm onboarding, no diagnostics.
  if (isFreshTournamentSetup(snapshots) && !tournamentReady) {
    return {
      mode: "onboarding",
      journey: labeledJourney(null),
      nextStep: {
        ...vocab.onboarding,
        stepId: "onboarding",
        continue: resolveContinue({
          stepId: "onboarding",
          tournamentId,
          caps: capabilities,
          matchDayPrep: false,
        }),
      },
      scoring: { href: null, label: vocab.openScoringLabel },
      liveOps: { available: false, primaryHref: null, primaryTitle: null },
      remainingStepTitles: ORGANISER_JOURNEY_ORDER.map((s) => vocab.journeyLabels[s.id]),
      attention: [],
    };
  }

  let activeStepId: OrganiserJourneyStepId | null = null;
  for (const step of ORGANISER_JOURNEY_ORDER) {
    if (!isModuleStepComplete(snapshots[step.moduleId])) {
      activeStepId = step.id;
      break;
    }
  }

  const matchDayPrep = activeStepId == null && !tournamentReady;
  if (activeStepId == null && matchDayPrep) {
    activeStepId = "matches";
  }

  if (activeStepId == null && tournamentReady) {
    return {
      mode: "ready",
      journey: ORGANISER_JOURNEY_ORDER.map((step) => ({
        id: step.id,
        label: vocab.journeyLabels[step.id],
        state: "complete" as const,
      })),
      nextStep: {
        ...vocab.ready,
        stepId: "ready",
        continue: openScoringHref
          ? { kind: "route", href: openScoringHref }
          : { kind: "focus-module", moduleId: "live_operations" },
      },
      scoring: {
        href: openScoringHref,
        label: vocab.openScoringLabel,
      },
      liveOps: {
        available: true,
        primaryHref: primaryLiveHref,
        primaryTitle: primaryLink?.title ?? vocab.liveOpsFallbackTitle,
      },
      remainingStepTitles: [],
      attention: [],
    };
  }

  const stepId = activeStepId ?? "competition";
  const copy = vocab.stepCopy(stepId, { matchDayPrep });
  const journey = labeledJourney(stepId);
  const continueTarget = resolveContinue({
    stepId,
    tournamentId,
    caps: capabilities,
    matchDayPrep,
  });

  return {
    mode: "setup",
    journey,
    nextStep: {
      ...copy,
      stepId,
      continue: continueTarget,
    },
    scoring: { href: null, label: vocab.openScoringLabel },
    liveOps: {
      available: false,
      primaryHref: null,
      primaryTitle: null,
    },
    remainingStepTitles: journey.filter((s) => s.state !== "complete").map((s) => s.label),
    attention: buildTranslatedAttention(snapshots, capabilities, stepId),
  };
}
