import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { FullscreenLayout } from "@/components/fullscreen-layout";
import { useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import { getActiveInnings, oversText, requiredRate, runRate } from "@/lib/scoring-ball";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { MatchSummaryCard } from "@/components/scoring/match-summary-card";
import { CricketPublicBrandMark, useCricketBidWarTheme } from "@/components/scoring/cricket-branding";
import {
  getCricketMasterTeams,
  getCricketTournamentRoster,
  type ScoringMatchJson,
} from "@/lib/scoring-api";
import {
  cricketMasterTeamToScorerTeam,
  cricketRosterToScorerPlayer,
  type CricketScorerTeam,
} from "@/lib/scoring-squad";
import {
  getDisplayThemeFromPresentationPaint,
  type PresentationPaintJson,
} from "@/lib/display-theme";
import { parseTournamentSponsors } from "@/components/scoring/public-sponsors-strip";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  LedEventAnimationOverlay,
  type LedMatchEvent,
} from "@/components/scoring/led-event-animation-overlay";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trophy,
  Flame,
  Award,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

function ConnectionBadge({ status }: { status: "connected" | "reconnecting" | "disconnected" }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
        <Wifi className="w-3.5 h-3.5" /> Live
      </span>
    );
  }
  if (status === "disconnected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
        <WifiOff className="w-3.5 h-3.5" /> Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing
    </span>
  );
}

/** Top-Right Showcase Box: Displays sponsors prominently with auto-rotation */
function HeaderSponsorShowcase({ sponsors }: { sponsors: SponsorLogo[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sponsors.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [sponsors.length]);

  if (sponsors.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-card/60 border border-border/70 backdrop-blur-sm min-w-[200px]">
        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
          <Award className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
            Tournament Partner
          </p>
          <p className="text-sm font-black uppercase text-foreground">Official Sponsor</p>
        </div>
      </div>
    );
  }

  const current = sponsors[currentIndex] || sponsors[0];
  const typeText =
    current.priorityType ||
    current.type ||
    (current.isTitleSponsor ? "Title Sponsor" : current.isCoSponsor ? "Co Sponsor" : "Sponsor");

  return (
    <div className="flex items-center gap-3.5 px-4 py-2 rounded-2xl bg-card/80 border border-border/80 backdrop-blur-md shadow-md min-w-[220px] max-w-[320px] transition-all duration-300">
      {current.url ? (
        <div className="w-16 h-12 rounded-lg bg-black/40 border border-border/50 flex items-center justify-center p-1 shrink-0 overflow-hidden">
          <img
            src={current.url}
            alt={current.name || "Sponsor"}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
          <Award className="w-6 h-6 text-primary" />
        </div>
      )}
      <div className="text-left min-w-0">
        <span className="inline-block text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 mb-0.5">
          {typeText}
        </span>
        <h4 className="text-base font-black uppercase tracking-wide text-foreground truncate">
          {current.name || "Tournament Partner"}
        </h4>
        {sponsors.length > 1 && (
          <div className="flex gap-1 mt-1">
            {sponsors.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === currentIndex ? "w-3 bg-primary" : "w-1 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScoreDisplayShell({ tournamentId }: { tournamentId: number }) {
  const { shellStyle, logoSrc, logoAlt } = useCricketBidWarTheme();
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { connectionStatus } = useScoringSocket(tournamentId, scoringActive);
  const { data: live } = useScoringLive(tournamentId, scoringActive, connectionStatus);

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: !!tournamentId,
  });
  const teams: CricketScorerTeam[] = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );

  const { data: roster } = useQuery({
    queryKey: ["cricket-roster", tournamentId],
    queryFn: () => getCricketTournamentRoster(tournamentId),
    enabled: !!tournamentId && scoringActive,
  });
  const players = useMemo(
    () => (roster ?? []).map(cricketRosterToScorerPlayer),
    [roster],
  );

  const sponsors = useMemo(
    () => parseTournamentSponsors(tournament?.sponsorLogos),
    [tournament?.sponsorLogos],
  );

  const match = live?.match;
  const state = live?.state;
  const summary = live?.summary;
  const innings = state ? getActiveInnings(state) : null;

  // Active event animation state
  const [activeEvent, setActiveEvent] = useState<LedMatchEvent | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);

  // Sequence and ball tracker for automatic event animation triggers
  const lastSeqRef = useRef<number | null>(null);
  const lastBowlerIdRef = useRef<number | null>(null);
  const lastStrikerIdRef = useRef<number | null>(null);
  const lastInningsPhaseRef = useRef<string | null>(null);
  const lastMatchStatusRef = useRef<string | null>(null);

  // Presentation theme paint
  const presentationPaint = match?.branding as PresentationPaintJson | null | undefined;
  const paintTheme = getDisplayThemeFromPresentationPaint(presentationPaint);
  const displayShellStyle = useMemo(() => {
    if (presentationPaint?.source !== "presentation_execution_policy") {
      return shellStyle;
    }
    return {
      ...shellStyle,
      ["--accent" as string]: paintTheme.accentColor,
      ["--background" as string]: paintTheme.bg,
      backgroundColor: paintTheme.bg,
    } as CSSProperties;
  }, [shellStyle, presentationPaint, paintTheme]);

  const home = teams.find((t) => t.id === match?.homeTeamId);
  const away = teams.find((t) => t.id === match?.awayTeamId);
  const battingTeam = teams.find((t) => t.id === innings?.battingTeamId);
  const bowlingTeam = teams.find((t) => t.id === innings?.bowlingTeamId);

  const strikerPlayer = players.find((p) => p.id === state?.strikerId);
  const nonStrikerPlayer = players.find((p) => p.id === state?.nonStrikerId);
  const bowlerPlayer = players.find((p) => p.id === state?.bowlerId);

  const rr = innings ? runRate(innings.runs, innings.over, innings.ball) : null;
  const rrr =
    state && innings && state.target
      ? requiredRate(state.target, innings.runs, state.oversLimit, innings.over, innings.ball)
      : null;

  const isComplete = state?.matchStatus === "completed" || state?.matchStatus === "abandoned";
  const isIdle = !match || !state || state.matchStatus === "scheduled";

  const targetRuns = state?.target ?? null;
  const needRuns = targetRuns != null && innings ? Math.max(0, targetRuns - innings.runs) : null;
  const ballsRemaining =
    targetRuns != null && innings && state?.oversLimit
      ? Math.max(0, state.oversLimit * 6 - (innings.over * 6 + innings.ball))
      : null;

  // Watch for live cricket events to animate
  useEffect(() => {
    if (!state || !match) return;

    // 1. Initial sequence skip to avoid firing past ball on first load
    if (lastSeqRef.current === null) {
      lastSeqRef.current = state.lastSequence;
      lastBowlerIdRef.current = state.bowlerId;
      lastStrikerIdRef.current = state.strikerId;
      lastInningsPhaseRef.current = innings?.phase || null;
      lastMatchStatusRef.current = state.matchStatus;
      return;
    }

    // 2. Detect New Ball
    if (state.lastSequence > lastSeqRef.current && state.thisOver.length > 0) {
      const lastBall = state.thisOver[state.thisOver.length - 1];
      lastSeqRef.current = state.lastSequence;

      if (lastBall.isSuperBall) {
        setActiveEvent({
          type: "SUPER_BALL",
          battingTeam: battingTeam?.name,
        });
      } else if (lastBall.isWicket) {
        setActiveEvent({
          type: "WICKET",
          dismissal: lastBall.label.includes("W") ? "WICKET" : "OUT",
          batsmanName: strikerPlayer?.name || "Batter",
          bowlerName: bowlerPlayer?.name || "Bowler",
        });
      } else if (lastBall.runsOffBat === 6 || lastBall.label === "6") {
        setActiveEvent({
          type: "SIX",
          runs: 6,
          batsmanName: strikerPlayer?.name,
        });
      } else if (lastBall.runsOffBat === 4 || lastBall.label === "4") {
        setActiveEvent({
          type: "FOUR",
          runs: 4,
          batsmanName: strikerPlayer?.name,
        });
      } else if (lastBall.extrasType === "no_ball" || lastBall.label.toLowerCase().includes("nb")) {
        setActiveEvent({ type: "NO_BALL" });
      } else if (lastBall.extrasType === "wide" || lastBall.label.toLowerCase().includes("wd")) {
        setActiveEvent({ type: "WIDE", runs: lastBall.extrasRuns });
      }
    }

    // 3. Detect Bowler Change
    if (
      state.bowlerId &&
      lastBowlerIdRef.current !== null &&
      state.bowlerId !== lastBowlerIdRef.current
    ) {
      lastBowlerIdRef.current = state.bowlerId;
      const newBowler = players.find((p) => p.id === state.bowlerId);
      if (newBowler) {
        setActiveEvent({
          type: "BOWLER_CHANGE",
          bowlerName: newBowler.name,
          figures: newBowler.role || "Bowler",
        });
      }
    } else {
      lastBowlerIdRef.current = state.bowlerId;
    }

    // 4. Detect New Striker
    if (
      state.strikerId &&
      lastStrikerIdRef.current !== null &&
      state.strikerId !== lastStrikerIdRef.current
    ) {
      lastStrikerIdRef.current = state.strikerId;
      const newStriker = players.find((p) => p.id === state.strikerId);
      if (newStriker) {
        setActiveEvent({
          type: "NEW_BATSMAN",
          batsmanName: newStriker.name,
          role: newStriker.role || "Batter",
        });
      }
    } else {
      lastStrikerIdRef.current = state.strikerId;
    }

    // 5. Detect Innings Complete
    if (
      innings &&
      innings.phase === "completed" &&
      lastInningsPhaseRef.current !== "completed"
    ) {
      lastInningsPhaseRef.current = innings.phase;
      setActiveEvent({
        type: "INNINGS_COMPLETE",
        innings: innings.innings,
        runs: innings.runs,
        wickets: innings.wickets,
        overs: oversText(innings.over, innings.ball),
        target: state.target,
        battingTeam: battingTeam?.name,
      });
    }

    // 6. Detect Match Result
    if (
      state.matchStatus === "completed" &&
      lastMatchStatusRef.current !== "completed"
    ) {
      lastMatchStatusRef.current = state.matchStatus;
      const winner = teams.find((t) => t.id === state.winnerTeamId);
      setActiveEvent({
        type: "MATCH_RESULT",
        winnerName: winner?.name || "Champions",
        marginText: state.resultText || match.resultSummary || "Match Completed",
      });
    }
  }, [
    state,
    match,
    innings,
    battingTeam?.name,
    strikerPlayer?.name,
    bowlerPlayer?.name,
    players,
    teams,
  ]);

  // Sponsor Trail list for footer marquee
  const sponsorTrailItems = useMemo(() => {
    if (sponsors.length > 0) {
      return sponsors.map((s) => ({
        type:
          s.priorityType ||
          s.type ||
          (s.isTitleSponsor ? "Title Sponsor" : s.isCoSponsor ? "Co Sponsor" : "Official Partner"),
        name: s.name || "Tournament Partner",
      }));
    }
    return [
      { type: "TITLE SPONSOR", name: "BIDWAR ARENA" },
      { type: "POWERED BY", name: "BIDWAR LIVE ENGINE" },
      { type: "OFFICIAL PARTNER", name: "STADIUM BROADCAST" },
      { type: "DIGITAL SCORING", name: "BIDWAR PRO SCORER" },
    ];
  }, [sponsors]);

  return (
    <FullscreenLayout>
      <div
        className="min-h-screen bg-[#07090e] text-foreground flex flex-col relative dark overflow-hidden select-none"
        style={displayShellStyle}
      >
        {/* Ambient Stadium Lighting Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-[#07090e] to-[#040507] pointer-events-none" />

        {/* 1. TOP HEADER: Tournament Logo (Left) | BidWar + Title (Center) | Sponsor Showcase (Right) */}
        <header className="relative z-20 flex items-center justify-between px-6 sm:px-8 py-3.5 border-b border-border/60 bg-card/90 backdrop-blur-md">
          {/* Top Left: Tournament Logo */}
          <div className="flex items-center gap-3 shrink-0">
            {tournament?.logoUrl ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-card border-2 border-border p-1.5 flex items-center justify-center overflow-hidden shadow-lg shadow-black/50">
                <img
                  src={tournament.logoUrl}
                  alt={tournament.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-card via-card/80 to-background border-2 border-primary/40 flex flex-col items-center justify-center shadow-lg shadow-black/50">
                <Trophy className="w-8 h-8 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/80 mt-1">
                  TOURNEY
                </span>
              </div>
            )}
          </div>

          {/* Top Center: BidWar Logo on top, Tournament Name in max available width below */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-5xl text-center min-w-0">
            <div className="flex items-center justify-center mb-1">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={logoAlt || "BidWar"}
                  className="h-7 sm:h-8 w-auto object-contain drop-shadow"
                />
              ) : (
                <CricketPublicBrandMark variant="scorer-header" />
              )}
            </div>
            <h1 className="w-full text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-black uppercase tracking-wider text-white truncate drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
              {tournament?.name}
            </h1>
            {match?.roundName && (
              <span className="text-xs uppercase tracking-[0.25em] text-primary/90 font-extrabold mt-0.5">
                {match.roundName}
              </span>
            )}
          </div>

          {/* Top Right: Sponsor Showcase + Connection Status */}
          <div className="flex items-center gap-4 shrink-0 justify-end">
            <HeaderSponsorShowcase sponsors={sponsors} />
            <ConnectionBadge status={connectionStatus} />
          </div>
        </header>

        {/* 2. MAIN SCORING ARENA */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-6 gap-6">
          {isIdle ? (
            <div className="text-center space-y-4 max-w-xl p-10 rounded-3xl bg-card/60 border border-border/80 backdrop-blur-md">
              <Trophy className="w-16 h-16 text-primary/60 mx-auto animate-pulse" />
              <h2 className="text-3xl font-display font-black uppercase tracking-wide text-foreground">
                Match Waiting To Begin
              </h2>
              <p className="text-base text-muted-foreground">
                Waiting for the official toss and scorer to start ball delivery.
              </p>
            </div>
          ) : isComplete && summary ? (
            <div className="w-full max-w-4xl space-y-6">
              <div className="flex items-center justify-center gap-3">
                <Trophy className="w-8 h-8 text-primary" />
                <h2 className="text-center text-3xl font-display font-black uppercase tracking-widest text-primary">
                  Match Completed
                </h2>
              </div>
              <MatchSummaryCard summary={summary} teams={teams} />
            </div>
          ) : (
            <div className="w-full max-w-6xl flex flex-col items-center gap-6">
              {/* Team Match Bar: Batting vs Bowling */}
              <div className="w-full flex items-center justify-between px-8 py-3.5 rounded-2xl bg-card/85 border border-border/80 backdrop-blur-md shadow-xl">
                {/* Batting Team Badge */}
                <div className="flex items-center gap-4">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-widest animate-pulse">
                    BAT
                  </span>
                  <div className="text-left">
                    <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
                      {battingTeam?.name || home?.name || "Batting Team"}
                    </h3>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                      Short: {battingTeam?.shortCode || home?.shortCode}
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <span className="text-xl sm:text-2xl font-black font-display text-muted-foreground/60">
                    VS
                  </span>
                </div>

                {/* Bowling Team Badge */}
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
                      {bowlingTeam?.name || away?.name || "Bowling Team"}
                    </h3>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                      Short: {bowlingTeam?.shortCode || away?.shortCode}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-widest">
                    BOWL
                  </span>
                </div>
              </div>

              {/* Free Hit Alert Banner */}
              {state?.freeHitActive && (
                <div className="w-full py-2.5 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 border-2 border-fuchsia-300 text-white flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(192,38,211,0.6)] animate-pulse">
                  <Flame className="w-6 h-6 text-yellow-300 animate-bounce" />
                  <span className="text-xl sm:text-2xl font-black uppercase tracking-[0.25em]">
                    ⚡ FREE HIT ACTIVE THIS BALL ⚡
                  </span>
                </div>
              )}

              {/* Target / Equation Strip */}
              {targetRuns != null && (
                <div className="w-full py-3 px-6 rounded-2xl bg-primary/15 border-2 border-primary/40 flex items-center justify-between flex-wrap gap-4 text-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-primary/80">
                      TARGET:
                    </span>
                    <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                      {targetRuns}
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black uppercase tracking-wide text-primary">
                    Need{" "}
                    <span className="text-white font-mono text-2xl font-black">{needRuns}</span> Runs in{" "}
                    <span className="text-white font-mono text-2xl font-black">{ballsRemaining}</span>{" "}
                    Balls
                  </div>
                  {rrr && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        RRR:
                      </span>
                      <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
                        {rrr}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* GIANT SCORING CORE */}
              <div className="w-full p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-card/95 via-card/80 to-background/90 border-2 border-border/80 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center gap-6">
                <div className="flex flex-col items-center">
                  {/* Total Score Numerals: Runs / Wickets */}
                  <div className="text-8xl sm:text-9xl md:text-[11rem] lg:text-[13rem] font-black font-mono tabular-nums tracking-tight text-white leading-none drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)]">
                    {innings?.runs ?? 0}
                    <span className="text-primary/75 mx-1">/</span>
                    {innings?.wickets ?? 0}
                  </div>

                  {/* Overs & Rates Bar */}
                  <div className="flex items-center gap-4 sm:gap-6 mt-4 flex-wrap justify-center">
                    <div className="px-6 py-2 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 shadow-lg">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-300/80 mr-2">
                        Overs
                      </span>
                      <span className="text-3xl sm:text-4xl md:text-5xl font-mono font-black text-amber-400">
                        {innings ? oversText(innings.over, innings.ball) : "0.0"}
                        <span className="text-xl sm:text-2xl text-muted-foreground font-normal ml-1.5">
                          / {state?.oversLimit ?? 0}
                        </span>
                      </span>
                    </div>

                    {rr && (
                      <div className="px-5 py-2 rounded-2xl bg-card border border-border">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">
                          CRR
                        </span>
                        <span className="text-2xl sm:text-3xl font-mono font-black text-white">
                          {rr}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Crease Cards: Active Batsmen & Bowler */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {/* Batsmen Card */}
                  <div className="p-5 rounded-2xl bg-black/40 border border-border/70 flex flex-col justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-widest text-primary/80">
                      🏏 Batter at Crease
                    </span>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">*</span>
                          <span className="text-xl font-black uppercase text-white truncate max-w-[200px]">
                            {strikerPlayer?.name || "Striker"}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-muted-foreground uppercase">
                          (Striker)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-lg font-bold uppercase text-white/80 truncate max-w-[200px]">
                          {nonStrikerPlayer?.name || "Non-Striker"}
                        </span>
                        <span className="text-xs uppercase font-semibold">(Non-Striker)</span>
                      </div>
                    </div>
                  </div>

                  {/* Bowler Card */}
                  <div className="p-5 rounded-2xl bg-black/40 border border-border/70 flex flex-col justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-widest text-amber-400/90">
                      🎯 Active Bowler
                    </span>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-2xl font-black uppercase text-white">
                          {bowlerPlayer?.name || "Current Bowler"}
                        </h4>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          {bowlerPlayer?.role || "Right-Arm Pace"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          Over Progress
                        </span>
                        <p className="text-lg font-mono font-bold text-amber-300">
                          Ball {innings?.ball ?? 0} of 6
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* This Over Ball-by-Ball Strip */}
                {state && state.thisOver.length > 0 && (
                  <div className="w-full flex flex-col items-center gap-3 pt-2 border-t border-border/50">
                    <span className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
                      This Over Deliveries
                    </span>
                    <div className="flex items-center justify-center flex-wrap gap-3">
                      {state.thisOver.map((b, i) => {
                        const isSix = b.runsOffBat === 6 || b.label === "6";
                        const isFour = b.runsOffBat === 4 || b.label === "4";
                        const isWkt = b.isWicket || b.label.includes("W");
                        const isExtra =
                          b.extrasType != null ||
                          b.label.includes("wd") ||
                          b.label.includes("nb");

                        return (
                          <span
                            key={`${b.over}-${b.ball}-${i}`}
                            className={cn(
                              "inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl text-xl sm:text-2xl font-mono font-black border-2 transition-all shadow-md",
                              isSix
                                ? "bg-amber-500 text-black border-yellow-200 shadow-[0_0_20px_rgba(245,158,11,0.6)]"
                                : isFour
                                ? "bg-emerald-600 text-white border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                                : isWkt
                                ? "bg-red-600 text-white border-red-300 shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse"
                                : isExtra
                                ? "bg-purple-700 text-white border-purple-300"
                                : "bg-card text-foreground border-border/90",
                            )}
                          >
                            {b.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* 3. FOOTER: Sponsor Trail in matching color combination (Text & Type, Not Logo) */}
        <footer className="relative z-20 h-12 bg-[#05070a] border-t border-border/70 overflow-hidden flex items-center select-none shadow-2xl">
          {/* Static Title Tag */}
          <div className="flex items-center gap-2 px-5 py-1.5 bg-primary/20 border-r border-border shrink-0 z-20 h-full">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-primary whitespace-nowrap">
              OFFICIAL SPONSORS
            </span>
          </div>

          {/* Continuous Infinite Marquee Sponsor Trail */}
          <div className="flex-1 overflow-hidden relative">
            <div className="flex animate-marquee whitespace-nowrap will-change-transform py-2">
              {[0, 1].map((copyIdx) => (
                <div key={copyIdx} className="flex items-center shrink-0 gap-10 pr-10">
                  {sponsorTrailItems.map((item, idx) => (
                    <div key={`${copyIdx}-${idx}`} className="inline-flex items-center gap-2.5">
                      <span className="text-primary font-black text-sm">✦</span>
                      <span className="text-[11px] uppercase font-black tracking-widest text-primary bg-primary/15 px-2 py-0.5 rounded border border-primary/25">
                        {item.type}
                      </span>
                      <span className="text-sm font-black uppercase tracking-wider text-white">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </footer>

        {/* 4. MODULAR LED EVENT ANIMATION OVERLAY */}
        <LedEventAnimationOverlay
          currentEvent={activeEvent}
          onDismiss={() => setActiveEvent(null)}
        />

        {/* 5. INTERACTIVE SIMULATION & TESTING PANEL (collapsible bottom-right tray for stadium rehearsal) */}
        <div className="fixed bottom-14 right-4 z-40 flex flex-col items-end">
          {showTestPanel && (
            <div className="mb-2 p-3 rounded-2xl bg-card/95 border border-border shadow-2xl backdrop-blur-md flex flex-col gap-2 max-w-xs">
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  🎬 LED Animation Rehearsal
                </span>
                <button
                  onClick={() => setShowTestPanel(false)}
                  className="text-xs text-muted-foreground hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
                <button
                  onClick={() =>
                    setActiveEvent({ type: "FOUR", runs: 4, batsmanName: strikerPlayer?.name || "Batter" })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40"
                >
                  Test 4
                </button>
                <button
                  onClick={() =>
                    setActiveEvent({ type: "SIX", runs: 6, batsmanName: strikerPlayer?.name || "Batter" })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-yellow-300 border border-amber-500/40"
                >
                  Test 6
                </button>
                <button
                  onClick={() =>
                    setActiveEvent({
                      type: "WICKET",
                      dismissal: "BOWLED",
                      batsmanName: strikerPlayer?.name || "Batter",
                      bowlerName: bowlerPlayer?.name || "Bowler",
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40"
                >
                  Test Wicket
                </button>
                <button
                  onClick={() => setActiveEvent({ type: "WIDE", runs: 1 })}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40"
                >
                  Test Wide
                </button>
                <button
                  onClick={() => setActiveEvent({ type: "NO_BALL" })}
                  className="px-2.5 py-1.5 rounded-lg bg-orange-600/30 hover:bg-orange-600/50 text-orange-200 border border-orange-500/40"
                >
                  Test No Ball
                </button>
                <button
                  onClick={() => setActiveEvent({ type: "FREE_HIT" })}
                  className="px-2.5 py-1.5 rounded-lg bg-fuchsia-600/30 hover:bg-fuchsia-600/50 text-fuchsia-200 border border-fuchsia-500/40"
                >
                  Test Free Hit
                </button>
                <button
                  onClick={() =>
                    setActiveEvent({ type: "SUPER_BALL", battingTeam: battingTeam?.name || "Team" })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40"
                >
                  Test Super Ball
                </button>
                <button
                  onClick={() => setActiveEvent({ type: "SUPER_OVER" })}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40"
                >
                  Test Super Over
                </button>
                <button
                  onClick={() =>
                    setActiveEvent({
                      type: "INNINGS_COMPLETE",
                      innings: 1,
                      runs: innings?.runs || 164,
                      wickets: innings?.wickets || 4,
                      overs: "20.0",
                      target: 165,
                      battingTeam: battingTeam?.name || "Jaguars",
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-card/80 text-foreground border border-border"
                >
                  Innings Break
                </button>
                <button
                  onClick={() =>
                    setActiveEvent({
                      type: "MATCH_RESULT",
                      winnerName: battingTeam?.name || "Jaipur Jaguars",
                      marginText: "Won by 28 Runs",
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-300 border border-yellow-500/40"
                >
                  Match Result
                </button>
                <button
                  onClick={() =>
                    setActiveEvent({
                      type: "TOSS_WIN",
                      teamName: home?.name || "Jaipur Jaguars",
                      electedTo: "bat",
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40"
                >
                  Toss Update
                </button>
                <button
                  onClick={() =>
                    setActiveEvent({
                      type: "BOWLER_CHANGE",
                      bowlerName: bowlerPlayer?.name || "Vikram Singh",
                      figures: "Right Arm Fast",
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-card/80 text-foreground border border-border"
                >
                  Bowler Change
                </button>
                <button
                  onClick={() =>
                    setActiveEvent({
                      type: "NEW_BATSMAN",
                      batsmanName: strikerPlayer?.name || "Rahul Sharma",
                      role: "Top Order Batter",
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-card/80 text-foreground border border-border col-span-2"
                >
                  New Batter In
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowTestPanel((prev) => !prev)}
            className="px-3 py-1.5 rounded-full bg-card/90 hover:bg-card border border-border/80 text-xs font-bold text-muted-foreground hover:text-white flex items-center gap-1.5 shadow-lg transition-all"
            title="Toggle LED event test tray"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Simulate LED Events</span>
            {showTestPanel ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </FullscreenLayout>
  );
}
