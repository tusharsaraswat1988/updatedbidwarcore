export type BadmintonSetupStepId =
  | "branding"
  | "players"
  | "categories"
  | "scoring_format"
  | "courts"
  | "draws"
  | "scheduling"
  | "ready";

export type BadmintonSetupItemStatus = "completed" | "current" | "upcoming";

export interface BadmintonSetupStep {
  id: BadmintonSetupStepId;
  order: number;
  /** Short label for the wizard progress strip */
  label: string;
  /** Page title shown in the page header */
  title: string;
  /** One-line purpose under the title */
  purpose: string;
  /** Helper copy explaining why this step exists */
  helperText: string;
  /** Why this step is required when incomplete */
  requiredWhy: string;
  /** What is missing when incomplete */
  missingLabel: string;
  href: (tournamentId: number) => string;
}

/** Ordered Tournament Setup Wizard — ends at Ready. Ops (Matches/Control) come after. */
export const BADMINTON_SETUP_STEPS: BadmintonSetupStep[] = [
  {
    id: "branding",
    order: 1,
    label: "Tournament",
    title: "Tournament Details",
    purpose: "Set the name, logo, venue, and organizer for this tournament.",
    helperText:
      "This information appears on scoreboards and helps players recognize your event.",
    missingLabel: "Tournament name is missing",
    requiredWhy: "A display name is required so scoreboards and public pages can identify the event.",
    href: (id) => `/tournament/${id}/badminton/branding`,
  },
  {
    id: "players",
    order: 2,
    label: "Players",
    title: "Players",
    purpose: "Confirm who will compete in this tournament.",
    helperText:
      "Players imported from Auction can now be assigned to tournament events.",
    missingLabel: "No players registered yet",
    requiredWhy: "You need at least one player before you can create events and draws.",
    href: (id) => `/tournament/${id}/badminton/players`,
  },
  {
    id: "categories",
    order: 3,
    label: "Events",
    title: "Events",
    purpose: "Events define what competitions will be played.",
    helperText:
      "Examples: Men's Singles, Women's Singles, Mixed Doubles.",
    missingLabel: "No events created yet",
    requiredWhy: "Events tell the draw which competitions to build fixtures for.",
    href: (id) => `/tournament/${id}/badminton/categories`,
  },
  {
    id: "scoring_format",
    order: 4,
    label: "Scoring Rules",
    title: "Scoring Rules",
    purpose: "These rules apply to matches in this tournament.",
    helperText: "Examples: 21 Points, 15 Points, Best of 3.",
    missingLabel: "Scoring rules not saved",
    requiredWhy: "Matches need a scoring format before umpires can start scoring.",
    href: (id) => `/tournament/${id}/badminton/scoring-format`,
  },
  {
    id: "courts",
    order: 5,
    label: "Courts",
    title: "Courts",
    purpose: "Court setup also defines scorer assignment.",
    helperText:
      "Each court can have a default Scorer PIN. Matches inherit that PIN unless a match PIN overrides it.",
    missingLabel: "No courts added yet",
    requiredWhy: "Scheduling needs at least one court to assign where matches are played.",
    href: (id) => `/tournament/${id}/badminton/courts`,
  },
  {
    id: "draws",
    order: 6,
    label: "Tournament Draw",
    title: "Tournament Draw",
    purpose: "This determines who plays whom.",
    helperText:
      "Generate Automatically, Import Existing Draw, or Create Manually.",
    missingLabel: "No draw or fixtures yet",
    requiredWhy: "Fixtures are required before you can assign courts and times.",
    href: (id) => `/tournament/${id}/badminton/fixtures`,
  },
  {
    id: "scheduling",
    order: 7,
    label: "Court Schedule",
    title: "Court Schedule",
    purpose: "Assign courts and times before matches begin.",
    helperText:
      "This determines where and when each match will be played.",
    missingLabel: "No fixtures scheduled yet",
    requiredWhy: "At least one fixture needs a court and time before the tournament is ready.",
    href: (id) => `/tournament/${id}/badminton/schedule`,
  },
  {
    id: "ready",
    order: 8,
    label: "Ready",
    title: "Tournament Ready",
    purpose: "Review setup, then open live operations.",
    helperText: "When every step is complete, your tournament is ready to run.",
    missingLabel: "Setup is not finished",
    requiredWhy: "Finish the earlier steps before opening live operations.",
    href: (id) => `/tournament/${id}/badminton`,
  },
];

export interface BadmintonSetupSnapshot {
  brandingComplete: boolean;
  totalPlayers: number;
  totalCategories: number;
  scoringFormatConfigured: boolean;
  totalFixtures: number;
  totalCourts: number;
  /** Fixtures with court + time assigned. */
  totalScheduledFixtures: number;
  /**
   * True after the organizer leaves the Ready step (Open Live Operations).
   * Stored client-side — no API/schema change.
   */
  wizardCompleted?: boolean;
}

export interface BadmintonSetupItem extends BadmintonSetupStep {
  /** True only when this step and every prerequisite are complete. */
  done: boolean;
  locked: boolean;
  status: BadmintonSetupItemStatus;
}

/**
 * Evaluates setup with strict sequential dependencies.
 * A step cannot be marked done (or unlocked) until all previous steps are done.
 * Ready is complete only when every prior step is complete.
 */
export function evaluateBadmintonSetup(snapshot: BadmintonSetupSnapshot): BadmintonSetupItem[] {
  const priorComplete =
    snapshot.brandingComplete &&
    snapshot.totalPlayers > 0 &&
    snapshot.totalCategories > 0 &&
    snapshot.scoringFormatConfigured &&
    snapshot.totalCourts > 0 &&
    snapshot.totalFixtures > 0 &&
    snapshot.totalScheduledFixtures > 0;

  const rawDone: Record<BadmintonSetupStepId, boolean> = {
    branding: snapshot.brandingComplete,
    players: snapshot.totalPlayers > 0,
    categories: snapshot.totalCategories > 0,
    scoring_format: snapshot.scoringFormatConfigured,
    courts: snapshot.totalCourts > 0,
    draws: snapshot.totalFixtures > 0,
    scheduling: snapshot.totalScheduledFixtures > 0,
    // Ready completes only after organizer opens live operations
    ready: priorComplete && Boolean(snapshot.wizardCompleted),
  };

  const items: BadmintonSetupItem[] = [];
  let chainBroken = false;

  for (const step of BADMINTON_SETUP_STEPS) {
    if (chainBroken) {
      items.push({ ...step, done: false, locked: true, status: "upcoming" });
      continue;
    }

    if (rawDone[step.id]) {
      items.push({ ...step, done: true, locked: false, status: "completed" });
      continue;
    }

    items.push({ ...step, done: false, locked: false, status: "current" });
    chainBroken = true;
  }

  return items;
}

export function getNextSetupStep(items: BadmintonSetupItem[]): BadmintonSetupItem | null {
  return items.find((item) => item.status === "current") ?? null;
}

export function getSetupStepById(
  items: BadmintonSetupItem[],
  stepId: BadmintonSetupStepId,
): BadmintonSetupItem | null {
  return items.find((item) => item.id === stepId) ?? null;
}

export function getPreviousSetupStep(
  stepId: BadmintonSetupStepId,
): BadmintonSetupStep | null {
  const index = BADMINTON_SETUP_STEPS.findIndex((step) => step.id === stepId);
  if (index <= 0) return null;
  return BADMINTON_SETUP_STEPS[index - 1] ?? null;
}

export function getFollowingSetupStep(
  stepId: BadmintonSetupStepId,
): BadmintonSetupStep | null {
  const index = BADMINTON_SETUP_STEPS.findIndex((step) => step.id === stepId);
  if (index < 0 || index >= BADMINTON_SETUP_STEPS.length - 1) return null;
  return BADMINTON_SETUP_STEPS[index + 1] ?? null;
}

export function setupProgress(items: BadmintonSetupItem[]) {
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const remaining = total - doneCount;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const complete = doneCount === total;
  return { doneCount, total, remaining, percent, complete };
}

/** True when all setup steps through scheduling are done (Ready unlocked / current). */
export function isTournamentSetupReady(items: BadmintonSetupItem[]): boolean {
  return items.every((item) => item.id === "ready" || item.done);
}

/** localStorage key — marks that the organizer finished the Ready step. */
export function badmintonWizardCompletedKey(tournamentId: number): string {
  return `badminton-setup-wizard-complete:v1:${tournamentId}`;
}

export function readWizardCompleted(tournamentId: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(badmintonWizardCompletedKey(tournamentId)) === "1";
  } catch {
    return false;
  }
}

export function markWizardCompleted(tournamentId: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(badmintonWizardCompletedKey(tournamentId), "1");
  } catch {
    // ignore quota / private mode
  }
}

export function pathToSetupStepId(pathname: string): BadmintonSetupStepId | null {
  if (/\/badminton\/branding/.test(pathname)) return "branding";
  if (/\/badminton\/players/.test(pathname)) return "players";
  if (/\/badminton\/categories/.test(pathname)) return "categories";
  if (/\/badminton\/scoring-format/.test(pathname)) return "scoring_format";
  if (/\/badminton\/courts/.test(pathname)) return "courts";
  if (/\/badminton\/fixtures/.test(pathname)) return "draws";
  if (/\/badminton\/schedule/.test(pathname)) return "scheduling";
  if (/\/badminton\/?$/.test(pathname) || /\/badminton\/?\?/.test(pathname)) return "ready";
  return null;
}
