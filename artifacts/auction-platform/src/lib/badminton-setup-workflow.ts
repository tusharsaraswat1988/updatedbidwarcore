export type BadmintonSetupStepId =
  | "branding"
  | "players"
  | "categories"
  | "scoring_format"
  | "courts"
  | "draws"
  | "scheduling"
  | "matches";

export type BadmintonSetupItemStatus = "completed" | "current" | "upcoming";

export interface BadmintonSetupStep {
  id: BadmintonSetupStepId;
  order: number;
  label: string;
  description: string;
  href: (tournamentId: number) => string;
}

/** Ordered setup flow — ends at Matches. Broadcast/Analytics are ops, not setup. */
export const BADMINTON_SETUP_STEPS: BadmintonSetupStep[] = [
  {
    id: "branding",
    order: 1,
    label: "Tournament branding",
    description: "Set name, logo, and colors for scoreboards.",
    href: (id) => `/tournament/${id}/badminton/branding`,
  },
  {
    id: "players",
    order: 2,
    label: "Register players",
    description: "Add or import your player roster.",
    href: (id) => `/tournament/${id}/badminton/players`,
  },
  {
    id: "categories",
    order: 3,
    label: "Create categories",
    description: "Define events like Men's Singles or Mixed Doubles.",
    href: (id) => `/tournament/${id}/badminton/categories`,
  },
  {
    id: "scoring_format",
    order: 4,
    label: "Match format",
    description: "Choose Best of 3 · 21, Fast Match, or custom rules.",
    href: (id) => `/tournament/${id}/badminton/scoring-format`,
  },
  {
    id: "courts",
    order: 5,
    label: "Set up courts",
    description: "Add courts where matches will be played.",
    href: (id) => `/tournament/${id}/badminton/courts`,
  },
  {
    id: "draws",
    order: 6,
    label: "Draw & Fixtures",
    description: "Create fixture collections — generate, import, or enter matches manually.",
    href: (id) => `/tournament/${id}/badminton/fixtures`,
  },
  {
    id: "scheduling",
    order: 7,
    label: "Scheduling",
    description: "Assign courts, dates, and times to fixtures.",
    href: (id) => `/tournament/${id}/badminton/schedule`,
  },
  {
    id: "matches",
    order: 8,
    label: "Matches",
    description: "Create matches from scheduled fixtures and run the tournament.",
    href: (id) => `/tournament/${id}/badminton/matches`,
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
  totalMatches: number;
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
 */
export function evaluateBadmintonSetup(snapshot: BadmintonSetupSnapshot): BadmintonSetupItem[] {
  const rawDone: Record<BadmintonSetupStepId, boolean> = {
    branding: snapshot.brandingComplete,
    players: snapshot.totalPlayers > 0,
    categories: snapshot.totalCategories > 0,
    scoring_format: snapshot.scoringFormatConfigured,
    courts: snapshot.totalCourts > 0,
    draws: snapshot.totalFixtures > 0,
    scheduling: snapshot.totalScheduledFixtures > 0,
    matches: snapshot.totalMatches > 0,
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

export function setupProgress(items: BadmintonSetupItem[]) {
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const remaining = total - doneCount;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const complete = doneCount === total;
  return { doneCount, total, remaining, percent, complete };
}
