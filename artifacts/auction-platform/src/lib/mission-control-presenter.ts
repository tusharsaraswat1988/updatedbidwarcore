/**
 * Tournament Dashboard presenter — experience translator only.
 *
 * Input: authoritative ModuleSnapshots (incl. Runtime).
 * Output: organiser setup/ready state + one primary CTA + Hybrid Continue.
 * Does not invent readiness rules or expose Runtime as a journey step.
 */

import type { ModuleWorkspaceId } from "../components/platform/module-workspace";
import type { ModuleSnapshot } from "../components/tournament-hub/module-registry";
import type { SportCapabilities } from "./sports-shell-types";
import { sportsMissionControlPath } from "./tournament-navigation";

/** Setup journey step ids — Runtime and Live are never organiser journey steps. */
export type OrganiserJourneyStepId =
  | "competition"
  | "teams"
  | "fixtures"
  | "schedule"
  | "matches";

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
  /** Organiser-facing step this action advances. */
  stepId: OrganiserJourneyStepId | "ready";
};

export type TournamentDashboardMode = "setup" | "ready";

export type MissionControlPresenterView = {
  mode: TournamentDashboardMode;
  /** Setup checklist — empty when mode is ready. */
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
};

/** Organiser setup journey — Runtime is never included. */
export const ORGANISER_JOURNEY_ORDER: {
  id: OrganiserJourneyStepId;
  label: string;
  moduleId: ModuleWorkspaceId;
}[] = [
  { id: "competition", label: "Competition", moduleId: "competition" },
  { id: "teams", label: "Teams & Players", moduleId: "teams" },
  { id: "fixtures", label: "Fixtures", moduleId: "fixtures" },
  { id: "schedule", label: "Schedule", moduleId: "scheduling" },
  { id: "matches", label: "Match Setup", moduleId: "matches" },
];

/**
 * Completeness from existing snapshot signals only.
 * Prefer locked / readiness / lockedCount vs entityCount.
 * Never treat empty blockers as complete.
 */
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

type NextCopy = {
  title: string;
  description: string;
  ctaLabel: string;
};

function copyForStep(
  stepId: OrganiserJourneyStepId,
  opts: { matchDayPrep: boolean },
): NextCopy {
  if (stepId === "matches" && opts.matchDayPrep) {
    return {
      title: "Finish Match Setup",
      description: "A few match preparations are still needed before you can score.",
      ctaLabel: "Continue Setup",
    };
  }

  switch (stepId) {
    case "competition":
      return {
        title: "Competition setup isn't complete",
        description: "Choose the competition type and how teams will register.",
        ctaLabel: "Continue Setup",
      };
    case "teams":
      return {
        title: "Add Teams & Players",
        description: "Create the teams and players competing in this tournament.",
        ctaLabel: "Continue Setup",
      };
    case "fixtures":
      return {
        title: "Create Fixtures",
        description: "Build the tournament draw and structure.",
        ctaLabel: "Continue Setup",
      };
    case "schedule":
      return {
        title: "Schedule your matches",
        description: "Assign courts or venues, dates and times.",
        ctaLabel: "Continue Setup",
      };
    case "matches":
      return {
        title: "Finish Match Setup",
        description: "Confirm match sides and officials for match day.",
        ctaLabel: "Continue Setup",
      };
  }
}

function resolveContinue(input: {
  stepId: OrganiserJourneyStepId;
  tournamentId: number;
  caps: SportCapabilities;
  matchDayPrep: boolean;
}): PresenterContinue {
  const { stepId, tournamentId, caps, matchDayPrep } = input;
  const destinations = caps.missionControlDestinations;

  if (stepId === "competition") {
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

  if (matchDayPrep) {
    return { kind: "focus-module", moduleId: "runtime" };
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

  if (loading) {
    const journey: OrganiserJourneyStep[] = ORGANISER_JOURNEY_ORDER.map((step, index) => ({
      id: step.id,
      label: step.label,
      state: index === 0 ? "next" : "upcoming",
    }));
    const copy = copyForStep("competition", { matchDayPrep: false });
    return {
      mode: "setup",
      journey,
      nextStep: {
        ...copy,
        stepId: "competition",
        continue: { kind: "focus-module", moduleId: "competition" },
      },
      scoring: { href: null, label: "Open Scoring" },
      liveOps: {
        available: false,
        primaryHref: null,
        primaryTitle: null,
      },
      remainingStepTitles: ORGANISER_JOURNEY_ORDER.map((s) => s.label),
    };
  }

  // Find first incomplete setup step. Runtime only gates ready mode.
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

  // STATE B — tournament ready
  if (activeStepId == null && tournamentReady) {
    return {
      mode: "ready",
      journey: [],
      nextStep: {
        title: "Your tournament is ready",
        description: "Open scoring when you are ready to run matches.",
        ctaLabel: "Open Scoring",
        stepId: "ready",
        continue: openScoringHref
          ? { kind: "route", href: openScoringHref }
          : { kind: "focus-module", moduleId: "live_operations" },
      },
      scoring: {
        href: openScoringHref,
        label: "Open Scoring",
      },
      liveOps: {
        available: true,
        primaryHref: primaryLiveHref,
        primaryTitle: primaryLink?.title ?? "Live Operations",
      },
      remainingStepTitles: [],
    };
  }

  // STATE A — setup in progress
  const stepId = activeStepId ?? "competition";
  const activeIndex = ORGANISER_JOURNEY_ORDER.findIndex((s) => s.id === stepId);

  const journey: OrganiserJourneyStep[] = ORGANISER_JOURNEY_ORDER.map((step, stepIndex) => {
    if (step.id === stepId) {
      return { id: step.id, label: step.label, state: "next" };
    }
    if (stepIndex < activeIndex) {
      return { id: step.id, label: step.label, state: "complete" };
    }
    return { id: step.id, label: step.label, state: "upcoming" };
  });

  const copy = copyForStep(stepId, { matchDayPrep });
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
    scoring: { href: null, label: "Open Scoring" },
    liveOps: {
      available: false,
      primaryHref: null,
      primaryTitle: null,
    },
    remainingStepTitles: journey.filter((s) => s.state !== "complete").map((s) => s.label),
  };
}
