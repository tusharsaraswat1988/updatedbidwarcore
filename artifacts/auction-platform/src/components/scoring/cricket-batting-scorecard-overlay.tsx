/**
 * Centered batting scorecard for the OBS camera and the ground LED.
 * Figures come from the public match scorecard, in crease order.
 */

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { InningsScorecard } from "@workspace/scoring-core";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_ON,
  BIDWAR_BROADCAST_YELLOW_SOFT,
  BIDWAR_SCOREBOARD_INSET,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";
import {
  buildBattingBroadcastCard,
  selectBattingInnings,
  type BattingBroadcastCard,
} from "@/lib/cricket-broadcast-plates";
import {
  getPublicMatchScorecard,
  publicMatchScorecardQueryKey,
  type PublicScorecardResponse,
} from "@/lib/scoring-api";

const INK = "#F8FAFC";
const DIM = "rgba(248, 250, 252, 0.72)";
const MUTE = "rgba(248, 250, 252, 0.46)";
const LINE = "rgba(255, 255, 255, 0.10)";

type CardProps = {
  tournamentName: string;
  card: BattingBroadcastCard | null;
  inningsNote: string | null;
  message: string | null;
};

export function BattingScorecardCard({ tournamentName, card, inningsNote, message }: CardProps) {
  return (
    <section
      aria-label="Batting scorecard"
      className="flex w-full max-w-[1180px] flex-col overflow-hidden"
      style={{
        maxHeight: "100%",
        borderRadius: 16,
        background: BIDWAR_SCOREBOARD_SHELL,
        borderTop: `3px solid ${BIDWAR_BROADCAST_YELLOW}`,
        boxShadow: "0 22px 60px rgba(0, 0, 0, 0.55)",
        fontFamily: BROADCAST_FONTS.body,
        color: INK,
      }}
    >
      <header
        className="px-6 py-3 text-center text-[28px] font-semibold tracking-wide"
        style={{ background: BIDWAR_SCOREBOARD_PANEL, color: INK }}
      >
        Batting Scorecard
      </header>
      {card ? (
        <>
          <div
            className="relative flex items-center justify-center px-6 py-2.5"
            style={{ background: BIDWAR_SCOREBOARD_INSET, borderBottom: `1px solid ${LINE}`, color: INK }}
          >
            <span className="min-w-0 truncate px-28 text-center text-[26px] font-bold">{card.teamName}</span>
            {inningsNote ? (
              <span
                className="absolute right-6 text-[13px] font-bold uppercase tracking-[0.14em]"
                style={{ color: BIDWAR_BROADCAST_YELLOW }}
              >
                {inningsNote}
              </span>
            ) : null}
          </div>
          <div className="min-h-0 overflow-auto" style={{ background: BIDWAR_SCOREBOARD_SHELL }}>
            <table className="w-full border-collapse text-[16px]" style={{ color: INK }}>
              <thead>
                <tr style={{ background: BIDWAR_SCOREBOARD_PANEL, color: MUTE }}>
                  <th className="px-4 py-2 text-left font-semibold">Batter</th>
                  <th className="px-3 py-2 text-left font-semibold">Dismissal</th>
                  <th className="px-3 py-2 text-right font-semibold">Runs</th>
                  <th className="px-3 py-2 text-right font-semibold">4s</th>
                  <th className="px-3 py-2 text-right font-semibold">6s</th>
                  <th className="px-4 py-2 text-right font-semibold">SR</th>
                </tr>
              </thead>
              <tbody>
                {card.rows.map((row, index) => (
                  <tr
                    key={row.playerId}
                    style={{
                      background: row.notOut
                        ? BIDWAR_BROADCAST_YELLOW_SOFT
                        : index % 2 === 0
                          ? "transparent"
                          : BIDWAR_SCOREBOARD_INSET,
                      color: row.notOut ? BIDWAR_BROADCAST_YELLOW : INK,
                    }}
                  >
                    <td className="px-4 py-1.5 font-semibold">
                      {row.name}
                      {row.captain ? " (c)" : ""}
                    </td>
                    <td className={`px-3 py-1.5 ${row.notOut ? "font-bold tracking-wide" : ""}`} style={{ color: row.notOut ? BIDWAR_BROADCAST_YELLOW : DIM }}>
                      {row.dismissal}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-bold" style={{ color: BIDWAR_BROADCAST_YELLOW }}>
                      {row.runs}
                      <span className="ml-1 text-[12px] font-semibold" style={{ color: MUTE }}>({row.balls})</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: DIM }}>{row.fours}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: DIM }}>{row.sixes}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: DIM }}>{formatStrikeRate(row.strikeRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {card.yetToBat.length > 0 ? (
              <div className="px-4 py-2" style={{ background: BIDWAR_SCOREBOARD_SHELL, borderTop: `1px solid ${LINE}` }}>
                <p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTE }}>Yet To Bat</p>
                <p className="mt-0.5 text-[16px] font-semibold" style={{ color: INK }}>{card.yetToBat.join(", ")}</p>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-[minmax(140px,0.7fr)_1.4fr_1fr] text-[20px] font-bold" style={{ borderTop: `1px solid ${LINE}` }}>
            <div className="px-4 py-2.5" style={{ background: BIDWAR_SCOREBOARD_SHELL, color: DIM }}>Extras {card.extras}</div>
            <div className="px-4 py-2.5 text-center" style={{ background: BIDWAR_SCOREBOARD_PANEL, color: BIDWAR_BROADCAST_YELLOW }}>{card.overs} Overs</div>
            <div className="px-4 py-2.5 text-right" style={{ background: BIDWAR_BROADCAST_YELLOW, color: BIDWAR_BROADCAST_YELLOW_ON }}>
              Total {card.totalRuns}/{card.totalWickets}
            </div>
          </div>
        </>
      ) : (
        <p className="px-8 py-16 text-center text-[22px] font-semibold" style={{ color: DIM }}>{message}</p>
      )}
      <footer
        className="px-4 py-2 text-center text-[15px] font-semibold tracking-wide"
        style={{ background: BIDWAR_SCOREBOARD_SHELL, color: BIDWAR_BROADCAST_YELLOW, borderTop: `1px solid ${LINE}` }}
      >
        {tournamentName || "Cricket"}
      </footer>
    </section>
  );
}

export function CricketBattingScorecardOverlay({
  tournamentId,
  matchId,
  tournamentName,
  liveSequence = 0,
}: {
  tournamentId: number;
  matchId: number | null;
  tournamentName: string;
  liveSequence?: number;
}) {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError } = useQuery({
    queryKey: publicMatchScorecardQueryKey(tournamentId, matchId ?? 0, liveSequence),
    queryFn: () => getPublicMatchScorecard(tournamentId, matchId!),
    enabled: tournamentId > 0 && matchId != null && matchId > 0,
    refetchInterval: 4_000,
  });

  const inningsCount = data?.scorecard.innings.length ?? 0;
  const live = data?.match.status === "live";

  useEffect(() => {
    setPage(0);
  }, [matchId]);

  useEffect(() => {
    if (live || inningsCount < 2) return;
    const timer = window.setInterval(() => setPage((current) => current + 1), 12_000);
    return () => window.clearInterval(timer);
  }, [live, inningsCount, matchId]);

  const selected = data ? selectBattingInnings(data.scorecard.innings, data.match.status, page) : null;
  const card = selected && data ? cardFromScorecard(data, selected.innings) : null;
  const inningsNote = selected && data && data.scorecard.innings.length > 1
    ? live
      ? inningsTitle(selected.innings)
      : `${inningsTitle(selected.innings)} · ${((page % data.scorecard.innings.length) + data.scorecard.innings.length) % data.scorecard.innings.length + 1}/${data.scorecard.innings.length}`
    : selected
      ? inningsTitle(selected.innings)
      : null;

  const message = !matchId
    ? "Choose a live or finished match."
    : isLoading
      ? "Loading batting card…"
      : isError
        ? "Batting card could not be loaded."
        : "Batting card is not ready.";

  return (
    <BattingScorecardCard
      tournamentName={tournamentName}
      card={card}
      inningsNote={card ? inningsNote : null}
      message={card ? null : message}
    />
  );
}

function cardFromScorecard(
  data: PublicScorecardResponse,
  inningsNumber: number,
): BattingBroadcastCard | null {
  const innings = data.scorecard.innings.find((row: InningsScorecard) => row.innings === inningsNumber);
  if (!innings) return null;
  const meta = data.battingCards?.find((row) => row.innings === inningsNumber);
  const teamName = innings.battingTeamId === data.match.homeTeamId
    ? data.match.homeTeam?.name || "Batting"
    : innings.battingTeamId === data.match.awayTeamId
      ? data.match.awayTeam?.name || "Batting"
      : "Batting";
  return buildBattingBroadcastCard({
    innings,
    teamName,
    players: data.players,
    captainId: meta?.captainId,
    battingOrder: meta?.battingOrder,
  });
}

function inningsTitle(innings: number): string {
  if (innings === 1) return "1st Innings";
  if (innings === 2) return "2nd Innings";
  if (innings === 3) return "3rd Innings";
  return `${innings}th Innings`;
}

function formatStrikeRate(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  return value.toFixed(1);
}
