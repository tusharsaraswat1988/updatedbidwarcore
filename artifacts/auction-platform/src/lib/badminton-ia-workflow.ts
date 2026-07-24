import { badmintonHubPath } from "./badminton-routes";
import type { BadmintonSetupSnapshot } from "./badminton-setup-workflow";

/**
 * VNBL Phase 2 / 2.5 — organizer lifecycle chapters (not backend modules).
 * Spec: docs/ux/badminton-product-audit.md
 */

export type BadmintonIaStepId =
  | "setup"
  | "participants"
  | "structure"
  | "schedule"
  | "live"
  | "results";

export type BadmintonIaStep = {
  id: BadmintonIaStepId;
  /** Short label for the Linear-style progress strip */
  label: string;
  /** Full label for progress tooltips */
  fullLabel: string;
  /** Page title */
  title: string;
  /** Answers: what is this page for? */
  purpose: string;
  /** Answers: what should I do here? */
  task: string;
  /** Primary continue CTA label */
  continueLabel: string;
  href: (tournamentId: number) => string;
  continueHref: (tournamentId: number) => string;
};

export const BADMINTON_IA_STEPS: BadmintonIaStep[] = [
  {
    id: "setup",
    label: "Setup",
    fullLabel: "Tournament Setup",
    title: "Tournament Setup",
    purpose: "Create the identity of your tournament before anyone arrives.",
    task: "Set name, venue, branding, courts, and default scoring rules.",
    continueLabel: "Continue to Participants",
    href: (id) => `${badmintonHubPath(id)}/branding`,
    continueHref: (id) => `${badmintonHubPath(id)}/players`,
  },
  {
    id: "participants",
    label: "Participants",
    fullLabel: "Participants",
    title: "Participants",
    purpose: "Manage everyone involved in the tournament.",
    task: "Import or add players, then prepare officials and scorers.",
    continueLabel: "Continue to Tournament Structure",
    href: (id) => `${badmintonHubPath(id)}/players`,
    continueHref: (id) => `${badmintonHubPath(id)}/fixtures`,
  },
  {
    id: "structure",
    label: "Structure",
    fullLabel: "Tournament Structure",
    title: "Tournament Structure",
    purpose: "Decide who plays whom.",
    task: "Define events and generate or build the draw.",
    continueLabel: "Continue to Schedule",
    href: (id) => `${badmintonHubPath(id)}/fixtures`,
    continueHref: (id) => `${badmintonHubPath(id)}/schedule`,
  },
  {
    id: "schedule",
    label: "Schedule",
    fullLabel: "Schedule",
    title: "Schedule",
    purpose: "Decide when and where each match happens.",
    task: "Assign court, date, and time on the board.",
    continueLabel: "Go Live",
    href: (id) => `${badmintonHubPath(id)}/schedule`,
    continueHref: (id) => `${badmintonHubPath(id)}/control`,
  },
  {
    id: "live",
    label: "Live",
    fullLabel: "Live Control",
    title: "Live Control",
    purpose: "Run the tournament day from one place.",
    task: "Start matches, watch courts, share scorer and display links.",
    continueLabel: "View Results",
    href: (id) => `${badmintonHubPath(id)}/control`,
    continueHref: (id) => `${badmintonHubPath(id)}/results`,
  },
  {
    id: "results",
    label: "Results",
    fullLabel: "Results",
    title: "Results",
    purpose: "Close the tournament and share outcomes.",
    task: "Review champions, standings, summary, and share links.",
    continueLabel: "Share Tournament",
    href: (id) => `${badmintonHubPath(id)}/results`,
    continueHref: (id) => `${badmintonHubPath(id)}/summary`,
  },
];

export function getBadmintonIaStep(stepId: BadmintonIaStepId): BadmintonIaStep {
  const step = BADMINTON_IA_STEPS.find((s) => s.id === stepId);
  if (!step) throw new Error(`Unknown badminton IA step: ${stepId}`);
  return step;
}

export function badmintonIaStepIndex(stepId: BadmintonIaStepId): number {
  return BADMINTON_IA_STEPS.findIndex((s) => s.id === stepId);
}

/** Whether a chapter's core work is done (for ✓ in the progress strip). */
export function isBadmintonIaChapterComplete(
  stepId: BadmintonIaStepId,
  snapshot: BadmintonSetupSnapshot,
): boolean {
  switch (stepId) {
    case "setup":
      return (
        snapshot.brandingComplete &&
        snapshot.totalCourts > 0 &&
        snapshot.scoringFormatConfigured
      );
    case "participants":
      return snapshot.totalPlayers > 0;
    case "structure":
      return snapshot.totalCategories > 0 && snapshot.totalFixtures > 0;
    case "schedule":
      return snapshot.totalScheduledFixtures > 0;
    case "live":
      return Boolean(snapshot.wizardCompleted) || snapshot.totalScheduledFixtures > 0;
    case "results":
      return false;
    default:
      return false;
  }
}

export type BadmintonIaContinueGate = {
  allowed: boolean;
  /** Organizer-facing reason when blocked */
  reason: string | null;
  /** Suggested action label */
  fixLabel: string | null;
  /** Where to send the organizer to fix the blocker */
  fixHref: ((tournamentId: number) => string) | null;
};

/** Gate the sticky Continue CTA — never leave organizers guessing. */
export function evaluateBadmintonIaContinueGate(
  stepId: BadmintonIaStepId,
  snapshot: BadmintonSetupSnapshot,
): BadmintonIaContinueGate {
  switch (stepId) {
    case "setup": {
      if (!snapshot.brandingComplete) {
        return {
          allowed: false,
          reason: "Add a tournament name before continuing.",
          fixLabel: "Open Identity",
          fixHref: (id) => `${badmintonHubPath(id)}/branding`,
        };
      }
      if (snapshot.totalCourts <= 0) {
        return {
          allowed: false,
          reason: "Add at least one court so matches have a place to play.",
          fixLabel: "Add courts",
          fixHref: (id) => `${badmintonHubPath(id)}/branding?section=courts`,
        };
      }
      if (!snapshot.scoringFormatConfigured) {
        return {
          allowed: false,
          reason: "Save scoring rules so every court scores the same way.",
          fixLabel: "Open Rules",
          fixHref: (id) => `${badmintonHubPath(id)}/branding?section=rules`,
        };
      }
      return { allowed: true, reason: null, fixLabel: null, fixHref: null };
    }
    case "participants": {
      if (snapshot.totalPlayers <= 0) {
        return {
          allowed: false,
          reason: "Import or add players before building the draw.",
          fixLabel: "Add players",
          fixHref: (id) => `${badmintonHubPath(id)}/players`,
        };
      }
      return { allowed: true, reason: null, fixLabel: null, fixHref: null };
    }
    case "structure": {
      if (snapshot.totalCategories <= 0) {
        return {
          allowed: false,
          reason: "Create at least one event (for example Men's Singles).",
          fixLabel: "Add event",
          fixHref: (id) => `${badmintonHubPath(id)}/fixtures?section=events`,
        };
      }
      if (snapshot.totalFixtures <= 0) {
        return {
          allowed: false,
          reason: "Generate or create a draw so Schedule has matches to place.",
          fixLabel: "Open Draw",
          fixHref: (id) => `${badmintonHubPath(id)}/fixtures?section=draw`,
        };
      }
      return { allowed: true, reason: null, fixLabel: null, fixHref: null };
    }
    case "schedule": {
      if (snapshot.totalFixtures <= 0) {
        return {
          allowed: false,
          reason: "Generate a draw first — then assign courts and times.",
          fixLabel: "Open Tournament Structure",
          fixHref: (id) => `${badmintonHubPath(id)}/fixtures`,
        };
      }
      if (snapshot.totalScheduledFixtures <= 0) {
        return {
          allowed: false,
          reason: "Assign court and time to at least one match before going live.",
          fixLabel: null,
          fixHref: null,
        };
      }
      return { allowed: true, reason: null, fixLabel: null, fixHref: null };
    }
    case "live":
    case "results":
      return { allowed: true, reason: null, fixLabel: null, fixHref: null };
    default:
      return { allowed: true, reason: null, fixLabel: null, fixHref: null };
  }
}

/**
 * Progress strip click rules:
 * - completed → clickable
 * - current → clickable
 * - next incomplete → clickable only if previous chapter complete
 * - further ahead → locked
 */
export function isBadmintonIaStepClickable(
  targetId: BadmintonIaStepId,
  currentId: BadmintonIaStepId,
  snapshot: BadmintonSetupSnapshot,
): boolean {
  const targetIndex = badmintonIaStepIndex(targetId);
  const currentIndex = badmintonIaStepIndex(currentId);
  if (targetIndex < 0 || currentIndex < 0) return false;
  if (targetIndex === currentIndex) return true;
  if (isBadmintonIaChapterComplete(targetId, snapshot)) return true;
  if (targetIndex === currentIndex + 1) {
    return isBadmintonIaChapterComplete(currentId, snapshot);
  }
  // Allow going back to any earlier chapter
  if (targetIndex < currentIndex) return true;
  return false;
}

/** Map a pathname onto the IA chapter (for progress highlight). */
export function pathToBadmintonIaStep(pathname: string): BadmintonIaStepId | null {
  const path = (pathname.split("?")[0] ?? pathname).split("#")[0] ?? pathname;
  if (/\/badminton\/branding|\/badminton\/courts|\/badminton\/scoring-format/.test(path)) {
    return "setup";
  }
  if (/\/badminton\/players|\/badminton\/scorers/.test(path)) return "participants";
  if (/\/badminton\/fixtures|\/badminton\/categories/.test(path)) return "structure";
  if (/\/badminton\/schedule/.test(path)) return "schedule";
  if (
    /\/badminton\/control|\/badminton\/broadcast|\/badminton\/matches/.test(path)
  ) {
    return "live";
  }
  if (/\/badminton\/results|\/badminton\/summary|\/badminton\/analytics/.test(path)) {
    return "results";
  }
  return null;
}
