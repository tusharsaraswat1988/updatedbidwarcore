/**
 * Full-screen cricket plates shared by the ground LED and the OBS stream.
 * Figures come from the selected match scorecard, not the live crease.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  competitionGroupTitle,
  formatNetRunRate,
  parseCompetitionSelection,
  resolveKnockoutStageSelection,
  rowsForCompetitionSelection,
} from "@workspace/scoring-core/cricket";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";
import {
  BROADCAST_OVERLAY_SAFE_INSET_X,
  BROADCAST_OVERLAY_SAFE_INSET_Y,
} from "@/lib/broadcast-overlay";
import {
  broadcastMatchSummary,
  inningsPlates,
  knockoutBoardRows,
  knockoutResultLine,
  plateMatchId,
  sponsorTypeLabel,
  tossLine,
  upcomingFixture,
  type KnockoutBoardItem,
} from "@/lib/cricket-broadcast-plates";
import {
  getCricketMasterTeams,
  getPublicMatchScorecard,
  getScoringStandings,
  listScoringMatches,
  publicMatchScorecardQueryKey,
  type ScoringMatchJson,
} from "@/lib/scoring-api";
import { listFixtures, type ScoringFixture } from "@/lib/scoring-foundation-api";
import { cricketMasterTeamToScorerTeam, type CricketScorerTeam } from "@/lib/scoring-squad";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { CricketBattingScorecardOverlay } from "@/components/scoring/cricket-batting-scorecard-overlay";
import type { CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";

const STANDINGS_PAGE_SIZE = 8;

type Props = {
  overlay: CricketObsMidOverlayKind;
  tournamentId: number;
  tournamentName?: string;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  sponsors: SponsorLogo[];
  liveMatchId?: number | null;
  liveTossText?: string | null;
  liveStatus?: string | null;
  liveSequence?: number;
};

function teamById(teams: CricketScorerTeam[], id: number | null | undefined) {
  if (id == null) return null;
  return teams.find((team) => team.id === id) ?? null;
}

export function CricketBroadcastPlatesView({
  overlay,
  tournamentId,
  tournamentName,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  sponsors,
  liveMatchId,
  liveTossText,
  liveStatus,
  liveSequence = 0,
}: Props) {
  const needsMatches = overlay === "fixtures" || overlay === "intro" || overlay === "summary" || overlay === "scorecard" || overlay === "standings";
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: tournamentId > 0 && overlay !== "none" && overlay !== "neutral" && overlay !== "banner",
    staleTime: 60_000,
  });
  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: needsMatches && tournamentId > 0,
    staleTime: 30_000,
  });
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 30_000,
    refetchInterval: overlay === "standings" ? 30_000 : false,
  });
  const { data: fixtures } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 30_000,
  });

  const selectedId = plateMatchId({
    overlay: overlay === "intro" || overlay === "scorecard" || overlay === "summary" ? overlay : "intro",
    overlayMatchId,
    liveMatchId,
    liveStatus,
  });
  const cardMatchId = overlay === "scorecard" || overlay === "summary" || overlay === "batting"
    ? plateMatchId({
        overlay: overlay === "batting" ? "batting" : overlay,
        overlayMatchId,
        liveMatchId,
        liveStatus,
      })
    : null;

  const { data: scorecard } = useQuery({
    queryKey: publicMatchScorecardQueryKey(tournamentId, cardMatchId ?? 0, 0),
    queryFn: () => getPublicMatchScorecard(tournamentId, cardMatchId!),
    enabled: cardMatchId != null && tournamentId > 0 && (overlay === "scorecard" || overlay === "summary"),
    refetchInterval: overlay === "scorecard" || overlay === "summary" ? 4_000 : false,
  });

  const selectedMatch = useMemo(() => {
    const id = overlay === "intro" ? selectedId : cardMatchId;
    if (!id || !matches) return null;
    return matches.find((match) => match.id === id) ?? null;
  }, [overlay, selectedId, cardMatchId, matches]);

  const fixture = useMemo(
    () => upcomingFixture(matches ?? [], overlayMatchId),
    [matches, overlayMatchId],
  );

  const [sponsorIndex, setSponsorIndex] = useState(0);
  const spotlight = useMemo(() => {
    if (overlaySponsorName && overlaySponsorName !== "all") {
      return sponsors.find((sponsor) => sponsor.name?.toLowerCase().trim() === overlaySponsorName.toLowerCase().trim()) ?? null;
    }
    if (sponsors.length === 0) return null;
    return sponsors[sponsorIndex % sponsors.length] ?? null;
  }, [overlaySponsorName, sponsors, sponsorIndex]);

  useEffect(() => {
    if (overlay !== "sponsors" || sponsors.length <= 1 || (overlaySponsorName && overlaySponsorName !== "all")) return;
    const timer = setInterval(() => setSponsorIndex((index) => index + 1), 5000);
    return () => clearInterval(timer);
  }, [overlay, sponsors.length, overlaySponsorName]);

  const resolvedStandings = useMemo(
    () => rowsForCompetitionSelection(
      standings?.groups ?? [],
      standings ?? [],
      parseCompetitionSelection(overlayStageOrGroup),
    ),
    [standings, overlayStageOrGroup],
  );
  const [standingsPage, setStandingsPage] = useState(0);
  const standingsPages = Math.max(1, Math.ceil(resolvedStandings.rows.length / STANDINGS_PAGE_SIZE));
  const standingsRows = resolvedStandings.rows.slice(
    (standingsPage % standingsPages) * STANDINGS_PAGE_SIZE,
    (standingsPage % standingsPages) * STANDINGS_PAGE_SIZE + STANDINGS_PAGE_SIZE,
  );
  useEffect(() => {
    if (overlay !== "standings" || standingsPages <= 1) return;
    const timer = setInterval(() => setStandingsPage((page) => (page + 1) % standingsPages), 8000);
    return () => clearInterval(timer);
  }, [overlay, standingsPages]);

  if (overlay === "none" || overlay === "neutral" || overlay === "banner") return null;

  if (overlay === "batting") {
    return (
      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-8 py-8">
        <CricketBattingScorecardOverlay
          tournamentId={tournamentId}
          matchId={cardMatchId}
          tournamentName={tournamentName ?? ""}
          liveSequence={liveSequence}
        />
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative flex h-full w-full flex-col overflow-hidden"
          style={{ background: "rgba(5, 5, 8, 0.94)", fontFamily: BROADCAST_FONTS.body }}
        >
          <div
            className="flex h-[52px] items-center border-b border-white/10"
            style={{
              background: BIDWAR_SCOREBOARD_SHELL,
              paddingLeft: BROADCAST_OVERLAY_SAFE_INSET_X,
              paddingRight: BROADCAST_OVERLAY_SAFE_INSET_X,
            }}
          >
            <span
              className="text-xl uppercase tracking-wide text-white"
              style={{ fontFamily: BROADCAST_FONTS.display }}
            >
              {tournamentName || "Cricket"}
            </span>
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{
              padding: `${BROADCAST_OVERLAY_SAFE_INSET_Y}px ${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
            }}
          >
            {overlay === "sponsors" ? (
              <SponsorPlate sponsor={spotlight} />
            ) : null}
            {overlay === "standings" ? (
              <StandingsPlate
                rows={standingsRows}
                qualifiers={resolvedStandings.qualifiers}
                groupTitle={resolvedStandings.group ? competitionGroupTitle(resolvedStandings.group) : null}
                page={standingsPage % standingsPages}
                pages={standingsPages}
                fixtures={fixtures ?? []}
                matches={matches ?? []}
                teams={teams}
                stageOrGroup={overlayStageOrGroup}
              />
            ) : null}
            {overlay === "fixtures" ? <FixturePlate match={fixture} teams={teams} /> : null}
            {overlay === "intro" ? (
              <IntroPlate
                match={selectedMatch}
                teams={teams}
                liveMatchId={liveMatchId}
                liveTossText={liveTossText}
              />
            ) : null}
            {overlay === "scorecard" ? (
              <ScorecardPlate
                plates={inningsPlates(scorecard?.scorecard, scorecard?.players)}
                teams={teams}
                ready={cardMatchId != null}
              />
            ) : null}
            {overlay === "summary" ? (
              <SummaryPlate
                match={selectedMatch}
                scorecard={scorecard}
                teams={teams}
                ready={cardMatchId != null}
              />
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function SponsorPlate({ sponsor }: { sponsor: SponsorLogo | null }) {
  if (!sponsor) {
    return <Empty text="No sponsors added for this tournament." />;
  }
  const typeLabel = sponsorTypeLabel(sponsor);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      {sponsor.url ? (
        <img src={sponsor.url} alt={sponsor.name || ""} className="max-h-[42vh] max-w-[70vw] object-contain" />
      ) : (
        <h2 className="text-6xl uppercase text-white" style={{ fontFamily: BROADCAST_FONTS.display }}>
          {sponsor.name || "Sponsor"}
        </h2>
      )}
      {typeLabel ? (
        <p className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: BIDWAR_BROADCAST_YELLOW }}>
          {typeLabel}
        </p>
      ) : null}
    </div>
  );
}

function StandingsPlate({
  rows,
  qualifiers,
  groupTitle,
  page,
  pages,
  fixtures,
  matches,
  teams,
  stageOrGroup,
}: {
  rows: Array<{
    teamId: number;
    teamName: string;
    played: number;
    won: number;
    lost: number;
    tied: number;
    noResult: number;
    points: number;
    netRunRate: number;
    drawId?: number | null;
  }>;
  qualifiers: number;
  groupTitle: string | null;
  page: number;
  pages: number;
  fixtures: ScoringFixture[];
  matches: ScoringMatchJson[];
  teams: CricketScorerTeam[];
  stageOrGroup?: string;
}) {
  const stageSelection = parseCompetitionSelection(stageOrGroup);
  const knockout = useMemo(
    () => resolveKnockoutStageSelection(fixtures, matches, stageSelection),
    [fixtures, matches, stageSelection],
  );
  const isKnockout = !groupTitle && (
    stageSelection.kind === "round" ||
    knockout.ambiguous ||
    knockout.fixtures.length > 0 ||
    knockout.matches.length > 0
  );
  if (isKnockout) {
    const board = knockoutBoardRows(
      knockout.fixtures as KnockoutBoardItem[],
      (knockout.matches as ScoringMatchJson[]).map((match) => ({
        id: match.id,
        fixtureId: match.fixtureId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        roundName: match.roundName,
        resultSummary: match.resultSummary,
        status: match.status,
      })),
    );
    return (
      <div className="flex h-full flex-col gap-4">
        <PlateTitle kicker="Knockout" title={stageSelection.kind === "round" ? stageSelection.roundKey : "Stage"} />
        {knockout.ambiguous || board.length === 0 ? (
          <Empty text={knockout.ambiguous ? "This stage is in more than one competition." : "No fixtures in this stage."} />
        ) : (
          <ul className="divide-y divide-white/10 border border-white/10" style={{ background: BIDWAR_SCOREBOARD_SHELL }}>
            {board.map((item) => {
              const home = teamById(teams, item.homeTeamId);
              const away = teamById(teams, item.awayTeamId);
              return (
                <li key={item.id} className="flex items-center justify-between gap-6 px-6 py-4">
                  <span className="text-2xl uppercase text-white" style={{ fontFamily: BROADCAST_FONTS.display }}>
                    {home?.name || "Home"} <span style={{ color: BIDWAR_BROADCAST_YELLOW }}>vs</span> {away?.name || "Away"}
                  </span>
                  <span className="text-sm font-bold uppercase tracking-wider text-white/70">
                    {knockoutResultLine(item)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PlateTitle kicker={groupTitle ? `${groupTitle} standings` : "Standings"} title="Points table" />
      <div className="min-h-0 flex-1 overflow-hidden border border-white/10" style={{ background: BIDWAR_SCOREBOARD_SHELL }}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/15 text-xs font-bold uppercase tracking-widest text-white/60">
              {["Pos", "Team", "P", "W", "L", "T", "NR", "Pts", "NRR"].map((heading) => (
                <th key={heading} className="px-3 py-3 text-center first:text-center">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-white/50">No standings yet.</td>
              </tr>
            ) : rows.map((row, index) => {
              const position = page * STANDINGS_PAGE_SIZE + index + 1;
              const qualified = qualifiers > 0 && position <= qualifiers;
              return (
                <tr key={`${row.drawId ?? "legacy"}-${row.teamId}`} className="border-b border-white/5">
                  <td className="px-3 py-3 text-center font-bold" style={{ color: qualified ? BIDWAR_BROADCAST_YELLOW : "white" }}>{position}</td>
                  <td className="px-3 py-3 text-lg uppercase text-white">{row.teamName}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-white/80">{row.played}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-white">{row.won}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-white/80">{row.lost}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-white/80">{row.tied}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-white/80">{row.noResult}</td>
                  <td className="px-3 py-3 text-center text-2xl tabular-nums" style={{ color: BIDWAR_BROADCAST_YELLOW, fontFamily: BROADCAST_FONTS.display }}>{row.points}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-white/80">{formatNetRunRate(row.netRunRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-white/40">
          {page + 1} / {pages}
        </p>
      ) : null}
    </div>
  );
}

function FixturePlate({
  match,
  teams,
}: {
  match: ScoringMatchJson | null;
  teams: CricketScorerTeam[];
}) {
  if (!match) return <Empty text="No upcoming match." />;
  const home = teamById(teams, match.homeTeamId);
  const away = teamById(teams, match.awayTeamId);
  const when = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Time to be confirmed";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <PlateTitle
        kicker={match.roundName ? `Upcoming · ${match.roundName}` : "Upcoming match"}
        title={`Match ${match.tournamentMatchNumber || match.id}`}
      />
      <div className="grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-8">
        <Crest name={home?.name || "Home"} logoUrl={home?.logoUrl} />
        <span className="text-6xl italic" style={{ color: BIDWAR_BROADCAST_YELLOW, fontFamily: BROADCAST_FONTS.display }}>VS</span>
        <Crest name={away?.name || "Away"} logoUrl={away?.logoUrl} />
      </div>
      <p className="text-sm font-bold uppercase tracking-wider text-white/80">
        {match.venue || "Venue to be confirmed"} · {when}
      </p>
    </div>
  );
}

function IntroPlate({
  match,
  teams,
  liveMatchId,
  liveTossText,
}: {
  match: ScoringMatchJson | null;
  teams: CricketScorerTeam[];
  liveMatchId?: number | null;
  liveTossText?: string | null;
}) {
  if (!match) return <Empty text="Choose a match to introduce." />;
  const home = teamById(teams, match.homeTeamId);
  const away = teamById(teams, match.awayTeamId);
  const state = match.stateJson as { tossWinnerTeamId?: number | null; electedTo?: string | null } | null;
  const tossWinner = state?.tossWinnerTeamId ? teamById(teams, state.tossWinnerTeamId) : null;
  const toss = match.id === liveMatchId && liveTossText
    ? liveTossText
    : tossLine(state, tossWinner?.name);
  const venue = match.status === "live"
    ? `Live from ${match.venue || "the ground"}`
    : (match.venue || "Venue to be confirmed");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <PlateTitle
        kicker={match.roundName ? `Match ${match.tournamentMatchNumber || match.id} · ${match.roundName}` : `Match ${match.tournamentMatchNumber || match.id}`}
        title={`${home?.name || "Home"} vs ${away?.name || "Away"}`}
      />
      <div className="flex items-center gap-16">
        <Crest name={home?.name || "Home"} logoUrl={home?.logoUrl} large />
        <span className="text-7xl italic" style={{ color: BIDWAR_BROADCAST_YELLOW, fontFamily: BROADCAST_FONTS.display }}>VS</span>
        <Crest name={away?.name || "Away"} logoUrl={away?.logoUrl} large />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/70">{venue}</p>
        {toss ? <p className="mt-2 text-base font-semibold uppercase tracking-wide text-white">{toss}</p> : null}
      </div>
    </div>
  );
}

function ScorecardPlate({
  plates,
  teams,
  ready,
}: {
  plates: ReturnType<typeof inningsPlates>;
  teams: CricketScorerTeam[];
  ready: boolean;
}) {
  if (!ready) return <Empty text="Choose a live or finished match." />;
  if (plates.length === 0) return <Empty text="Scorecard is not ready." />;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      {plates.map((inn) => {
        const batting = teamById(teams, inn.battingTeamId);
        return (
          <section
            key={inn.innings}
            className="border border-white/10"
            style={{ background: BIDWAR_SCOREBOARD_SHELL, borderTop: `3px solid ${BIDWAR_BROADCAST_YELLOW}` }}
          >
            <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3" style={{ background: BIDWAR_SCOREBOARD_PANEL }}>
              <h2 className="text-3xl uppercase text-white" style={{ fontFamily: BROADCAST_FONTS.display }}>
                {batting?.name || `Innings ${inn.innings}`}
              </h2>
              <p className="text-base font-bold uppercase tracking-[0.14em]" style={{ color: BIDWAR_BROADCAST_YELLOW }}>
                {inn.innings === 1 ? "1st" : inn.innings === 2 ? "2nd" : `${inn.innings}th`} innings
              </p>
            </div>
            <div className="grid grid-cols-2 gap-0">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-widest text-white/50">
                    <th className="px-3 py-2">Batter</th>
                    <th className="px-2 py-2 text-right">R</th>
                    <th className="px-2 py-2 text-right">B</th>
                    <th className="px-2 py-2 text-right">4s</th>
                    <th className="px-2 py-2 text-right">6s</th>
                    <th className="px-3 py-2 text-right">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.batting.map((batter) => (
                    <tr
                      key={batter.playerId}
                      className="border-t border-white/10"
                      style={{ background: batter.notOut ? "rgba(255, 215, 0, 0.10)" : "transparent" }}
                    >
                      <td className="px-3 py-1.5">
                        <span className="font-bold" style={{ color: batter.notOut ? BIDWAR_BROADCAST_YELLOW : "#F8FAFC" }}>
                          {batter.name}{batter.notOut ? " *" : ""}
                        </span>
                        <span className="mt-0.5 block text-[11px] uppercase" style={{ color: "rgba(248, 250, 252, 0.46)" }}>{batter.dismissal}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-bold" style={{ color: BIDWAR_BROADCAST_YELLOW }}>{batter.runs}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "rgba(248, 250, 252, 0.72)" }}>{batter.balls}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "rgba(248, 250, 252, 0.72)" }}>{batter.fours}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "rgba(248, 250, 252, 0.72)" }}>{batter.sixes}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: "rgba(248, 250, 252, 0.72)" }}>{batter.strikeRate.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="w-full border-collapse border-l border-white/10 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-widest text-white/50">
                    <th className="px-3 py-2">Bowler</th>
                    <th className="px-2 py-2 text-right">O</th>
                    <th className="px-2 py-2 text-right">M</th>
                    <th className="px-2 py-2 text-right">R</th>
                    <th className="px-2 py-2 text-right">W</th>
                    <th className="px-3 py-2 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.bowling.map((bowler) => (
                    <tr key={bowler.playerId} className="border-t border-white/5">
                      <td className="px-3 py-1.5 font-bold text-white">{bowler.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-white/80">{bowler.overs}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-white/80">{bowler.maidens}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-white/80">{bowler.runs}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: BIDWAR_BROADCAST_YELLOW }}>{bowler.wickets}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-white/80">{bowler.economy.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] items-stretch border-t border-white/10">
              <p className="px-4 py-2 text-xs uppercase tracking-wide" style={{ color: "rgba(248, 250, 252, 0.72)" }}>
                {inn.extrasLine}
                {inn.fallLine ? ` · Fall ${inn.fallLine}` : ""}
              </p>
              <p className="px-4 py-2 font-mono text-sm font-bold" style={{ color: BIDWAR_BROADCAST_YELLOW }}>
                {inn.overs} Overs
              </p>
              <p className="px-4 py-2 font-mono text-sm font-black" style={{ background: BIDWAR_BROADCAST_YELLOW, color: "#050507" }}>
                Total {inn.totalRuns}/{inn.totalWickets}
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SummaryPlate({
  match,
  scorecard,
  teams,
  ready,
}: {
  match: ScoringMatchJson | null;
  scorecard: { scorecard: Parameters<typeof inningsPlates>[0]; players: Record<string, string>; match: { winnerTeamId: number | null; resultSummary: string | null; homeTeamId: number; awayTeamId: number } } | undefined;
  teams: CricketScorerTeam[];
  ready: boolean;
}) {
  if (!ready) return <Empty text="Choose a finished match." />;
  const homeId = scorecard?.match.homeTeamId ?? match?.homeTeamId ?? 0;
  const awayId = scorecard?.match.awayTeamId ?? match?.awayTeamId ?? 0;
  const winnerId = scorecard?.match.winnerTeamId ?? match?.winnerTeamId ?? null;
  const winner = teamById(teams, winnerId);
  const summary = broadcastMatchSummary({
    scorecard: scorecard?.scorecard,
    players: scorecard?.players,
    homeTeamId: homeId,
    awayTeamId: awayId,
    winnerTeamId: winnerId,
    resultSummary: scorecard?.match.resultSummary ?? match?.resultSummary ?? null,
    winnerName: winner?.name,
  });
  const home = teamById(teams, homeId);
  const away = teamById(teams, awayId);
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <PlateTitle kicker={match ? `Match ${match.tournamentMatchNumber || match.id}` : "Match result"} title={summary.resultText} />
      <div className="grid grid-cols-2 gap-6">
        <SideCard teamName={home?.name || "Home"} logoUrl={home?.logoUrl} side={summary.home} winner={winnerId === homeId} />
        <SideCard teamName={away?.name || "Away"} logoUrl={away?.logoUrl} side={summary.away} winner={winnerId === awayId} />
      </div>
    </div>
  );
}

function SideCard({
  teamName,
  logoUrl,
  side,
  winner,
}: {
  teamName: string;
  logoUrl?: string | null;
  side: { score: string | null; overs: string | null; topBatter: { name: string; runs?: number; balls?: number } | null; topBowler: { name: string; wickets?: number; runsConceded?: number } | null };
  winner: boolean;
}) {
  return (
    <div
      className="p-6"
      style={{
        background: BIDWAR_SCOREBOARD_PANEL,
        border: winner ? `2px solid ${BIDWAR_BROADCAST_YELLOW}` : "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? <img src={logoUrl} alt="" className="h-12 w-12 object-contain" /> : null}
          <div className="min-w-0">
            <p className="truncate text-3xl uppercase text-white" style={{ fontFamily: BROADCAST_FONTS.display }}>{teamName}</p>
            {winner ? <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: BIDWAR_BROADCAST_YELLOW }}>Winner</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-5xl tabular-nums text-white" style={{ fontFamily: BROADCAST_FONTS.display }}>{side.score ?? "—"}</p>
          <p className="text-xs font-bold uppercase text-white/50">{side.overs ? `${side.overs} ov` : ""}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <Performer label="Top batter" name={side.topBatter?.name} figure={side.topBatter ? `${side.topBatter.runs} (${side.topBatter.balls})` : null} />
        <Performer label="Top bowler" name={side.topBowler?.name} figure={side.topBowler ? `${side.topBowler.wickets}-${side.topBowler.runsConceded}` : null} />
      </div>
    </div>
  );
}

function Performer({ label, name, figure }: { label: string; name?: string; figure: string | null }) {
  if (!name) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span className="truncate font-bold text-white">{name}</span>
      <span className="tabular-nums" style={{ color: BIDWAR_BROADCAST_YELLOW }}>{figure ?? "—"}</span>
    </div>
  );
}

function Crest({ name, logoUrl, large }: { name: string; logoUrl?: string | null; large?: boolean }) {
  const size = large ? "h-40 w-40" : "h-28 w-28";
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className={`${size} flex items-center justify-center`}>
        {logoUrl ? (
          <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-5xl uppercase" style={{ color: BIDWAR_BROADCAST_YELLOW, fontFamily: BROADCAST_FONTS.display }}>
            {name.slice(0, 3)}
          </span>
        )}
      </div>
      <p className="max-w-[240px] text-3xl uppercase text-white" style={{ fontFamily: BROADCAST_FONTS.display }}>{name}</p>
    </div>
  );
}

function PlateTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BIDWAR_BROADCAST_YELLOW }}>{kicker}</p>
      <h2 className="mt-1 text-5xl uppercase text-white" style={{ fontFamily: BROADCAST_FONTS.display }}>{title}</h2>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="m-auto text-center text-xl text-white/50">{text}</p>;
}
