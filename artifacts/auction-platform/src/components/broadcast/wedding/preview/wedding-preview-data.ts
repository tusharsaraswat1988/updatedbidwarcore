import type { BroadcastFrame, CricketScoreModel, SponsorLogo } from "../../obs-v2/contracts";

export type WeddingPreviewStateKind =
  | "live_1st_innings"
  | "live_chase"
  | "pre_match"
  | "innings_break"
  | "match_result";

export interface WeddingPreviewOptions {
  state?: WeddingPreviewStateKind;
  isNeutralTeams?: boolean;
  hasCustomLogos?: boolean;
  hasSponsors?: boolean;
}

const SAMPLE_TITLE_SPONSOR: SponsorLogo = {
  id: "sp-title",
  name: "Taj Palace Hotels",
  tier: "title",
  label: "Title Sponsor",
};

const SAMPLE_ASSOCIATE_SPONSORS: SponsorLogo[] = [
  {
    id: "sp-assoc-1",
    name: "Sabyasachi Heritage",
    tier: "associate",
  },
  {
    id: "sp-assoc-2",
    name: "Tanishq Royal Jewels",
    tier: "associate",
  },
];

const SAMPLE_STREAM_SPONSOR: SponsorLogo = {
  id: "sp-stream",
  name: "WeddingCast Live 4K",
  tier: "live_streaming",
};

/**
 * Creates isolated, deterministic sample data for visual QA without DB or network dependencies.
 */
export function makeWeddingPreviewFrame(options: WeddingPreviewOptions = {}): BroadcastFrame {
  const {
    state = "live_1st_innings",
    isNeutralTeams = false,
    hasCustomLogos = false,
    hasSponsors = true,
  } = options;

  // Team Identities
  const brideTeamName = isNeutralTeams ? "Royal Challengers" : "Bride's XI";
  const brideShort = isNeutralTeams ? "RC" : "BRD";
  const groomTeamName = isNeutralTeams ? "Palace Royals" : "Groom's XI";
  const groomShort = isNeutralTeams ? "PR" : "GRM";

  const customLogoBride = hasCustomLogos
    ? "https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80"
    : undefined;
  const customLogoGroom = hasCustomLogos
    ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
    : undefined;

  const sponsors: SponsorLogo[] = hasSponsors
    ? [SAMPLE_TITLE_SPONSOR, ...SAMPLE_ASSOCIATE_SPONSORS, SAMPLE_STREAM_SPONSOR]
    : [];

  // 1. LIVE 1ST INNINGS (Matches the user mockup)
  if (state === "live_1st_innings") {
    const model: CricketScoreModel = {
      battingTeam: {
        name: brideTeamName,
        short: brideShort,
        logoUrl: customLogoBride,
      },
      bowlingTeamShort: groomTeamName,
      runs: 72,
      wickets: 3,
      overs: "8.4",
      maxOvers: 10,
      crr: 8.31,
      striker: {
        name: "Riya S.",
        runs: 28,
        balls: 22,
        onStrike: true,
        hasStats: true,
      },
      nonStriker: {
        name: "Mehak T.",
        runs: 12,
        balls: 7,
        onStrike: false,
        hasStats: true,
      },
      bowler: {
        name: "Arjun M.",
        runs: 14,
        wickets: 1,
        overs: "1.4",
        hasStats: true,
      },
      thisOver: [
        { kind: "run", label: "1" },
        { kind: "four", label: "4" },
        { kind: "dot", label: "0" },
        { kind: "wicket", label: "W" },
      ],
      status: {
        chip: "LIVE",
        text: "1ST INNINGS",
      },
    };

    return {
      scene: "CRICKET",
      model,
      branding: {
        tournamentName: "The Wedding Cricket Cup",
        tournamentAccent: "Aarav & Kiara",
        tournamentShort: "WCC",
        venue: "Udaipur Palace Grounds",
      },
      sponsors,
      teams: [],
      settings: { performanceMode: false, showTicker: hasSponsors },
      feed: { status: "live", secondsSinceUpdate: 2 },
    };
  }

  // 2. LIVE 2ND INNINGS CHASE
  if (state === "live_chase") {
    const model: CricketScoreModel = {
      battingTeam: {
        name: groomTeamName,
        short: groomShort,
        logoUrl: customLogoGroom,
      },
      bowlingTeamShort: brideTeamName,
      runs: 64,
      wickets: 2,
      overs: "7.3",
      maxOvers: 10,
      target: 110,
      needRuns: 46,
      ballsRemaining: 27,
      crr: 8.53,
      rrr: 10.22,
      striker: {
        name: "Kabir V.",
        runs: 38,
        balls: 20,
        onStrike: true,
        hasStats: true,
      },
      nonStriker: {
        name: "Rohan D.",
        runs: 18,
        balls: 14,
        onStrike: false,
        hasStats: true,
      },
      bowler: {
        name: "Ananya P.",
        runs: 22,
        wickets: 0,
        overs: "1.3",
        hasStats: true,
      },
      thisOver: [
        { kind: "run", label: "2" },
        { kind: "six", label: "6" },
        { kind: "run", label: "1" },
      ],
      status: {
        chip: "CHASE",
        text: "NEED 46 RUNS IN 27 BALLS",
      },
    };

    return {
      scene: "CRICKET",
      model,
      branding: {
        tournamentName: "The Wedding Cricket Cup",
        tournamentAccent: "Aarav & Kiara",
        tournamentShort: "WCC",
        venue: "Udaipur Palace Grounds",
      },
      sponsors,
      teams: [],
      settings: { performanceMode: false, showTicker: hasSponsors },
      feed: { status: "live", secondsSinceUpdate: 1 },
    };
  }

  // 3. PRE-MATCH STANDBY
  if (state === "pre_match") {
    const model: CricketScoreModel = {
      battingTeam: {
        name: brideTeamName,
        short: brideShort,
        logoUrl: customLogoBride,
      },
      bowlingTeamShort: groomTeamName,
      runs: 0,
      wickets: 0,
      overs: "0.0",
      maxOvers: 10,
      crr: 0,
      striker: {
        name: "Riya S.",
        runs: 0,
        balls: 0,
        onStrike: true,
        hasStats: false,
      },
      nonStriker: {
        name: "Mehak T.",
        runs: 0,
        balls: 0,
        onStrike: false,
        hasStats: false,
      },
      bowler: {
        name: "Arjun M.",
        runs: 0,
        wickets: 0,
        overs: "0.0",
        hasStats: false,
      },
      thisOver: [],
      status: {
        chip: "PRE-MATCH",
        text: "TOSS: BRIDE'S XI ELECTED TO BAT FIRST",
      },
    };

    return {
      scene: "CRICKET",
      model,
      branding: {
        tournamentName: "The Wedding Cricket Cup",
        tournamentAccent: "Aarav & Kiara",
        tournamentShort: "WCC",
        venue: "Udaipur Palace Grounds",
      },
      sponsors,
      teams: [],
      settings: { performanceMode: false, showTicker: hasSponsors },
      feed: { status: "live", secondsSinceUpdate: 4 },
    };
  }

  // 4. INNINGS BREAK
  if (state === "innings_break") {
    const model: CricketScoreModel = {
      battingTeam: {
        name: brideTeamName,
        short: brideShort,
        logoUrl: customLogoBride,
      },
      bowlingTeamShort: groomTeamName,
      runs: 109,
      wickets: 5,
      overs: "10.0",
      maxOvers: 10,
      crr: 10.9,
      target: 110,
      striker: {
        name: "Pooja K.",
        runs: 15,
        balls: 9,
        onStrike: true,
        hasStats: true,
      },
      nonStriker: {
        name: "Mehak T.",
        runs: 24,
        balls: 18,
        onStrike: false,
        hasStats: true,
      },
      bowler: {
        name: "Dev R.",
        runs: 28,
        wickets: 2,
        overs: "2.0",
        hasStats: true,
      },
      thisOver: [
        { kind: "run", label: "1" },
        { kind: "four", label: "4" },
        { kind: "wicket", label: "W" },
        { kind: "six", label: "6" },
        { kind: "run", label: "2" },
        { kind: "run", label: "1" },
      ],
      status: {
        chip: "BREAK",
        text: "INNINGS BREAK · TARGET 110 RUNS",
      },
    };

    return {
      scene: "CRICKET",
      model,
      branding: {
        tournamentName: "The Wedding Cricket Cup",
        tournamentAccent: "Aarav & Kiara",
        tournamentShort: "WCC",
        venue: "Udaipur Palace Grounds",
      },
      sponsors,
      teams: [],
      settings: { performanceMode: false, showTicker: hasSponsors },
      feed: { status: "live", secondsSinceUpdate: 2 },
    };
  }

  // 5. MATCH RESULT
  const model: CricketScoreModel = {
    battingTeam: {
      name: brideTeamName,
      short: brideShort,
      logoUrl: customLogoBride,
    },
    bowlingTeamShort: groomTeamName,
    runs: 109,
    wickets: 5,
    overs: "10.0",
    maxOvers: 10,
    crr: 10.9,
    striker: {
      name: "Pooja K.",
      runs: 15,
      balls: 9,
      onStrike: true,
      hasStats: true,
    },
    nonStriker: {
      name: "Mehak T.",
      runs: 24,
      balls: 18,
      onStrike: false,
      hasStats: true,
    },
    bowler: {
      name: "Dev R.",
      runs: 28,
      wickets: 2,
      overs: "2.0",
      hasStats: true,
    },
    thisOver: [
      { kind: "run", label: "1" },
      { kind: "wicket", label: "W" },
    ],
    result: {
      kicker: "WEDDING CUP CHAMPIONS",
      headline: `${brideTeamName} Won by 14 Runs`,
      detail: "AARAV & KIARA TROPHY 2026",
    },
    status: {
      chip: "FINAL",
      text: `${brideTeamName.toUpperCase()} WON BY 14 RUNS`,
    },
  };

  return {
    scene: "CRICKET",
    model,
    branding: {
      tournamentName: "The Wedding Cricket Cup",
      tournamentAccent: "Aarav & Kiara",
      tournamentShort: "WCC",
      venue: "Udaipur Palace Grounds",
    },
    sponsors,
    teams: [],
    settings: { performanceMode: false, showTicker: hasSponsors },
    feed: { status: "live", secondsSinceUpdate: 1 },
  };
}
