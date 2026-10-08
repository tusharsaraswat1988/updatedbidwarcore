/**
 * Cricket OBS Full-Screen Broadcast Slates (1920×1080)
 * Replaces modal dialogs with native television graphics slates:
 * 1. Sponsors Wall (3-Tier Hierarchical Inventory)
 * 2. Points Table (Television Standings Slate)
 * 3. Fixtures (Broadcast Match Schedule)
 * 4. Full Scorecard (Tabular Innings Breakdown)
 * 5. Match Summary (Result & Top Performers)
 * 6. Match Intro / VS (Cinematic Clash Slate)
 *
 * Absolutely NO "✕ HIDE" buttons. Zero web-card nesting. 100% Broadcast Typography.
 */

import { useMemo } from "react";
import { formatNetRunRate, formatPointsPercentage } from "@workspace/scoring-core/cricket";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { getScoringStandings, listScoringMatches, getCricketMasterTeams } from "@/lib/scoring-api";
import { listFixtures } from "@/lib/scoring-foundation-api";
import {
  competitionGroupTitle,
  competitionSelectionLabel,
  parseCompetitionSelection,
  resolveKnockoutStageSelection,
  rowsForCompetitionSelection,
} from "@workspace/scoring-core/cricket";
import { cricketMasterTeamToScorerTeam, type CricketScorerTeam } from "@/lib/scoring-squad";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
  BIDWAR_SCOREBOARD_INSET,
} from "@/lib/bidwar-broadcast-colors";
import {
  BROADCAST_OVERLAY_SAFE_INSET_X,
  BROADCAST_OVERLAY_SAFE_INSET_Y,
} from "@/lib/broadcast-overlay";
import type { CricketObsViewModel, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";

type Props = {
  vm: CricketObsViewModel;
  overlay: CricketObsMidOverlayKind;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  tournamentId: number;
};

export function CricketObsMidOverlays({
  vm,
  overlay,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  tournamentId,
}: Props) {
  // Master teams query for reliable logos and team names
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 60_000,
  });

  const effectiveTeams: CricketScorerTeam[] = useMemo(() => {
    return (masterTeams ?? []).map(cricketMasterTeamToScorerTeam);
  }, [masterTeams]);

  const teamMap = useMemo(() => new Map(effectiveTeams.map((t) => [t.id, t])), [effectiveTeams]);

  // Standings query
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Fixtures query
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: (overlay === "fixtures" || overlay === "intro" || overlay === "summary" || overlay === "scorecard" || overlay === "standings") && tournamentId > 0,
    staleTime: 30_000,
  });
  const { data: fixtures } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 30_000,
  });

  // Active target match resolution
  const activeMatch = useMemo(() => {
    if (overlayMatchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === overlayMatchId);
      if (found) return found;
    }
    return matches && matches.length > 0 ? matches[0] : null;
  }, [overlayMatchId, matches]);

  // Fixtures Match: Targeted single match (if selected in live control / director) or first upcoming match
  const activeFixtureMatch = useMemo(() => {
    if (overlayMatchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === overlayMatchId);
      if (found) return found;
    }
    const upcoming = (matches ?? []).filter((m) => m.status === "upcoming" || m.status === "scheduled" || m.status !== "completed");
    return upcoming[0] ?? (matches && matches.length > 0 ? matches[0] : null);
  }, [overlayMatchId, matches]);

  const fixtureHomeTeam = useMemo(() => {
    if (!activeFixtureMatch) return null;
    return teamMap.get(activeFixtureMatch.homeTeamId) || (activeFixtureMatch as any).homeTeam || null;
  }, [activeFixtureMatch, teamMap]);

  const fixtureAwayTeam = useMemo(() => {
    if (!activeFixtureMatch) return null;
    return teamMap.get(activeFixtureMatch.awayTeamId) || (activeFixtureMatch as any).awayTeam || null;
  }, [activeFixtureMatch, teamMap]);

  const targetHomeTeam = teamMap.get(activeMatch?.homeTeamId ?? 0) || activeMatch?.homeTeam || vm.home;
  const targetAwayTeam = teamMap.get(activeMatch?.awayTeamId ?? 0) || activeMatch?.awayTeam || vm.away;

  // Sponsor resolution
  const targetedSponsor = useMemo(() => {
    if (!overlaySponsorName || overlaySponsorName === "all" || !vm.sponsors) return null;
    return vm.sponsors.find((s) => s.name?.toLowerCase().trim() === overlaySponsorName.toLowerCase().trim()) ?? null;
  }, [overlaySponsorName, vm.sponsors]);

  // Group / Stage resolution
  const resolvedStandings = useMemo(() => {
    return rowsForCompetitionSelection(
      standings?.groups ?? [],
      standings ?? [],
      parseCompetitionSelection(overlayStageOrGroup),
    );
  }, [overlayStageOrGroup, standings]);
  const matchedGroup = resolvedStandings.group;
  const effectiveStandingsRows = resolvedStandings.rows;
  const standingsQualifiers = resolvedStandings.qualifiers;
  const stageSelection = useMemo(
    () => parseCompetitionSelection(overlayStageOrGroup),
    [overlayStageOrGroup],
  );
  const knockoutStage = useMemo(
    () => resolveKnockoutStageSelection(fixtures ?? [], matches ?? [], stageSelection),
    [fixtures, matches, stageSelection],
  );
  const stageLabel = competitionSelectionLabel(overlayStageOrGroup);
  const isKnockoutStage =
    !matchedGroup &&
    (stageSelection.kind === "round" ||
      knockoutStage.ambiguous ||
      knockoutStage.fixtures.length > 0 ||
      knockoutStage.matches.length > 0);

  if (overlay === "none" || overlay === "neutral" || overlay === "banner") return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex h-full w-full flex-col overflow-hidden"
          style={{
            background: "rgba(5, 5, 8, 0.92)",
            fontFamily: BROADCAST_FONTS.body,
          }}
        >
          {/* Masthead Header Band (60px) */}
          <div
            className="flex h-[60px] items-center justify-between border-b border-white/10"
            style={{
              background: BIDWAR_SCOREBOARD_SHELL,
              paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
              paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
            }}
          >
            <div className="flex items-center gap-4">
              <span
                className="text-2xl font-normal uppercase tracking-wider text-[#FFD700]"
                style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.08em" }}
              >
                BIDWAR BROADCAST
              </span>
              <span className="text-white/30">/</span>
              <span
                className="text-xl font-normal uppercase tracking-wide text-white"
                style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
              >
                {vm.tournamentName || "CRICKET TOURNAMENT"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#FFD700]" />
              <span
                className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]"
                style={{ fontFamily: BROADCAST_FONTS.body }}
              >
                {overlay.toUpperCase()} SLATE
              </span>
            </div>
          </div>

          {/* MAIN SLATE VIEWPORT */}
          <div
            className="flex-1 flex flex-col justify-center overflow-y-auto"
            style={{
              paddingTop: `${BROADCAST_OVERLAY_SAFE_INSET_Y}px`,
              paddingBottom: `${BROADCAST_OVERLAY_SAFE_INSET_Y}px`,
              paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
              paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
            }}
          >
            {/* 1. SPONSORS SHOWCASE */}
            {overlay === "sponsors" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full">
                <div className="text-center pt-6 mb-6">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.body }}
                  >
                    {targetedSponsor ? "OFFICIAL PARTNER" : "OFFICIAL TOURNAMENT PARTNERS"}
                  </span>
                  <h2
                    className="text-5xl font-normal tracking-wide text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
                  >
                    {targetedSponsor ? targetedSponsor.name : "OUR VALUED SPONSORS"}
                  </h2>
                </div>

                {targetedSponsor ? (
                  (() => {
                    const priorityType = (targetedSponsor.priorityType || "").toLowerCase();
                    const customType = targetedSponsor.type?.trim() || "";
                    const isTitle =
                      Boolean(targetedSponsor.isTitleSponsor) ||
                      priorityType.includes("title") ||
                      priorityType.includes("gold") ||
                      /title\s*sponsor|title\s*partner/i.test(customType);
                    const isCo =
                      Boolean(targetedSponsor.isCoSponsor) ||
                      priorityType.includes("co") ||
                      priorityType.includes("silver") ||
                      /co[\s-]*sponsor|co[\s-]*partner|powered\s*by/i.test(customType);
                    const tierLabel = (
                      (customType && !["normal", "standard"].includes(customType.toLowerCase()) ? customType : null) ||
                      (isTitle ? "TITLE SPONSOR" : null) ||
                      (isCo ? "CO-SPONSOR" : null) ||
                      "OFFICIAL PARTNER"
                    ).toUpperCase();

                    return (
                      <div className="my-auto max-w-xl mx-auto w-full">
                        <div
                          className="flex flex-col items-center justify-center p-10 rounded-2xl transition-all duration-300"
                          style={{
                            background: isTitle
                              ? "linear-gradient(180deg, rgba(28, 22, 10, 0.98) 0%, rgba(10, 12, 18, 0.99) 100%)"
                              : isCo
                              ? "linear-gradient(180deg, rgba(10, 20, 32, 0.98) 0%, rgba(8, 10, 16, 0.99) 100%)"
                              : BIDWAR_SCOREBOARD_PANEL,
                            border: isTitle
                              ? "2px solid rgba(255, 215, 0, 0.75)"
                              : isCo
                              ? "1.5px solid rgba(18, 207, 255, 0.6)"
                              : "1px solid rgba(255, 255, 255, 0.12)",
                            boxShadow: isTitle
                              ? "0 0 38px rgba(255, 215, 0, 0.45), 0 0 75px rgba(255, 215, 0, 0.20), 0 18px 45px rgba(0, 0, 0, 0.95)"
                              : isCo
                              ? "0 0 22px rgba(18, 207, 255, 0.32), 0 18px 45px rgba(0, 0, 0, 0.92)"
                              : "0 18px 45px rgba(0, 0, 0, 0.92)",
                          }}
                        >
                          {/* 1. Sponsor Logo */}
                          {targetedSponsor.url ? (
                            <div className="h-44 w-full flex items-center justify-center p-3 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm shadow-inner">
                              <img
                                src={targetedSponsor.url}
                                alt={targetedSponsor.name || ""}
                                className="max-h-full max-w-[340px] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
                              />
                            </div>
                          ) : null}

                          {/* 2. Sponsor Name (Below Logo) */}
                          <p className="mt-6 text-3xl font-black italic text-white tracking-wider uppercase font-sans text-center">
                            {targetedSponsor.name || "OFFICIAL SPONSOR"}
                          </p>

                          {/* 3. Sponsor Type (Below Name) */}
                          <div className="mt-3">
                            {isTitle ? (
                              <span className="inline-flex items-center px-5 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-[0.2em] bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-[#FFD700] border border-[#FFD700]/60 shadow-[0_0_15px_rgba(255,215,0,0.35)]">
                                ★ {tierLabel} ★
                              </span>
                            ) : isCo ? (
                              <span className="inline-flex items-center px-5 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-[0.2em] bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(18,207,255,0.25)]">
                                ◆ {tierLabel} ◆
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-[0.16em] bg-white/10 text-slate-300 border border-white/15">
                                {tierLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : vm.sponsors && vm.sponsors.length > 0 ? (
                  <div className="grid grid-cols-3 gap-6 my-auto max-w-5xl mx-auto w-full">
                    {vm.sponsors.map((sp, idx) => {
                      const priorityType = (sp.priorityType || "").toLowerCase();
                      const customType = sp.type?.trim() || "";
                      const isTitle =
                        Boolean(sp.isTitleSponsor) ||
                        priorityType.includes("title") ||
                        priorityType.includes("gold") ||
                        /title\s*sponsor|title\s*partner/i.test(customType);
                      const isCo =
                        Boolean(sp.isCoSponsor) ||
                        priorityType.includes("co") ||
                        priorityType.includes("silver") ||
                        /co[\s-]*sponsor|co[\s-]*partner|powered\s*by/i.test(customType);
                      const tierLabel = (
                        (customType && !["normal", "standard"].includes(customType.toLowerCase()) ? customType : null) ||
                        (isTitle ? "TITLE SPONSOR" : null) ||
                        (isCo ? "CO-SPONSOR" : null) ||
                        "OFFICIAL PARTNER"
                      ).toUpperCase();

                      return (
                        <div
                          key={idx}
                          className="flex flex-col items-center justify-center p-6 rounded-xl transition-all duration-300"
                          style={{
                            background: isTitle
                              ? "linear-gradient(180deg, rgba(28, 22, 10, 0.98) 0%, rgba(10, 12, 18, 0.99) 100%)"
                              : isCo
                              ? "linear-gradient(180deg, rgba(10, 20, 32, 0.98) 0%, rgba(8, 10, 16, 0.99) 100%)"
                              : BIDWAR_SCOREBOARD_PANEL,
                            border: isTitle
                              ? "2px solid rgba(255, 215, 0, 0.7)"
                              : isCo
                              ? "1.5px solid rgba(18, 207, 255, 0.55)"
                              : "1px solid rgba(255, 255, 255, 0.10)",
                            boxShadow: isTitle
                              ? "0 0 25px rgba(255, 215, 0, 0.35), 0 10px 30px rgba(0, 0, 0, 0.9)"
                              : isCo
                              ? "0 0 16px rgba(18, 207, 255, 0.25), 0 10px 30px rgba(0, 0, 0, 0.9)"
                              : "0 10px 25px rgba(0, 0, 0, 0.8)",
                          }}
                        >
                          {/* 1. Sponsor Logo */}
                          {sp.url ? (
                            <div className="h-20 w-full flex items-center justify-center p-2 rounded-lg bg-white/[0.03] border border-white/5">
                              <img
                                src={sp.url}
                                alt={sp.name || ""}
                                className="max-h-full max-w-[220px] object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]"
                              />
                            </div>
                          ) : null}

                          {/* 2. Sponsor Name (Below Logo) */}
                          <p
                            title={sp.name || "Sponsor"}
                            className="mt-3 text-sm sm:text-base font-black italic text-white tracking-wide uppercase font-sans text-center break-words line-clamp-2 leading-tight max-w-full"
                          >
                            {sp.name || "Sponsor"}
                          </p>

                          {/* 3. Sponsor Type (Below Name) */}
                          <div className="mt-1.5">
                            {isTitle ? (
                              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-[#FFD700] border border-[#FFD700]/60 shadow-[0_0_10px_rgba(255,215,0,0.3)]">
                                ★ {tierLabel} ★
                              </span>
                            ) : isCo ? (
                              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_8px_rgba(18,207,255,0.2)]">
                                ◆ {tierLabel} ◆
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-white/10 text-slate-300 border border-white/15">
                                {tierLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center justify-center text-center p-12 border border-white/10">
                    <p
                      className="text-3xl font-normal text-[#FFD700] uppercase"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      BIDWAR BROADCAST GRAPHICS
                    </p>
                    <p className="text-sm font-semibold text-white/50 mt-1 uppercase tracking-wider">
                      Official Tournament Live Stream Inventory
                    </p>
                  </div>
                )}

                <div className="text-center border-t border-white/10 pt-4">
                  <p className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">
                    ALL RIGHTS RESERVED · BIDWAR SPORTS ENGINE
                  </p>
                </div>
              </div>
            )}

            {/* 2. POINTS TABLE / STANDINGS */}
            {overlay === "standings" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.body }}
                  >
                    {matchedGroup
                      ? `${competitionGroupTitle(matchedGroup).toUpperCase()} STANDINGS`
                      : isKnockoutStage
                        ? `STAGE — ${stageLabel.toUpperCase()}`
                        : "STANDINGS & RANKINGS"}
                  </span>
                  <h2
                    className="text-5xl font-normal tracking-wide text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
                  >
                    {matchedGroup
                      ? `${competitionGroupTitle(matchedGroup).toUpperCase()} POINTS TABLE`
                      : isKnockoutStage
                        ? stageLabel.toUpperCase()
                        : "POINTS TABLE"}
                  </h2>
                </div>

                {isKnockoutStage ? (
                  <div
                    className="flex-1 overflow-x-auto border border-white/10"
                    style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                  >
                    {knockoutStage.ambiguous || (knockoutStage.fixtures.length === 0 && knockoutStage.matches.length === 0) ? (
                      <p className="py-12 text-center text-white/50">
                        {knockoutStage.ambiguous
                          ? "This stage is in more than one competition."
                          : "No fixtures in this stage."}
                      </p>
                    ) : (
                      <ul className="divide-y divide-white/10">
                        {(knockoutStage.fixtures.length > 0 ? knockoutStage.fixtures : knockoutStage.matches).map((item, idx) => {
                          const homeId = "homeTeamId" in item ? item.homeTeamId : 0;
                          const awayId = "awayTeamId" in item ? item.awayTeamId : 0;
                          const home = teamMap.get(homeId);
                          const away = teamMap.get(awayId);
                          return (
                            <li key={item.id} className="flex items-center justify-between gap-6 px-8 py-5">
                              <span className="text-[#FFD700] text-2xl" style={{ fontFamily: BROADCAST_FONTS.display }}>{idx + 1}</span>
                              <span className="flex-1 text-center text-white text-3xl uppercase" style={{ fontFamily: BROADCAST_FONTS.display }}>
                                {home?.name || "Home"} <span className="text-[#FFD700]">vs</span> {away?.name || "Away"}
                              </span>
                              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                                {item.roundName || stageLabel}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                <div
                  className="flex-1 overflow-x-auto border border-white/10"
                  style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                >
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr
                        className="border-b border-white/15 text-xs font-bold tracking-widest text-white/60 uppercase"
                        style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                      >
                        <th className="py-3.5 px-6 text-center">POS</th>
                        <th className="py-3.5 px-6">TEAM</th>
                        <th className="py-3.5 px-5 text-center">P</th>
                        <th className="py-3.5 px-5 text-center text-[#06B6D4]">W</th>
                        <th className="py-3.5 px-5 text-center text-[#E11D48]">L</th>
                        <th className="py-3.5 px-5 text-center text-[#FFD700]">PTS %</th>
                        <th className="py-3.5 px-5 text-center text-white/80">NRR</th>
                        <th className="py-3.5 px-8 text-right text-[#FFD700]">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-base font-bold">
                      {effectiveStandingsRows && effectiveStandingsRows.length > 0 ? (
                        effectiveStandingsRows.map((row, idx) => (
                          <tr
                            key={`${row.drawId ?? "legacy"}-${row.teamId}`}
                            className={standingsQualifiers > 0 && idx < standingsQualifiers ? "bg-white/[0.02]" : ""}
                          >
                            <td className="py-3.5 px-6 text-center font-bold">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center text-xs font-bold ${
                                  standingsQualifiers > 0 && idx < standingsQualifiers ? "bg-[#FFD700] text-black" : "bg-white/10 text-white"
                                }`}
                                style={{ fontFamily: BROADCAST_FONTS.mono }}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                {row.teamLogoUrl ? (
                                  <img
                                    src={row.teamLogoUrl}
                                    alt=""
                                    className="h-7 w-7 object-contain"
                                  />
                                ) : null}
                                <span className="font-bold text-white text-lg uppercase">
                                  {row.teamName}
                                </span>
                                <span className="text-xs text-white/40 font-bold uppercase font-mono">
                                  ({row.shortCode})
                                </span>
                              </div>
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-white/80"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {row.played}
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-[#06B6D4]"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {row.won}
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-[#E11D48]"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {row.lost}
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-[#FFD700]"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {formatPointsPercentage(row.pointsPercentage)}
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-white/80 font-mono"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {formatNetRunRate(row.netRunRate)}
                            </td>
                            <td
                              className="py-3.5 px-8 text-right font-normal text-3xl tabular-nums text-[#FFD700]"
                              style={{ fontFamily: BROADCAST_FONTS.display }}
                            >
                              {row.points}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-white/50">
                            No standings data currently calculated.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            )}

            {/* 3. UPCOMING MATCH / FIXTURES (Broadcast Single Match Showcase) */}
            {overlay === "fixtures" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full py-4">
                {/* Header Subtitle & Title */}
                <div className="text-center mb-4">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.body }}
                  >
                    {activeFixtureMatch?.roundName
                      ? `UPCOMING MATCH · ${activeFixtureMatch.roundName.toUpperCase()}`
                      : "UPCOMING MATCH"}
                  </span>
                  <h2
                    className="text-5xl font-normal tracking-wide text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
                  >
                    {activeFixtureMatch
                      ? `MATCH #${activeFixtureMatch.tournamentMatchNumber || activeFixtureMatch.id}`
                      : "UPCOMING FIXTURES"}
                  </h2>
                </div>

                {activeFixtureMatch ? (
                  <div className="my-auto flex flex-col items-center justify-center w-full">
                    <div
                      className="w-full grid grid-cols-11 items-center gap-6 p-8 border border-white/10 shadow-2xl"
                      style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                    >
                      {/* HOME TEAM (Left - Col Span 4) */}
                      <div className="col-span-4 flex flex-col items-center text-center space-y-3">
                        <div className="h-36 w-36 rounded-2xl border-2 border-[#FFD700]/70 bg-black/60 p-3 flex items-center justify-center shadow-lg overflow-hidden">
                          {fixtureHomeTeam?.logoUrl ? (
                            <img
                              src={fixtureHomeTeam.logoUrl}
                              alt=""
                              className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
                            />
                          ) : (
                            <span
                              className="text-4xl font-normal text-[#FFD700] uppercase"
                              style={{ fontFamily: BROADCAST_FONTS.display }}
                            >
                              {fixtureHomeTeam?.shortCode || "HOME"}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 max-w-xs">
                          <h3
                            className="text-3xl font-normal text-white uppercase truncate"
                            style={{ fontFamily: BROADCAST_FONTS.display }}
                          >
                            {fixtureHomeTeam?.name || "HOME TEAM"}
                          </h3>
                          {fixtureHomeTeam?.shortCode && (
                            <span
                              className="inline-block px-3 py-0.5 text-xs font-mono font-bold uppercase tracking-wider text-[#FFD700] border border-[#FFD700]/40 bg-[#FFD700]/10"
                            >
                              {fixtureHomeTeam.shortCode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* VS CENTERPIECE (Center - Col Span 3) */}
                      <div className="col-span-3 flex flex-col items-center justify-center text-center space-y-3">
                        <span
                          className="text-7xl font-normal italic text-[#FFD700] drop-shadow-[0_0_25px_rgba(255,215,0,0.5)]"
                          style={{ fontFamily: BROADCAST_FONTS.display }}
                        >
                          VS
                        </span>

                        <div className="border border-white/20 px-3.5 py-1 bg-black/50 text-xs font-mono font-bold text-white uppercase tracking-wider">
                          MATCH #{activeFixtureMatch.tournamentMatchNumber || activeFixtureMatch.id}
                        </div>

                        {activeFixtureMatch.rules?.overs ? (
                          <span className="text-[11px] font-mono font-bold uppercase text-white/60 tracking-wider">
                            {activeFixtureMatch.rules.overs} OVERS MATCH
                          </span>
                        ) : null}
                      </div>

                      {/* AWAY TEAM (Right - Col Span 4) */}
                      <div className="col-span-4 flex flex-col items-center text-center space-y-3">
                        <div className="h-36 w-36 rounded-2xl border-2 border-cyan-400/70 bg-black/60 p-3 flex items-center justify-center shadow-lg overflow-hidden">
                          {fixtureAwayTeam?.logoUrl ? (
                            <img
                              src={fixtureAwayTeam.logoUrl}
                              alt=""
                              className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
                            />
                          ) : (
                            <span
                              className="text-4xl font-normal text-cyan-400 uppercase"
                              style={{ fontFamily: BROADCAST_FONTS.display }}
                            >
                              {fixtureAwayTeam?.shortCode || "AWAY"}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 max-w-xs">
                          <h3
                            className="text-3xl font-normal text-white uppercase truncate"
                            style={{ fontFamily: BROADCAST_FONTS.display }}
                          >
                            {fixtureAwayTeam?.name || "AWAY TEAM"}
                          </h3>
                          {fixtureAwayTeam?.shortCode && (
                            <span
                              className="inline-block px-3 py-0.5 text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 border border-cyan-400/40 bg-cyan-500/10"
                            >
                              {fixtureAwayTeam.shortCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Schedule & Venue Strip */}
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-mono text-white/90">
                      <div className="border border-white/15 px-4 py-1.5 bg-black/40">
                        <span className="text-[#FFD700] mr-1.5 font-bold">📍 VENUE:</span>
                        <span className="uppercase">{activeFixtureMatch.venue || "MAIN GROUND"}</span>
                      </div>

                      <div className="border border-white/15 px-4 py-1.5 bg-black/40">
                        <span className="text-[#FFD700] mr-1.5 font-bold">🕒 TIME:</span>
                        <span className="uppercase">
                          {activeFixtureMatch.scheduledAt
                            ? new Date(activeFixtureMatch.scheduledAt).toLocaleString([], {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "SCHEDULED"}
                        </span>
                      </div>

                      {activeFixtureMatch.roundName && (
                        <div className="border border-[#FFD700]/30 px-4 py-1.5 bg-[#FFD700]/10 text-[#FFD700] font-bold">
                          STAGE: {activeFixtureMatch.roundName.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="my-auto text-center py-16 text-white/50 text-xl">
                    No upcoming match scheduled.
                  </div>
                )}

                <div className="text-center border-t border-white/10 pt-3">
                  <p className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">
                    ALL RIGHTS RESERVED · BIDWAR SPORTS ENGINE
                  </p>
                </div>
              </div>
            )}

            {/* 4. FULL INNINGS SCORECARD */}
            {overlay === "scorecard" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center border border-white/20"
                      style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                    >
                      <span
                        className="text-2xl font-normal text-[#FFD700]"
                        style={{ fontFamily: BROADCAST_FONTS.display }}
                      >
                        {vm.batting?.shortCode || "BAT"}
                      </span>
                    </div>
                    <div>
                      <h2
                        className="text-4xl font-normal tracking-wide text-white uppercase leading-none"
                        style={{ fontFamily: BROADCAST_FONTS.display }}
                      >
                        {vm.batting?.name || "INNINGS SCORECARD"}
                      </h2>
                      <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest mt-0.5">
                        {vm.tournamentName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-baseline gap-2">
                    <span
                      className="text-5xl font-normal tabular-nums text-white"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      {vm.runs}-{vm.wickets}
                    </span>
                    <span
                      className="text-base font-bold text-[#FFD700]"
                      style={{ fontFamily: BROADCAST_FONTS.mono }}
                    >
                      ({vm.oversLabel} OV)
                    </span>
                  </div>
                </div>

                {/* Bowler Figures Table */}
                <div
                  className="flex-1 overflow-x-auto border border-white/10"
                  style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                >
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr
                        className="border-b border-white/20 text-xs font-bold tracking-widest text-white/70 uppercase"
                        style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                      >
                        <th className="py-3 px-6">BOWLER</th>
                        <th className="py-3 px-4 text-center">OVERS</th>
                        <th className="py-3 px-4 text-center">MAIDENS</th>
                        <th className="py-3 px-4 text-center">RUNS</th>
                        <th className="py-3 px-4 text-center text-[#FFD700]">WICKETS</th>
                        <th className="py-3 px-6 text-right">ECON</th>
                      </tr>
                    </thead>
                    <tbody
                      className="divide-y divide-white/10 text-sm font-bold"
                      style={{ fontFamily: BROADCAST_FONTS.mono }}
                    >
                      {vm.bowler ? (
                        <tr>
                          <td
                            className="py-3.5 px-6 font-bold text-white text-base"
                            style={{ fontFamily: BROADCAST_FONTS.body }}
                          >
                            {vm.bowler.name} *
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums text-white/80">
                            {vm.bowler.overs}
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums text-white/80">
                            {vm.bowler.maidens}
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums text-white/80">
                            {vm.bowler.runsConceded}
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums font-bold text-lg text-[#FFD700]">
                            {vm.bowler.wickets}
                          </td>
                          <td className="py-3.5 px-6 text-right tabular-nums font-bold text-[#06B6D4]">
                            {vm.bowler.economy.toFixed(2)}
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-white/50">
                            Waiting for bowling figures…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Bar: Extras, Overs, Total */}
                <div
                  className="mt-4 flex items-center justify-between border border-white/15 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white"
                  style={{ background: BIDWAR_SCOREBOARD_INSET }}
                >
                  <div>
                    <span className="text-white/60">CRR: </span>
                    <span className="text-[#FFD700] font-mono">{vm.crr || "0.00"}</span>
                  </div>
                  <div>
                    <span className="text-white/60">OVERS: </span>
                    <span className="text-white font-mono">{vm.oversLabel}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-white/60">TOTAL: </span>
                    <span
                      className="text-[#FFD700] text-2xl font-normal"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      {vm.runs}-{vm.wickets}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. MATCH SUMMARY */}
            {overlay === "summary" && (() => {
              const winnerTeamId = (activeMatch as any)?.winnerTeamId ?? vm.winner?.id ?? null;
              const rawResult =
                (activeMatch as any)?.resultSummary ||
                vm.resultHeadline ||
                vm.resultText ||
                "MATCH IN PROGRESS";

              const isHomeWinner = Boolean(
                (winnerTeamId != null && targetHomeTeam?.id === winnerTeamId) ||
                (targetHomeTeam?.name && rawResult.toLowerCase().includes(targetHomeTeam.name.toLowerCase()))
              );
              const isAwayWinner = Boolean(
                (winnerTeamId != null && targetAwayTeam?.id === winnerTeamId) ||
                (targetAwayTeam?.name && rawResult.toLowerCase().includes(targetAwayTeam.name.toLowerCase()))
              );
              const winnerTeam = isHomeWinner ? targetHomeTeam : isAwayWinner ? targetAwayTeam : null;

              let formattedResult = rawResult;
              if (winnerTeam && rawResult.toLowerCase().startsWith("won by")) {
                formattedResult = `${winnerTeam.name.toUpperCase()} ${rawResult.toUpperCase()}`;
              }

              const groupOrRoundText =
                (activeMatch as any)?.groupName ||
                stageLabel ||
                activeMatch?.roundName ||
                "";

              const getInitials = (name?: string | null) => {
                if (!name) return "P";
                const parts = name.trim().split(/\s+/);
                if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                return name.slice(0, 2).toUpperCase();
              };

              return (
                <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full">
                  <div className="text-center mb-4">
                    <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                      <span
                        className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                        style={{ fontFamily: BROADCAST_FONTS.body }}
                      >
                        {activeMatch ? `MATCH #${activeMatch.id}${groupOrRoundText ? ` · ${groupOrRoundText.toUpperCase()}` : ""}` : "OFFICIAL MATCH RESULT"}
                      </span>
                      {activeMatch?.status && (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          activeMatch.status === "live"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : activeMatch.status === "walkover"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : activeMatch.status === "completed"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                        }`}>
                          {activeMatch.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h2
                      className="text-5xl font-normal tracking-wide text-white uppercase mt-1 leading-none"
                      style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
                    >
                      MATCH RESULT &amp; HIGHLIGHTS
                    </h2>
                  </div>

                  {/* 2 Inning Cards */}
                  <div className="grid grid-cols-2 gap-6 my-auto">
                    {/* Home Team */}
                    <div
                      className="p-6 relative overflow-hidden transition-all"
                      style={{
                        background: isHomeWinner
                          ? "linear-gradient(180deg, rgba(255, 215, 0, 0.14) 0%, rgba(14, 16, 24, 0.95) 100%)"
                          : BIDWAR_SCOREBOARD_PANEL,
                        border: isHomeWinner ? "2px solid #FFD700" : "1px solid rgba(255, 255, 255, 0.15)",
                        boxShadow: isHomeWinner ? "0 0 25px rgba(255, 215, 0, 0.3)" : "none",
                      }}
                    >
                      {isHomeWinner && (
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-400 text-black text-[11px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider shadow z-10 animate-pulse">
                          👑 WINNER
                        </div>
                      )}
                      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0">
                            {targetHomeTeam?.logoUrl ? (
                              <img src={targetHomeTeam.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                            ) : (
                              <span className="text-sm font-black text-[#FFD700]">{targetHomeTeam?.shortCode || "H"}</span>
                            )}
                          </div>
                          <span
                            className="text-2xl font-normal text-white uppercase truncate"
                            style={{ fontFamily: BROADCAST_FONTS.display }}
                          >
                            {targetHomeTeam?.name || "TEAM 1"}
                          </span>
                        </div>
                        <span
                          className="text-4xl font-normal text-[#FFD700] shrink-0"
                          style={{ fontFamily: BROADCAST_FONTS.display }}
                        >
                          {vm.phase === "completed" || vm.phase === "chase" ? `${vm.runs}-${vm.wickets}` : "—"}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 font-bold uppercase mb-2">TOP BATTERS</p>
                      <div className="space-y-2 text-xs">
                        {vm.striker && (
                          <div className="flex items-center justify-between font-bold gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-white/10 border border-amber-400/40 overflow-hidden shrink-0 flex items-center justify-center">
                                {vm.striker.photoUrl ? (
                                  <img src={vm.striker.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] font-black text-[#FFD700]">{getInitials(vm.striker.name)}</span>
                                )}
                              </div>
                              <span className="text-white truncate">{vm.striker.name}</span>
                            </div>
                            <span className="text-[#FFD700] font-mono shrink-0">{vm.striker.runs || 0} ({vm.striker.balls || 0}b)</span>
                          </div>
                        )}
                        {vm.nonStriker && (
                          <div className="flex items-center justify-between font-bold gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-white/10 border border-white/20 overflow-hidden shrink-0 flex items-center justify-center">
                                {vm.nonStriker.photoUrl ? (
                                  <img src={vm.nonStriker.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] font-black text-white/80">{getInitials(vm.nonStriker.name)}</span>
                                )}
                              </div>
                              <span className="text-white truncate">{vm.nonStriker.name}</span>
                            </div>
                            <span className="text-white/70 font-mono shrink-0">{vm.nonStriker.runs || 0} ({vm.nonStriker.balls || 0}b)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Away Team */}
                    <div
                      className="p-6 relative overflow-hidden transition-all"
                      style={{
                        background: isAwayWinner
                          ? "linear-gradient(180deg, rgba(255, 215, 0, 0.14) 0%, rgba(14, 16, 24, 0.95) 100%)"
                          : BIDWAR_SCOREBOARD_PANEL,
                        border: isAwayWinner ? "2px solid #FFD700" : "1px solid rgba(255, 255, 255, 0.15)",
                        boxShadow: isAwayWinner ? "0 0 25px rgba(255, 215, 0, 0.3)" : "none",
                      }}
                    >
                      {isAwayWinner && (
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-400 text-black text-[11px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider shadow z-10 animate-pulse">
                          👑 WINNER
                        </div>
                      )}
                      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0">
                            {targetAwayTeam?.logoUrl ? (
                              <img src={targetAwayTeam.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                            ) : (
                              <span className="text-sm font-black text-cyan-400">{targetAwayTeam?.shortCode || "A"}</span>
                            )}
                          </div>
                          <span
                            className="text-2xl font-normal text-white uppercase truncate"
                            style={{ fontFamily: BROADCAST_FONTS.display }}
                          >
                            {targetAwayTeam?.name || "TEAM 2"}
                          </span>
                        </div>
                        <span
                          className="text-4xl font-normal text-cyan-400 shrink-0"
                          style={{ fontFamily: BROADCAST_FONTS.display }}
                        >
                          {vm.target != null ? `${vm.target - 1}` : "—"}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 font-bold uppercase mb-2">TOP BOWLERS</p>
                      <div className="space-y-2 text-xs">
                        {vm.bowler && (
                          <div className="flex items-center justify-between font-bold gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-white/10 border border-cyan-400/40 overflow-hidden shrink-0 flex items-center justify-center">
                                {vm.bowler.photoUrl ? (
                                  <img src={vm.bowler.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] font-black text-cyan-300">{getInitials(vm.bowler.name)}</span>
                                )}
                              </div>
                              <span className="text-white truncate">{vm.bowler.name}</span>
                            </div>
                            <span className="text-[#06B6D4] font-mono shrink-0">{vm.bowler ? `${vm.bowler.wickets}-${vm.bowler.runsConceded}` : "—"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Victory Headline Banner */}
                  <div
                    className="border border-[#FFD700] p-4 text-center rounded-xl shadow-[0_0_25px_rgba(255,215,0,0.25)]"
                    style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                  >
                    <p
                      className="text-3xl font-normal uppercase tracking-widest text-[#FFD700] leading-none"
                      style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.08em" }}
                    >
                      🏆 {formattedResult}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* 6. MATCH INTRO / VS (Clean Frameless Broadcast Presentation) */}
            {overlay === "intro" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full py-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span
                      className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                      style={{ fontFamily: BROADCAST_FONTS.body }}
                    >
                      {activeMatch ? `MATCH #${activeMatch.id}${activeMatch.roundName ? ` · ${activeMatch.roundName.toUpperCase()}` : ""}` : "MATCH PRESENTATION"}
                    </span>
                    {activeMatch?.status && (
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        activeMatch.status === "live"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : activeMatch.status === "walkover"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : activeMatch.status === "completed"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      }`}>
                        {activeMatch.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h2
                    className="text-5xl font-normal tracking-wider text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.06em" }}
                  >
                    {targetHomeTeam?.name || "TEAM 1"} <span className="text-[#FFD700] italic">VS</span> {targetAwayTeam?.name || "TEAM 2"}
                  </h2>
                </div>

                {/* Team Badges and VS — CLEAN & FRAMELESS */}
                <div className="flex items-center justify-center gap-20 my-auto">
                  {/* Home Team */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-40 w-40 items-center justify-center">
                      {targetHomeTeam?.logoUrl ? (
                        <img
                          src={targetHomeTeam.logoUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain filter drop-shadow-[0_12px_35px_rgba(255,215,0,0.35)]"
                        />
                      ) : (
                        <span
                          className="text-7xl font-normal text-[#FFD700] drop-shadow-[0_8px_25px_rgba(255,215,0,0.5)]"
                          style={{ fontFamily: BROADCAST_FONTS.display }}
                        >
                          {targetHomeTeam?.shortCode || "H"}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-2xl font-normal text-white uppercase text-center max-w-[220px]"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      {targetHomeTeam?.name}
                    </span>
                  </div>

                  <span
                    className="text-8xl font-normal italic text-[#FFD700] drop-shadow-[0_10px_30px_rgba(255,215,0,0.4)]"
                    style={{ fontFamily: BROADCAST_FONTS.display }}
                  >
                    VS
                  </span>

                  {/* Away Team */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-40 w-40 items-center justify-center">
                      {targetAwayTeam?.logoUrl ? (
                        <img
                          src={targetAwayTeam.logoUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain filter drop-shadow-[0_12px_35px_rgba(6,182,212,0.35)]"
                        />
                      ) : (
                        <span
                          className="text-7xl font-normal text-[#06B6D4] drop-shadow-[0_8px_25px_rgba(6,182,212,0.5)]"
                          style={{ fontFamily: BROADCAST_FONTS.display }}
                        >
                          {targetAwayTeam?.shortCode || "A"}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-2xl font-normal text-white uppercase text-center max-w-[220px]"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      {targetAwayTeam?.name}
                    </span>
                  </div>
                </div>

                {/* Match Venue / Toss Strip */}
                <div
                  className="border border-white/10 py-3 px-6 text-center"
                  style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-[#06B6D4]">
                    LIVE FROM {activeMatch?.venue || vm.venueText || "MAIN VENUE"}
                  </p>
                  {vm.tossText ? (
                    <p className="mt-1 text-sm font-semibold text-white uppercase tracking-wider">
                      {vm.tossText}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
