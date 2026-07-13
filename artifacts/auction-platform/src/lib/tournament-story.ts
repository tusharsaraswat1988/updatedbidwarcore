import type { BadmintonSetupStepId } from "@/lib/badminton-setup-workflow";

/**
 * Tournament Story Mode — product understanding layer.
 * One continuous journey the organizer is building (not a list of forms).
 */

/** Global lifecycle story reinforced on every wizard page. */
export const TOURNAMENT_STORY_MILESTONES = [
  "Tournament",
  "Players",
  "Events",
  "Tournament Draw",
  "Court Schedule",
  "Live Matches",
  "Champions",
] as const;

export type TournamentStoryMilestone = (typeof TOURNAMENT_STORY_MILESTONES)[number];

export interface TournamentStoryBeat {
  stepId: BadmintonSetupStepId;
  /** Highlighted milestone in the global story for this step */
  storyFocus: TournamentStoryMilestone;
  whereAmI: string;
  whyHere: string;
  creates: string;
  happensNext: string;
  /** Tiny "How this connects" flow — visual, not paragraphs */
  connects: string[];
  /** Lightweight Help Mode content */
  help: {
    title: string;
    body: string[];
    terms: Array<{ term: string; meaning: string }>;
  };
}

export const TOURNAMENT_STORY_BEATS: Record<BadmintonSetupStepId, TournamentStoryBeat> = {
  branding: {
    stepId: "branding",
    storyFocus: "Tournament",
    whereAmI: "You are creating the identity of your tournament.",
    whyHere: "Everything that follows — players, draws, schedules, and broadcasts — will use this identity.",
    creates: "Tournament name, logo, venue, and organizer identity.",
    happensNext: "You will import Players — the people who compete.",
    connects: ["Tournament Details", "Players", "Events", "Live Matches"],
    help: {
      title: "What is Tournament Details?",
      body: [
        "This is the front cover of your tournament.",
        "Scoreboards, displays, and streams show this name and logo so everyone knows which event they are watching.",
      ],
      terms: [
        { term: "Venue", meaning: "Where the tournament is hosted." },
        { term: "Organizer", meaning: "Who is running the event." },
      ],
    },
  },
  players: {
    stepId: "players",
    storyFocus: "Players",
    whereAmI: "You are importing tournament participants.",
    whyHere: "Without players, events cannot be created.",
    creates: "Tournament player pool — and team ownership from Auction when available.",
    happensNext: "You will organise players into Events.",
    connects: ["Players", "Events", "Tournament Draw", "Live Matches"],
    help: {
      title: "What are Players?",
      body: [
        "Players are the people who will compete.",
        "If they came from Auction with teams, those teams stay with them through scoring — you do not re-enter team names later.",
      ],
      terms: [
        { term: "Team", meaning: "Auction franchise or squad shown on scoreboards." },
        { term: "Player pool", meaning: "Everyone available to enter Events." },
      ],
    },
  },
  categories: {
    stepId: "categories",
    storyFocus: "Events",
    whereAmI: "You are defining which competitions will be played.",
    whyHere: "Events turn your player pool into real competitions with winners.",
    creates: "Competitions such as Men's Singles or Mixed Doubles.",
    happensNext: "You will set Scoring Rules — how matches are won.",
    connects: ["Events", "Tournament Draw", "Court Schedule", "Champion"],
    help: {
      title: "What is an Event?",
      body: [
        "An Event is one competition inside your tournament.",
        "Every Event later gets its own Draw, Court Schedule, and Champion.",
      ],
      terms: [
        { term: "Event", meaning: "One competition (not a form section)." },
        { term: "Champion", meaning: "The winner of that Event." },
      ],
    },
  },
  scoring_format: {
    stepId: "scoring_format",
    storyFocus: "Events",
    whereAmI: "You are choosing how matches are won.",
    whyHere: "Every court must score the same way so results are fair and comparable.",
    creates: "Tournament-wide scoring rules for every match.",
    happensNext: "You will add Courts — where matches will be played.",
    connects: ["Scoring Rules", "Every Match", "Results", "Champion"],
    help: {
      title: "What are Scoring Rules?",
      body: [
        "Scoring Rules decide points per game and how many games win a match.",
        "They apply automatically to new matches — umpires do not invent rules on court.",
      ],
      terms: [
        { term: "Best of 3", meaning: "First to win 2 games wins the match." },
        { term: "Points", meaning: "How many points win a single game (for example 21)." },
      ],
    },
  },
  courts: {
    stepId: "courts",
    storyFocus: "Court Schedule",
    whereAmI: "You are setting up the places matches will be played.",
    whyHere: "Without courts you cannot schedule fixtures or run live scoring.",
    creates: "Courts with optional Scorer PIN, display, and broadcast readiness.",
    happensNext: "You will create the Tournament Draw — who plays whom.",
    connects: ["Courts", "Schedule", "Match Control", "Live Scoring"],
    help: {
      title: "What is a Court?",
      body: [
        "A Court is a physical playing area.",
        "The Scorer PIN belongs to the Court first. Matches inherit it unless a Match PIN overrides it.",
      ],
      terms: [
        { term: "Scorer PIN", meaning: "Code the umpire enters to unlock scoring." },
        { term: "Match Control", meaning: "Organizer desk to start and manage a match." },
      ],
    },
  },
  draws: {
    stepId: "draws",
    storyFocus: "Tournament Draw",
    whereAmI: "You are deciding who plays whom.",
    whyHere: "The draw turns event entries into planned fixtures.",
    creates: "Fixtures — the list of planned matches for each Event.",
    happensNext: "You will build the Court Schedule — where and when each fixture is played.",
    connects: ["Players", "Tournament Draw", "Fixtures", "Court Schedule", "Matches"],
    help: {
      title: "What is the Tournament Draw?",
      body: [
        "The draw decides pairings: who plays whom.",
        "Generate, import, or create manually — every option produces the same kind of fixtures.",
      ],
      terms: [
        { term: "Fixture", meaning: "One planned match before it has a court/time." },
        { term: "Draw", meaning: "The structure of who meets whom in an Event." },
      ],
    },
  },
  scheduling: {
    stepId: "scheduling",
    storyFocus: "Court Schedule",
    whereAmI: "You are placing fixtures onto courts and times.",
    whyHere: "Scheduling happens after the draw — first who plays whom, then where and when.",
    creates: "A playable timetable — court + time for each fixture.",
    happensNext: "Your tournament becomes Ready — then you operate Live Matches from Control Center.",
    connects: ["Tournament Draw", "Court Assignment", "Time Assignment", "Ready to Play"],
    help: {
      title: "What is Court Schedule?",
      body: [
        "Court Schedule assigns each fixture to a court and a start time.",
        "When this is done, fixtures are ready to become live matches.",
      ],
      terms: [
        { term: "Court assignment", meaning: "Which court hosts the fixture." },
        { term: "Time assignment", meaning: "When the fixture starts." },
      ],
    },
  },
  ready: {
    stepId: "ready",
    storyFocus: "Live Matches",
    whereAmI: "You have finished configuring the tournament.",
    whyHere: "Setup is complete — the story moves from building to operating.",
    creates: "A tournament ready for Live Matches and Champions.",
    happensNext: "Open Control Center to run Live Operations — then Champions appear from results.",
    connects: [
      "Tournament",
      "Players",
      "Events",
      "Tournament Draw",
      "Court Schedule",
      "Live Operations",
      "Champions",
    ],
    help: {
      title: "What is Tournament Ready?",
      body: [
        "You are no longer configuring the tournament.",
        "Now you are operating it — courts, scorers, and live matches from Control Center.",
      ],
      terms: [
        { term: "Control Center", meaning: "Live desk for match day operations." },
        { term: "Champions", meaning: "Event winners once results are complete." },
      ],
    },
  },
};

export function getTournamentStoryBeat(stepId: BadmintonSetupStepId): TournamentStoryBeat {
  return TOURNAMENT_STORY_BEATS[stepId];
}
