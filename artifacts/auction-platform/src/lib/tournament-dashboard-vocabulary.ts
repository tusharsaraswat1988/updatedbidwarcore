/**
 * Sport-aware organiser vocabulary for Tournament Dashboard.
 * Presentation only — does not change readiness engines.
 */

import type { SportCapabilities } from "./sports-shell-types";

/** Setup journey step ids — Runtime and Live are never organiser journey steps. */
export type OrganiserJourneyStepId =
  | "competition"
  | "teams"
  | "fixtures"
  | "schedule"
  | "matches";

export type OrganiserStepCopy = {
  title: string;
  description: string;
  ctaLabel: string;
};

export type SportOrganiserVocabulary = {
  /** Labels for the setup journey strip. */
  journeyLabels: Record<OrganiserJourneyStepId, string>;
  onboarding: OrganiserStepCopy;
  ready: OrganiserStepCopy;
  openScoringLabel: string;
  liveOpsFallbackTitle: string;
  stepCopy: (
    stepId: OrganiserJourneyStepId,
    opts: { matchDayPrep: boolean },
  ) => OrganiserStepCopy;
};

/** Terms that must never appear in organiser-facing dashboard copy. */
export const FORBIDDEN_ORGANISER_TERMS = [
  "Competition Type",
  "Registration Mode",
  "Team Formation Strategy",
  "Rule Profile",
  "Presentation Profile",
  "Runtime Preparation",
  "Runtime Snapshot",
  "Match Configuration",
  "Config Version",
  "Lock Dependency",
  "ModuleSnapshot",
  "module snapshot",
  "configuration version",
  "frozen",
  "competitionType",
  "registrationMode",
  "teamFormationStrategy",
  "ruleProfile",
  "presentationProfile",
] as const;

const BADMINTON_VOCAB: SportOrganiserVocabulary = {
  journeyLabels: {
    competition: "Tournament",
    teams: "Players & Teams",
    fixtures: "Fixtures",
    schedule: "Courts & Schedule",
    matches: "Match Setup",
  },
  onboarding: {
    title: "Let's get your tournament ready",
    description:
      "Set up your players, fixtures, courts and match schedule. We'll check everything again before match day.",
    ctaLabel: "Start Setup",
  },
  ready: {
    title: "Your tournament is ready",
    description: "Open live scoring when you are ready to run matches.",
    ctaLabel: "Open Live Scoring",
  },
  openScoringLabel: "Open Live Scoring",
  liveOpsFallbackTitle: "Live Scoring",
  stepCopy: (stepId, opts) => {
    if (stepId === "matches" && opts.matchDayPrep) {
      return {
        title: "Finish Match Setup",
        description: "Match setup still needs to be completed before match day.",
        ctaLabel: "Continue Setup",
      };
    }
    switch (stepId) {
      case "competition":
        return {
          title: "Set up your tournament",
          description: "Confirm branding and tournament details to get started.",
          ctaLabel: "Continue Setup",
        };
      case "teams":
        return {
          title: "Add players and teams",
          description: "Add the players (and teams, if needed) for this tournament.",
          ctaLabel: "Continue Setup",
        };
      case "fixtures":
        return {
          title: "Create fixtures",
          description: "Build your events and draw.",
          ctaLabel: "Continue Setup",
        };
      case "schedule":
        return {
          title: "Set up your courts and match timings",
          description: "Assign courts, dates and times to your fixtures.",
          ctaLabel: "Continue Setup",
        };
      case "matches":
        return {
          title: "Prepare matches",
          description: "Finish match setup so you can start scoring on match day.",
          ctaLabel: "Continue Setup",
        };
    }
  },
};

const DEFAULT_VOCAB: SportOrganiserVocabulary = {
  journeyLabels: {
    competition: "Tournament",
    teams: "Teams & Players",
    fixtures: "Fixtures",
    schedule: "Schedule",
    matches: "Match Setup",
  },
  onboarding: {
    title: "Let's get your tournament ready",
    description: "Set up teams, fixtures and schedule. We'll guide you through each step.",
    ctaLabel: "Start Setup",
  },
  ready: {
    title: "Your tournament is ready",
    description: "Open scoring when you are ready to run matches.",
    ctaLabel: "Open Scoring",
  },
  openScoringLabel: "Open Scoring",
  liveOpsFallbackTitle: "Live Operations",
  stepCopy: (stepId, opts) => {
    if (stepId === "matches" && opts.matchDayPrep) {
      return {
        title: "Finish Match Setup",
        description: "Match setup still needs to be completed before match day.",
        ctaLabel: "Continue Setup",
      };
    }
    switch (stepId) {
      case "competition":
        return {
          title: "Set up your tournament",
          description: "Confirm how this tournament will be organised.",
          ctaLabel: "Continue Setup",
        };
      case "teams":
        return {
          title: "Add teams and players",
          description: "Add the teams and players competing in this tournament.",
          ctaLabel: "Continue Setup",
        };
      case "fixtures":
        return {
          title: "Create fixtures",
          description: "Build the tournament draw and structure.",
          ctaLabel: "Continue Setup",
        };
      case "schedule":
        return {
          title: "Schedule your matches",
          description: "Assign venues, dates and times.",
          ctaLabel: "Continue Setup",
        };
      case "matches":
        return {
          title: "Prepare matches",
          description: "Confirm match sides and officials for match day.",
          ctaLabel: "Continue Setup",
        };
    }
  },
};

const CRICKET_VOCAB: SportOrganiserVocabulary = {
  ...DEFAULT_VOCAB,
  journeyLabels: {
    competition: "Tournament",
    teams: "Teams & Players",
    fixtures: "Fixtures",
    schedule: "Schedule",
    matches: "Match Setup",
  },
};

export function getSportOrganiserVocabulary(
  caps: Pick<SportCapabilities, "sportId" | "hasCourts">,
): SportOrganiserVocabulary {
  if (caps.sportId === "badminton" || caps.hasCourts) {
    return BADMINTON_VOCAB;
  }
  if (caps.sportId === "cricket") {
    return CRICKET_VOCAB;
  }
  return DEFAULT_VOCAB;
}

export type OrganiserFacingIssue = {
  title: string;
  detail: string;
  /** When null, the issue is suppressed from organiser UI. */
  actionable: boolean;
};

/**
 * Translate or suppress engine validation messages for organiser UI.
 * Engines remain authoritative; this only decides what humans see.
 */
export function translateOrganiserIssue(
  input: { code?: string; message?: string },
  caps: Pick<SportCapabilities, "sportId" | "hasCourts">,
): OrganiserFacingIssue | null {
  const code = (input.code ?? "").toUpperCase();
  const message = input.message ?? "";
  const badminton = caps.sportId === "badminton" || caps.hasCourts;

  // Suppress pure engine/config jargon with no badminton organiser surface.
  const suppressCodes = [
    "VARIANT_REQUIRED",
    "VARIANT_NOT_SET",
    "RULE_PROFILE_REQUIRED",
    "RULE_PROFILE_NOT_BOUND",
    "RULE_PROFILE_NOT_LOCKED",
    "RULE_PROFILE_VERSION_UNSET",
    "PRESENTATION_PROFILE_NOT_LOCKED",
    "PRESENTATION_PROFILE_REQUIRED",
    "TEAM_FORMATION_STRATEGY_REQUIRED",
    "COMPETITION_TYPE_REQUIRED",
  ];
  if (suppressCodes.some((c) => code.includes(c) || message.toUpperCase().includes(c))) {
    if (badminton) {
      // Fold into a single non-jargon tournament setup nudge when relevant.
      if (
        code.includes("COMPETITION") ||
        code.includes("REGISTRATION") ||
        code.includes("TEAM_FORMATION") ||
        code.includes("VARIANT") ||
        code.includes("RULE_PROFILE")
      ) {
        return {
          title: "Tournament setup isn't finished",
          detail: "Continue setup from the tournament dashboard when you are ready.",
          actionable: true,
        };
      }
    }
    return null;
  }

  if (
    code.includes("REGISTRATION_MODE") ||
    /registration mode/i.test(message)
  ) {
    return {
      title: "Player entry isn't set",
      detail: badminton
        ? "Choose how players or teams will be entered before continuing."
        : "Confirm how participants will be entered before continuing.",
      actionable: true,
    };
  }

  if (
    code.includes("RUNTIME") ||
    code.includes("SNAPSHOT") ||
    code.includes("MATCH_CONFIGURATION") ||
    /runtime snapshot|match configuration/i.test(message)
  ) {
    return {
      title: "Match setup still needs attention",
      detail: "Finish match setup before match day.",
      actionable: true,
    };
  }

  if (
    code.includes("COMPETITION_NOT_READY") ||
    /must be locked before locking fixture/i.test(message) ||
    /competition setup must be locked/i.test(message)
  ) {
    return {
      title: "Finish tournament setup first",
      detail: badminton
        ? "Finish the tournament setup before creating fixtures."
        : "Finish tournament setup before continuing to fixtures.",
      actionable: true,
    };
  }

  if (/competition type/i.test(message) || /team formation/i.test(message)) {
    return badminton
      ? {
          title: "Tournament setup isn't finished",
          detail: "Continue with players, fixtures and schedule from the dashboard.",
          actionable: true,
        }
      : {
          title: "Tournament setup isn't finished",
          detail: "Complete the remaining tournament setup steps.",
          actionable: true,
        };
  }

  if (/rule profile|presentation profile/i.test(message)) {
    // Only surface if actionable — badminton has rules under Setup → Rules.
    if (badminton) {
      return {
        title: "Match rules need a quick check",
        detail: "Review your tournament rules in Setup before match day.",
        actionable: true,
      };
    }
    return null;
  }

  // Generic lock-order dependency → human language.
  if (/must be locked before/i.test(message)) {
    return {
      title: "Finish the previous setup step first",
      detail: "Complete the earlier step, then continue.",
      actionable: true,
    };
  }

  // If the raw message still contains forbidden terms, suppress it.
  if (FORBIDDEN_ORGANISER_TERMS.some((term) => message.includes(term))) {
    return null;
  }

  if (!message.trim()) return null;

  return {
    title: "Something still needs attention",
    detail: message,
    actionable: true,
  };
}

export function assertNoForbiddenOrganiserTerms(text: string): string[] {
  return FORBIDDEN_ORGANISER_TERMS.filter((term) =>
    text.toLowerCase().includes(term.toLowerCase()),
  );
}
