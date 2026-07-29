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
  /** What is this? */
  what: string;
  /** Why is it needed? */
  why: string;
  /** What happens after this? */
  after: string;
  /** Optional concrete examples for non-experts */
  examples?: string[];
  /** Helper copy explaining why this step exists (legacy / checklist) */
  helperText: string;
  /** Why this step is required when incomplete */
  requiredWhy: string;
  /** What is missing when incomplete */
  missingLabel: string;
  href: (tournamentId: number) => string;
}

/** Ordered Tournament Setup Wizard — ends at Ready. Live Control / Matches come after. */
export const BADMINTON_SETUP_STEPS: BadmintonSetupStep[] = [
  {
    id: "branding",
    order: 1,
    label: "Identity & Branding",
    title: "Identity & Branding",
    purpose: "This creates the basic identity of your tournament.",
    what: "Identity & Branding creates the basic identity of your tournament — name, logo, venue, and organizer.",
    why: "Players, fixtures, schedules, and displays will all use this information so everyone recognizes the same event.",
    after: "After this step you will import players.",
    examples: ["Summer Open 2026", "City Sports Complex", "Organizer name on scoreboards"],
    helperText: "Players, fixtures, schedules and displays will all use this information.",
    missingLabel: "Tournament name is missing",
    requiredWhy: "A tournament name is required so scoreboards and public pages can identify the event.",
    href: (id) => `/tournament/${id}/badminton/branding`,
  },
  {
    id: "players",
    order: 2,
    label: "Players",
    title: "Players",
    purpose: "Players are the people who will participate.",
    what: "Players are the people who will participate in your tournament.",
    why: "If imported from Player Registry, their teams will automatically be available throughout scoring — you do not re-enter team names later.",
    after: "After this step you will create Events — the competitions those players enter.",
    examples: ["Imported from Player Registry", "Walk-in player added manually"],
    helperText:
      "If imported from Player Registry, their teams will automatically be available throughout scoring.",
    missingLabel: "No players registered yet",
    requiredWhy: "You need at least one player before you can create events and draws.",
    href: (id) => `/tournament/${id}/badminton/players`,
  },
  {
    id: "categories",
    order: 3,
    label: "Events",
    title: "Events",
    purpose: "Define competitions and entries for this tournament.",
    what: "Events define which competitions will be played and who is entered (Tournament Structure → Events).",
    why: "Each event later gets its own Draw (who plays whom), Schedule (when/where), and Champion.",
    after: "After this step you will set Rules — how matches are won.",
    examples: ["Men's Singles", "Women's Doubles", "Mixed Doubles"],
    helperText: "Each event will later get a draw, a schedule, and a champion.",
    missingLabel: "No events created yet",
    requiredWhy: "Events tell the draw which competitions to build — without events there is nothing to play.",
    href: (id) => `/tournament/${id}/badminton/fixtures?section=events`,
  },
  {
    id: "scoring_format",
    order: 4,
    label: "Rules",
    title: "Rules",
    purpose: "Rules decide how matches are won.",
    what: "Rules decide how matches are won — points per game and how many games (Tournament Setup → Rules).",
    why: "These rules automatically apply to matches so every court scores the same way.",
    after: "After this step you will add Courts — where matches will be played.",
    examples: ["21 Points", "15 Points", "Best of 3 Games"],
    helperText: "These rules will automatically apply to matches.",
    missingLabel: "Scoring rules not saved",
    requiredWhy: "Matches need scoring rules before scorers can start scoring.",
    href: (id) => `/tournament/${id}/badminton/branding?section=rules`,
  },
  {
    id: "courts",
    order: 5,
    label: "Courts",
    title: "Courts",
    purpose: "Courts are where matches will be played.",
    what: "Courts are the physical playing areas where matches will be played (Tournament Setup → Courts).",
    why: "Each court may have a scorer and display so match day runs without confusion.",
    after: "After this step you will create the Draw — who plays whom.",
    examples: ["Court 1", "Court 2", "Center Court"],
    helperText:
      "Scorers sign in with mobile and personal PIN. Optional legacy court codes are not used for login.",
    missingLabel: "No courts added yet",
    requiredWhy: "Scheduling needs at least one court to assign where matches are played.",
    href: (id) => `/tournament/${id}/badminton/branding?section=courts`,
  },
  {
    id: "draws",
    order: 6,
    label: "Draw",
    title: "Draw",
    purpose: "The draw decides who plays whom in each event.",
    what: "The draw (Tournament Structure → Draw) decides who plays whom in each event.",
    why: "Generate Automatically, Import Existing Draw, or Create Manually creates planned match-ups for each event.",
    after: "After this step you will build the Schedule — where and when each fixture is played.",
    examples: ["Generate Automatically", "Import Existing Draw", "Create Manually"],
    helperText:
      "Auto-generate supports Knockout, Round Robin, and Group + Knockout based on each event’s draw type. You can also import a CSV or enter pairings manually.",
    missingLabel: "No draw yet",
    requiredWhy: "You need a draw before you can assign courts and times.",
    href: (id) => `/tournament/${id}/badminton/fixtures?section=draw`,
  },
  {
    id: "scheduling",
    order: 7,
    label: "Schedule",
    title: "Schedule",
    purpose: "Schedule assigns each fixture to a court and time (setup only — it does not start scoring).",
    what: "Schedule assigns each fixture to a court and time. It schedules fixtures, not live Matches.",
    why: "Scheduling happens AFTER the draw — first you know who plays whom, then you place those fixtures on courts and times. To start scoring, create a Match from Live Control → Matches, then open Match Control.",
    after: "Next: Live Control → Matches (create match) → Match Control (start). Scorer Home only shows matches that already have a court and time.",
    examples: ["Court 1 · 10:00 AM", "Court 2 · 10:30 AM"],
    helperText: "This page schedules fixtures. Start matches from Live Control → Matches → Match Control.",
    missingLabel: "No fixtures scheduled yet",
    requiredWhy: "At least one fixture needs a court and time before the tournament is ready.",
    href: (id) => `/tournament/${id}/badminton/schedule`,
  },
  {
    id: "ready",
    order: 8,
    label: "Ready",
    title: "Tournament Ready",
    purpose: "Your tournament is ready to operate.",
    what: "Setup is complete — branding, players, events, rules, courts, draw, and schedule are in place.",
    why: "Live Control is the live desk where you run courts, scorers, and match day without hunting through setup pages.",
    after: "Open Live Control → Matches to create scoring matches, then Match Control to start — or use Live Control for courts and displays.",
    helperText: "Next: Live Control → Matches → Match Control to start, or Live Control for live courts.",
    missingLabel: "Setup is not finished",
    requiredWhy: "Finish the earlier steps before opening Live Control.",
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
