/**
 * Full-bleed venue LED moment scenes — intro, winner, sponsor, next match, results.
 * Driven by Broadcast Director `venueScene` (hall TV / projector).
 */

import { useEffect, useState, type ReactNode } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { isPairMatchKind } from "@workspace/badminton-core";
import { SidePlayerPhotos } from "@/components/badminton/side-players";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";
import {
  BadmintonLedChyron,
  BadmintonLedTopStrip,
} from "@/components/badminton/badminton-led-chrome";
import { badmintonLedSurfaceStyle, fixedScoreStyle } from "@/components/badminton/badminton-led-theme";
import type { ScoreBoardSponsor } from "@/components/badminton/score-board-sponsor-panel";
import {
  identityFromSideInfo,
} from "@/lib/team-player-identity";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  matchCourtLabel,
  matchIdentityLine,
  resolveBroadcastMatchSides,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";
import { VenueSponsorShowcase } from "@/components/badminton/venue-sponsor-showcase";
import {
  formatPointDifference,
  gameScoreLines,
  gamesWonLine,
  listRecentCompleted,
  loserLabel,
  outcomeLabel,
  winnerLabel,
  winnerPointDifference,
  type ResultsMatch,
} from "@/lib/badminton-results";
import { cn } from "@/lib/utils";

const RESULTS_ROTATE_MS = 5_000;

type ChromeProps = {
  tournamentName: string;
  tournamentLogoUrl?: string;
  sponsorLogos: SponsorLogo[];
  scoreBoardSponsor?: ScoreBoardSponsor | null;
  roundName?: string;
  courtNumber?: string;
  matchStatus?: BadmintonMatchState["matchStatus"];
};

function VenueChromeShell({
  chrome,
  children,
  showChyron = true,
  /** Sponsor showcase needs max stage height — skip reserved chyron spacer. */
  footer = "auto",
}: {
  chrome: ChromeProps;
  children: ReactNode;
  showChyron?: boolean;
  footer?: "auto" | "none";
}) {
  const showFooter = footer !== "none" && (showChyron || footer === "auto");

  return (
    <div
      className={cn(
        "badminton-led-surface absolute inset-0 overflow-hidden font-['Barlow_Condensed'] led-display-tv",
        showFooter
          ? "grid grid-rows-[auto_1fr_auto]"
          : "grid grid-rows-[auto_1fr]",
      )}
      style={badmintonLedSurfaceStyle}
    >
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 55% at 50% 40%, rgba(255,215,0,0.08), transparent 70%),
            linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)
          `,
          backgroundSize: "auto, 80px 80px, 80px 80px",
        }}
      />
      <BadmintonLedTopStrip
        tournamentName={chrome.tournamentName}
        tournamentLogoUrl={chrome.tournamentLogoUrl}
        courtNumber={chrome.courtNumber}
        roundName={chrome.roundName}
        matchStatus={chrome.matchStatus ?? "scheduled"}
        isTimeout={false}
        leftLabel="Side A"
        rightLabel="Side B"
        scoreBoardSponsor={chrome.scoreBoardSponsor}
      />
      <div className="relative z-10 min-h-0 flex items-stretch justify-center bg-[#070708] px-[3%] py-2">
        {children}
      </div>
      {showFooter ? (
        showChyron ? (
          <BadmintonLedChyron
            sponsors={chrome.sponsorLogos}
            tournamentName={chrome.tournamentName}
          />
        ) : (
          <div className="h-[10vh] min-h-[72px] max-h-[104px] border-t border-white/10 bg-black/50" />
        )
      ) : null}
    </div>
  );
}

function MomentSideCard({
  side,
  info,
  matchKind,
}: {
  side: "left" | "right";
  info: BadmintonMatchState["leftSide"];
  matchKind: BadmintonMatchState["matchKind"];
}) {
  const identity = identityFromSideInfo(info);
  const isLeft = side === "left";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 min-w-0 flex-1 px-1",
        isLeft ? "text-right items-end" : "text-left items-start",
      )}
    >

      <div
        className={cn(
          "rounded-2xl p-2 border",
          isLeft
            ? "border-[#ffc400]/35 bg-[#ffc400]/8"
            : "border-[#ce93d8]/35 bg-[#ce93d8]/8",
        )}
      >
        <SidePlayerPhotos
          info={info}
          matchKind={matchKind}
          side={side}
          size="broadcast"
        />
      </div>
      <TeamPlayerCard
        identity={identity}
        size="xl"
        tone="led"
        layout="stack"
        align={isLeft ? "end" : "start"}
        playerClassName="bw-heading bw-name-full text-2xl md:text-3xl lg:text-4xl text-white"
        teamClassName="bw-label bw-name-full text-white/70"
      />
    </div>
  );
}

/** Pre-match / now-on-court intro for the primary match. */
export function VenueIntroScene({
  state,
  chrome,
  courtNumber,
  matchLabel,
  roundName,
}: {
  state: BadmintonMatchState;
  chrome: ChromeProps;
  courtNumber?: string;
  matchLabel?: string;
  roundName?: string;
}) {
  const live = state.matchStatus === "live" || state.matchStatus === "paused";
  const headline = live ? "NOW ON COURT" : "NEXT ON COURT";

  return (
    <VenueChromeShell
      chrome={{
        ...chrome,
        courtNumber,
        roundName: roundName ?? matchLabel,
        matchStatus: state.matchStatus,
      }}
    >
      <div className="w-full max-w-6xl flex flex-col items-center gap-6 animate-[badmintonMomentIn_0.45s_ease-out_forwards]">
        <div className="text-center space-y-2">
          <p className="bw-label text-[#ffd700] tracking-[0.4em] text-sm md:text-base">
            {headline}
          </p>
          {courtNumber ? (
            <p className="bw-heading text-white text-4xl md:text-5xl">Court {courtNumber}</p>
          ) : null}
          {(matchLabel || roundName) && (
            <p className="bw-caption text-white/60 text-sm md:text-base">
              {matchLabel || roundName}
            </p>
          )}
          {isPairMatchKind(state.matchKind) ? (
            <p className="bw-meta text-white/45 uppercase tracking-[0.2em]">
              {state.matchKind.replace("_", " ")}
            </p>
          ) : null}
        </div>

        <div className="w-full flex items-center justify-center gap-4 md:gap-8">
          <MomentSideCard side="left" info={state.leftSide} matchKind={state.matchKind} />
          <div className="shrink-0 flex flex-col items-center gap-2 px-2">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3">
              <span className="bw-heading text-white text-3xl md:text-4xl tracking-[0.2em]">VS</span>
            </div>
          </div>
          <MomentSideCard side="right" info={state.rightSide} matchKind={state.matchKind} />
        </div>
      </div>
    </VenueChromeShell>
  );
}

/** Director-held winner celebration (also used when match is complete). */
export function VenueWinnerScene({
  state,
  chrome,
  courtNumber,
}: {
  state: BadmintonMatchState;
  chrome: ChromeProps;
  courtNumber?: string;
}) {
  if (!state.winnerSide) {
    return (
      <VenueChromeShell chrome={{ ...chrome, courtNumber, roundName: "Awaiting result" }}>
        <p className="bw-heading text-white/70 text-3xl tracking-[0.2em]">NO WINNER YET</p>
      </VenueChromeShell>
    );
  }

  const winner = state.winnerSide === "left" ? state.leftSide : state.rightSide;
  const identity = identityFromSideInfo(winner);
  const completed = state.games.filter((g) => g.phase === "completed");
  const isLeft = state.winnerSide === "left";

  return (
    <VenueChromeShell
      chrome={{
        ...chrome,
        courtNumber,
        roundName: "Match complete",
        matchStatus: "completed",
      }}
      showChyron={false}
    >
      <div
        className={cn(
          "w-full max-w-3xl rounded-3xl border px-10 py-10 text-center shadow-2xl",
          "animate-[badmintonMomentIn_0.45s_ease-out_forwards]",
          isLeft
            ? "border-[#ffc400]/40 bg-gradient-to-br from-[#1a1400] to-[#0a0a0c]"
            : "border-[#ce93d8]/40 bg-gradient-to-br from-[#180523] to-[#0a0a0c]",
        )}
      >
        <div className="badminton-winner-seal mx-auto mb-5">
          <span className="bw-heading">WINNER</span>
        </div>

        <div className="mb-4 flex justify-center">
          <SidePlayerPhotos
            info={winner}
            matchKind={state.matchKind}
            side={state.winnerSide}
            size="broadcast"
          />
        </div>

        <div className="mb-3 flex justify-center">
          <TeamPlayerCard
            identity={identity}
            size="xl"
            tone="led"
            align="center"
            playerClassName="bw-heading text-5xl text-white"
            teamClassName="bw-label text-white/75"
          />
        </div>

        <div className="bg-white/8 rounded-2xl px-8 py-4 mb-6 inline-block border border-white/10">
          <span className="bw-display-l text-5xl" style={fixedScoreStyle(isLeft)}>
            {state.gamesLeft}
          </span>
          <span className="text-white/30 text-3xl mx-3">–</span>
          <span className="bw-display-l text-5xl" style={fixedScoreStyle(!isLeft)}>
            {state.gamesRight}
          </span>
        </div>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          {completed.map((g) => (
            <div
              key={g.gameNumber}
              className="bg-white/10 rounded-lg px-3 py-2 border border-white/10"
            >
              <span className="text-white/50 text-xs block text-center mb-1">
                G{g.gameNumber}
              </span>
              <span className="font-bold text-white text-sm">
                {g.leftScore}–{g.rightScore}
              </span>
            </div>
          ))}
        </div>
      </div>
    </VenueChromeShell>
  );
}

/** Full-screen sponsor beat — looping title → co → partners×4. Header stays fixed. */
export function VenueSponsorScene({ chrome }: { chrome: ChromeProps }) {
  return (
    <VenueChromeShell
      chrome={{ ...chrome, roundName: "Our sponsors" }}
      showChyron={false}
      footer="none"
    >
      <div className="w-full h-full min-h-0">
        <VenueSponsorShowcase sponsors={chrome.sponsorLogos} />
      </div>
    </VenueChromeShell>
  );
}

/** Up-next fixture card for between-match holds. */
export function VenueNextMatchScene({
  match,
  chrome,
}: {
  match: BroadcastConsoleMatch | null;
  chrome: ChromeProps;
}) {
  if (!match) {
    return (
      <VenueChromeShell chrome={{ ...chrome, roundName: "Up next" }}>
        <div className="text-center space-y-3 animate-[badmintonMomentIn_0.45s_ease-out_forwards]">
          <p className="bw-label text-[#ffd700] tracking-[0.4em]">UP NEXT</p>
          <p className="bw-heading text-white/70 text-3xl">No upcoming match</p>
        </div>
      </VenueChromeShell>
    );
  }

  const detail = (match.detail ?? {}) as {
    courtNumber?: string;
    matchLabel?: string;
    roundName?: string;
    matchNumber?: string;
    categoryName?: string;
  };
  const sides = resolveBroadcastMatchSides(match);
  const courtLabel = matchCourtLabel(match);
  const metaBits = [
    detail.categoryName?.trim() || detail.roundName?.trim(),
    detail.matchLabel?.trim(),
    detail.matchNumber?.trim() ? `Match ${detail.matchNumber.trim()}` : null,
  ].filter(Boolean);
  const metaLine = metaBits.join(" · ");
  const vsFallback = matchIdentityLine(match);

  return (
    <VenueChromeShell
      chrome={{
        ...chrome,
        courtNumber: detail.courtNumber,
        roundName: "Up next",
        matchStatus: "scheduled",
      }}
    >
      <div className="w-full max-w-6xl h-full min-h-0 flex flex-col items-center justify-center gap-5 md:gap-7 animate-[badmintonMomentIn_0.45s_ease-out_forwards]">
        <div className="text-center space-y-1.5 shrink-0">
          <p className="bw-label text-[#ffd700] tracking-[0.4em] text-sm md:text-base">
            UP NEXT
          </p>
          {courtLabel !== "Court —" ? (
            <p className="bw-caption text-white/70 text-base md:text-xl tracking-[0.12em] uppercase">
              {courtLabel}
            </p>
          ) : null}
          {metaLine ? (
            <p className="bw-meta text-white/45 text-sm md:text-base max-w-3xl">{metaLine}</p>
          ) : null}
        </div>

        {sides ? (
          <div className="w-full flex items-center justify-center gap-4 md:gap-8 min-h-0">
            <MomentSideCard side="left" info={sides.left} matchKind={sides.matchKind} />
            <div className="shrink-0 rounded-2xl border border-white/20 bg-white/10 px-5 py-3">
              <span className="bw-heading text-white text-3xl md:text-4xl tracking-[0.2em]">VS</span>
            </div>
            <MomentSideCard side="right" info={sides.right} matchKind={sides.matchKind} />
          </div>
        ) : (
          <p className="bw-heading text-white text-3xl md:text-5xl text-center max-w-4xl leading-tight">
            {vsFallback}
          </p>
        )}
      </div>
    </VenueChromeShell>
  );
}

function broadcastMatchToResults(m: BroadcastConsoleMatch): ResultsMatch {
  return {
    id: m.id,
    status: m.status,
    scheduledAt: m.scheduledAt,
    completedAt: m.state?.endedAt ?? null,
    detail: m.detail,
    state: m.state,
    resultSummary: null,
    fixtureId: null,
    roundName:
      typeof m.detail?.roundName === "string" ? m.detail.roundName : null,
  };
}

function resultMetaLine(m: ResultsMatch): string {
  const detail = (m.detail ?? {}) as {
    categoryName?: string;
    roundName?: string;
    courtNumber?: string;
    matchLabel?: string;
  };
  return [
    detail.categoryName?.trim(),
    detail.roundName?.trim() ||
      (typeof m.roundName === "string" ? m.roundName.trim() : ""),
    detail.courtNumber?.trim() ? `Court ${detail.courtNumber.trim()}` : null,
    detail.matchLabel?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Between-match board — completed matches with winner + point difference. */
export function VenueRecentResultsScene({
  matches,
  chrome,
}: {
  matches: BroadcastConsoleMatch[];
  chrome: ChromeProps;
}) {
  const results = listRecentCompleted(
    matches.map(broadcastMatchToResults),
    8,
  );
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    if (results.length <= 1) return;
    const id = setInterval(() => {
      setFocusIndex((i) => (i + 1) % results.length);
    }, RESULTS_ROTATE_MS);
    return () => clearInterval(id);
  }, [results.length]);

  if (results.length === 0) {
    return (
      <VenueChromeShell chrome={{ ...chrome, roundName: "Results" }}>
        <div className="text-center space-y-3 animate-[badmintonMomentIn_0.45s_ease-out_forwards]">
          <p className="bw-label text-[#ffd700] tracking-[0.4em]">RESULTS</p>
          <p className="bw-heading text-white/70 text-3xl">No completed matches yet</p>
        </div>
      </VenueChromeShell>
    );
  }

  const focused = results[Math.min(focusIndex, results.length - 1)]!;
  const listRows = results.slice(0, 6);

  return (
    <VenueChromeShell
      chrome={{ ...chrome, roundName: "Match results", matchStatus: "completed" }}
      showChyron={false}
    >
      <div className="w-full max-w-6xl h-full min-h-0 flex flex-col gap-4 md:gap-5 animate-[badmintonMomentIn_0.45s_ease-out_forwards]">
        <div className="text-center shrink-0 space-y-1">
          <p className="bw-label text-[#ffd700] tracking-[0.4em] text-sm md:text-base">
            RESULTS
          </p>
          <p className="bw-caption text-white/50 text-xs md:text-sm uppercase tracking-[0.18em]">
            Winner · Games · Point difference
          </p>
        </div>

        <div
          key={focused.id}
          className="shrink-0 rounded-2xl border border-[#ffd700]/35 bg-gradient-to-br from-[#1a1400] to-[#0a0a0c] px-5 py-4 md:px-8 md:py-5"
        >
          <ResultHighlightCard match={focused} />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="grid gap-2 content-start">
            {listRows.map((m, idx) => {
              const winner = winnerLabel(m) ?? "Winner";
              const loser = loserLabel(m) ?? "—";
              const diff = formatPointDifference(winnerPointDifference(m));
              const active = m.id === focused.id;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1.4fr)_auto_auto] items-center gap-3 rounded-xl border px-3 py-2.5 md:px-4",
                    active
                      ? "border-[#ffd700]/40 bg-[#ffd700]/10"
                      : "border-white/10 bg-white/[0.04]",
                  )}
                >
                  <div className="min-w-0">
                    <p className="bw-heading text-white text-lg md:text-xl truncate leading-tight">
                      {winner}
                      <span className="text-white/35 font-normal mx-1.5">def</span>
                      <span className="text-white/70">{loser}</span>
                    </p>
                    {resultMetaLine(m) ? (
                      <p className="bw-meta text-white/40 text-[11px] md:text-xs truncate mt-0.5">
                        {resultMetaLine(m)}
                      </p>
                    ) : null}
                  </div>
                  <p className="bw-display-l text-xl md:text-2xl text-white tabular-nums shrink-0">
                    {gamesWonLine(m)}
                  </p>
                  <p
                    className={cn(
                      "bw-heading text-lg md:text-xl tabular-nums shrink-0 min-w-[3.5rem] text-right",
                      active ? "text-[#ffd700]" : "text-emerald-300/90",
                    )}
                  >
                    {diff}
                  </p>
                  <span className="sr-only">
                    Row {idx + 1} of {listRows.length}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </VenueChromeShell>
  );
}

function ResultHighlightCard({ match }: { match: ResultsMatch }) {
  const winner = winnerLabel(match) ?? "Winner";
  const loser = loserLabel(match) ?? "—";
  const diff = formatPointDifference(winnerPointDifference(match));
  const sets = gameScoreLines(match);
  const outcome = outcomeLabel(match);
  const meta = resultMetaLine(match);

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="bw-label text-[#ffd700]/80 tracking-[0.28em] text-[10px] md:text-xs">
          {outcome.toUpperCase()}
          {meta ? ` · ${meta}` : ""}
        </p>
        <p className="bw-heading text-white text-3xl md:text-4xl leading-none truncate">
          {winner}
        </p>
        <p className="bw-caption text-white/55 text-sm md:text-base">
          defeated <span className="text-white/85">{loser}</span>
        </p>
        {sets.length > 0 ? (
          <p className="bw-meta text-white/45 text-xs md:text-sm tracking-wide">
            {sets.join("  ·  ")}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-4 md:gap-6 shrink-0">
        <div className="text-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 min-w-[5.5rem]">
          <p className="bw-label text-white/45 text-[10px] tracking-[0.2em]">GAMES</p>
          <p className="bw-display-l text-3xl md:text-4xl text-white tabular-nums leading-none mt-1">
            {gamesWonLine(match)}
          </p>
        </div>
        <div className="text-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 min-w-[5.5rem]">
          <p className="bw-label text-emerald-200/70 text-[10px] tracking-[0.2em]">DIFF</p>
          <p className="bw-display-l text-3xl md:text-4xl text-emerald-300 tabular-nums leading-none mt-1">
            {diff}
          </p>
        </div>
      </div>
    </div>
  );
}
