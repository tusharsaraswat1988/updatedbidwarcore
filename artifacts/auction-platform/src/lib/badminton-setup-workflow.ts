export type BadmintonSetupStepId =
  | "branding"
  | "players"
  | "categories"
  | "draws"
  | "courts"
  | "matches"
  | "broadcast"
  | "analytics";

export interface BadmintonSetupStep {
  id: BadmintonSetupStepId;
  order: number;
  label: string;
  description: string;
  href: (tournamentId: number) => string;
}

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
    id: "draws",
    order: 4,
    label: "Generate draws",
    description: "Build knockout fixtures from accepted entries.",
    href: (id) => `/tournament/${id}/badminton/categories`,
  },
  {
    id: "courts",
    order: 5,
    label: "Set up courts",
    description: "Add courts and optional stream URLs.",
    href: (id) => `/tournament/${id}/badminton/courts`,
  },
  {
    id: "matches",
    order: 6,
    label: "Schedule matches",
    description: "Create matches and assign courts.",
    href: (id) => `/tournament/${id}/badminton/matches`,
  },
  {
    id: "broadcast",
    order: 7,
    label: "Configure broadcast",
    description: "Open displays, overlays, and scorer access.",
    href: (id) => `/tournament/${id}/badminton/broadcast`,
  },
  {
    id: "analytics",
    order: 8,
    label: "Review analytics",
    description: "Track progress once play begins.",
    href: (id) => `/tournament/${id}/badminton/analytics`,
  },
];

export interface BadmintonSetupSnapshot {
  brandingComplete: boolean;
  totalPlayers: number;
  totalCategories: number;
  totalFixtures: number;
  totalCourts: number;
  totalMatches: number;
  matchesCompleted: number;
}

export interface BadmintonSetupItem extends BadmintonSetupStep {
  done: boolean;
}

export function evaluateBadmintonSetup(snapshot: BadmintonSetupSnapshot): BadmintonSetupItem[] {
  const totalMatches = snapshot.totalMatches;

  const doneById: Record<BadmintonSetupStepId, boolean> = {
    branding: snapshot.brandingComplete,
    players: snapshot.totalPlayers > 0,
    categories: snapshot.totalCategories > 0,
    draws: snapshot.totalFixtures > 0,
    courts: snapshot.totalCourts > 0,
    matches: totalMatches > 0,
    broadcast: totalMatches > 0,
    analytics: snapshot.matchesCompleted > 0,
  };

  return BADMINTON_SETUP_STEPS.map((step) => ({
    ...step,
    done: doneById[step.id],
  }));
}

export function getNextSetupStep(items: BadmintonSetupItem[]): BadmintonSetupItem | null {
  return items.find((item) => !item.done) ?? null;
}

export function setupProgress(items: BadmintonSetupItem[]) {
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const complete = doneCount === total;
  return { doneCount, total, percent, complete };
}
