/**
 * MidScreenSlatesV2 — All 6 V2 Mid-Screen Broadcast Slates
 *
 * Slates:
 * 1. SponsorSlateV2 — Sponsor showcase (title + associates)
 * 2. StandingsSlateV2 — Points table / group standings
 * 3. FixturesSlateV2 — Upcoming match schedule
 * 4. ScorecardSlateV2 — Live innings scorecard
 * 5. SummarySlateV2 — Match summary with result
 * 6. VsIntroSlateV2 — Match intro / cinematic VS clash
 *
 * Visual Design: NEW V2 Lovable Design System
 * - All use SlateShell (consistent masthead chrome)
 * - Obsidian panels with gold accents and hairline borders
 * - Bebas Neue for all display/title text
 * - Inter for body/label text, JetBrains Mono for numerics
 * - No old OBS styles reused
 *
 * Functional Behaviour: Preserved from CricketObsMidOverlays
 * - Same data sources (getScoringStandings, listScoringMatches, vm.sponsors)
 * - Same query caching (staleTime: 30_000)
 * - Same match resolution logic (overlayMatchId, overlayStageOrGroup)
 * - Same empty states
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { getScoringStandings, listScoringMatches } from "@/lib/scoring-api";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import type { CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import type { SponsorLogo as BidWarSponsorLogo } from "@/lib/sponsor-logo";
import { OBS_V2 } from "../obs-v2-tokens";
import { SlateShell, SlateHeading, SlateEmptyState } from "./SlateShell";

// ─── Sponsor type normalization ──────────────────────────────────────────────
// vm.sponsors is BidWar SponsorLogo (url, isTitleSponsor, etc.)
// V2 rendering needs logoUrl — map here

type NormalizedSponsor = {
  id: string;
  name: string;
  logoUrl?: string;
  label?: string;
  tier?: "title" | "associate";
};

function normalizeVmSponsors(sponsors: BidWarSponsorLogo[]): NormalizedSponsor[] {
  if (!sponsors || sponsors.length === 0) return [];
  return sponsors.map((s, idx) => ({
    id: s.publicId || `sp-${idx}`,
    name: s.name || s.type || `Sponsor ${idx + 1}`,
    logoUrl: s.url || undefined,
    tier: s.isTitleSponsor ? "title" : "associate",
    label: s.isTitleSponsor
      ? "TITLE SPONSOR"
      : s.isCoSponsor
        ? "CO-SPONSOR"
        : "OFFICIAL PARTNER",
  }));
}

// ─── Shared type ────────────────────────────────────────────────────────────

type MidSlateMatch = {
  id: number;
  roundName?: string | null;
  venue?: string | null;
  status?: string;
  resultSummary?: string | null;
  scheduledAt?: string | null;
  homeTeam?: { id?: number; name?: string; shortCode?: string; logoUrl?: string | null } | null;
  awayTeam?: { id?: number; name?: string; shortCode?: string; logoUrl?: string | null } | null;
};

// ─── Shared panel chrome ─────────────────────────────────────────────────────

function Panel({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      style={{
        background: highlight ? OBS_V2.color.panelElevated : OBS_V2.color.panel,
        border: `1px solid ${highlight ? OBS_V2.color.strong : OBS_V2.color.standard}`,
        padding: `${OBS_V2.spacing.lg}px ${OBS_V2.spacing.xl}px`,
      }}
    >
      {children}
    </div>
  );
}

// ─── 1. SPONSOR SLATE ────────────────────────────────────────────────────────

export function SponsorSlateV2({
  vm,
  sponsorName,
}: {
  vm: CricketObsViewModel;
  sponsorName?: string | null;
}) {
  const normalizedSponsors = useMemo(() => normalizeVmSponsors(vm.sponsors || []), [vm.sponsors]);

  const targetedSponsor = useMemo(() => {
    if (!sponsorName || sponsorName === "all" || normalizedSponsors.length === 0) return null;
    return (
      normalizedSponsors.find(
        (s) => s.name?.toLowerCase().trim() === sponsorName.toLowerCase().trim(),
      ) ?? null
    );
  }, [sponsorName, normalizedSponsors]);

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Sponsors">
      <SlateHeading
        kicker={targetedSponsor ? "OFFICIAL PARTNER" : "OFFICIAL TOURNAMENT PARTNERS"}
        title={targetedSponsor ? targetedSponsor.name || "PARTNER" : "OUR VALUED SPONSORS"}
      />

      {/* Single focused sponsor */}
      {targetedSponsor ? (
        <div className="flex-1 flex items-center justify-center">
          <Panel highlight>
            <div
              className="flex flex-col items-center"
              style={{ minWidth: 320, maxWidth: 500, padding: `${OBS_V2.spacing.section}px` }}
            >
              <span
                style={{
                  ...OBS_V2.typography.scale.label,
                  color: OBS_V2.color.brand,
                  marginBottom: OBS_V2.spacing.xl,
                }}
              >
                {targetedSponsor.label ?? (targetedSponsor.tier === "title" ? "TITLE SPONSOR" : "OFFICIAL PARTNER")}
              </span>
              {targetedSponsor.logoUrl && (
                <div
                  style={{ height: 160, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <img
                    src={targetedSponsor.logoUrl}
                    alt={targetedSponsor.name || ""}
                    style={{ maxHeight: "100%", maxWidth: 360, objectFit: "contain" }}
                  />
                </div>
              )}
              <p
                style={{
                  ...OBS_V2.typography.scale.title,
                  color: OBS_V2.color.text,
                  marginTop: OBS_V2.spacing.xl,
                  letterSpacing: "0.06em",
                }}
              >
                {targetedSponsor.name}
              </p>
            </div>
          </Panel>
        </div>
      ) : normalizedSponsors.length > 0 ? (
        <div
          className="flex-1 grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: OBS_V2.spacing.xl,
            alignContent: "start",
          }}
        >
          {normalizedSponsors.map((sp, idx) => (
            <Panel key={idx}>
              <div className="flex flex-col items-center" style={{ gap: OBS_V2.spacing.sm }}>
                <span
                  style={{
                    ...OBS_V2.typography.scale.micro,
                    color: OBS_V2.color.brand,
                  }}
                >
                  {sp.label ?? (sp.tier === "title" ? "TITLE SPONSOR" : "OFFICIAL PARTNER")}
                </span>
                {sp.logoUrl && (
                  <div style={{ height: 72, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img
                      src={sp.logoUrl}
                      alt={sp.name || ""}
                      style={{ maxHeight: "100%", maxWidth: 200, objectFit: "contain" }}
                    />
                  </div>
                )}
                <p
                  style={{
                    ...OBS_V2.typography.scale.body,
                    color: OBS_V2.color.text,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {sp.name || "Sponsor"}
                </p>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <SlateEmptyState message="No sponsor data available." />
      )}
    </SlateShell>
  );
}

// ─── 2. STANDINGS SLATE ───────────────────────────────────────────────────────

export function StandingsSlateV2({
  vm,
  tournamentId,
  stageOrGroup,
}: {
  vm: CricketObsViewModel;
  tournamentId: number;
  stageOrGroup?: string | null;
}) {
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });

  const matchedGroup = useMemo(() => {
    if (!stageOrGroup || stageOrGroup === "all" || !standings?.groups) return null;
    return (
      standings.groups.find(
        (g) => g.name.toLowerCase().trim() === stageOrGroup.toLowerCase().trim(),
      ) ?? null
    );
  }, [stageOrGroup, standings?.groups]);

  const rows = useMemo(() => {
    if (matchedGroup) return matchedGroup.rows;
    return standings ?? [];
  }, [matchedGroup, standings]);

  const tableTitle = matchedGroup
    ? `GROUP ${matchedGroup.name.toUpperCase()} POINTS TABLE`
    : "TOURNAMENT POINTS TABLE";

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Standings">
      <SlateHeading
        kicker={matchedGroup ? `${matchedGroup.name.toUpperCase()} STANDINGS` : "STANDINGS & RANKINGS"}
        title={tableTitle}
      />

      {/* Table */}
      <div
        className="flex-1 overflow-auto"
        style={{
          background: OBS_V2.color.carbon,
          border: `1px solid ${OBS_V2.color.standard}`,
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr
              style={{
                background: OBS_V2.color.panel,
                borderBottom: `1px solid ${OBS_V2.color.strong}`,
              }}
            >
              {["POS", "TEAM", "P", "W", "L", "NRR", "PTS"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...OBS_V2.typography.scale.label,
                    color: OBS_V2.color.textMuted,
                    padding: `${OBS_V2.spacing.md}px ${OBS_V2.spacing.lg}px`,
                    textAlign: h === "TEAM" ? "left" : "center",
                    fontWeight: 700,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows && rows.length > 0 ? (
              rows.map((row, idx) => (
                <tr
                  key={row.teamId}
                  style={{
                    background: idx % 2 === 0 ? "transparent" : OBS_V2.color.panelInset,
                    borderBottom: `1px solid ${OBS_V2.color.hairline}`,
                  }}
                >
                  {/* Position */}
                  <td style={{ textAlign: "center", padding: `${OBS_V2.spacing.md}px ${OBS_V2.spacing.lg}px` }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        background: idx < 4 ? OBS_V2.color.brand : OBS_V2.color.standard,
                        color: idx < 4 ? OBS_V2.color.brandOn : OBS_V2.color.text,
                        ...OBS_V2.typography.scale.label,
                        fontFamily: OBS_V2.typography.family.mono,
                        fontWeight: 800,
                      }}
                    >
                      {idx + 1}
                    </span>
                  </td>

                  {/* Team */}
                  <td style={{ padding: `${OBS_V2.spacing.md}px ${OBS_V2.spacing.lg}px` }}>
                    <span
                      style={{
                        ...OBS_V2.typography.scale.body,
                        color: OBS_V2.color.text,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {row.teamName}
                    </span>
                    <span
                      style={{
                        ...OBS_V2.typography.scale.micro,
                        color: OBS_V2.color.textMuted,
                        marginLeft: 8,
                        fontFamily: OBS_V2.typography.family.mono,
                      }}
                    >
                      ({row.shortCode})
                    </span>
                  </td>

                  {/* Stats */}
                  {[
                    { val: row.played, color: OBS_V2.color.textSecondary },
                    { val: row.won, color: OBS_V2.color.info },
                    { val: row.lost, color: OBS_V2.color.danger },
                    {
                      val: row.netRunRate != null
                        ? row.netRunRate > 0
                          ? `+${row.netRunRate.toFixed(3)}`
                          : row.netRunRate.toFixed(3)
                        : "0.000",
                      color: OBS_V2.color.textSecondary,
                    },
                  ].map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        textAlign: "center",
                        padding: `${OBS_V2.spacing.md}px ${OBS_V2.spacing.sm}px`,
                        fontFamily: OBS_V2.typography.family.mono,
                        color: cell.color,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {cell.val}
                    </td>
                  ))}

                  {/* Points — large display */}
                  <td style={{ textAlign: "right", padding: `${OBS_V2.spacing.md}px ${OBS_V2.spacing.xl}px` }}>
                    <span
                      style={{
                        ...OBS_V2.typography.scale.headline,
                        color: OBS_V2.color.brand,
                        fontFamily: OBS_V2.typography.family.display,
                      }}
                    >
                      {row.points}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: `${OBS_V2.spacing.section}px`,
                    textAlign: "center",
                    color: OBS_V2.color.textMuted,
                    ...OBS_V2.typography.scale.body,
                  }}
                >
                  No standings data calculated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SlateShell>
  );
}

// ─── 3. FIXTURES SLATE ────────────────────────────────────────────────────────

export function FixturesSlateV2({
  vm,
  tournamentId,
}: {
  vm: CricketObsViewModel;
  tournamentId: number;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });

  const upcoming = useMemo(
    () => (matches || []).filter((m) => m.status !== "completed").slice(0, 4),
    [matches],
  );

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Fixtures">
      <SlateHeading kicker="SCHEDULE & FIXTURES" title="UPCOMING MATCHES" />

      {upcoming.length > 0 ? (
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: OBS_V2.spacing.xl, alignContent: "start" }}
        >
          {upcoming.map((m: any) => (
            <Panel key={m.id}>
              {/* Match header */}
              <div
                className="flex items-center justify-between"
                style={{
                  borderBottom: `1px solid ${OBS_V2.color.divider}`,
                  paddingBottom: OBS_V2.spacing.sm,
                  marginBottom: OBS_V2.spacing.lg,
                }}
              >
                <span
                  style={{
                    ...OBS_V2.typography.scale.label,
                    color: OBS_V2.color.brand,
                  }}
                >
                  {m.roundName || `MATCH #${m.id}`}
                </span>
                {m.venue && (
                  <span
                    style={{
                      ...OBS_V2.typography.scale.micro,
                      color: OBS_V2.color.textMuted,
                    }}
                  >
                    {m.venue}
                  </span>
                )}
              </div>

              {/* Teams */}
              <div className="flex items-center justify-around" style={{ padding: `${OBS_V2.spacing.lg}px 0` }}>
                <TeamBadge name={m.homeTeam?.name || "HOME"} shortCode={m.homeTeam?.shortCode || "HME"} />
                <span
                  style={{
                    ...OBS_V2.typography.scale.hero,
                    color: OBS_V2.color.brand,
                    fontStyle: "italic",
                  }}
                >
                  VS
                </span>
                <TeamBadge name={m.awayTeam?.name || "AWAY"} shortCode={m.awayTeam?.shortCode || "AWY"} />
              </div>

              {/* Date badge */}
              <div
                className="flex justify-center"
                style={{ borderTop: `1px solid ${OBS_V2.color.divider}`, paddingTop: OBS_V2.spacing.sm }}
              >
                <span
                  style={{
                    ...OBS_V2.typography.scale.label,
                    color: OBS_V2.color.textSecondary,
                    border: `1px solid ${OBS_V2.color.standard}`,
                    padding: "3px 12px",
                  }}
                >
                  {m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString() : "SCHEDULED"}
                </span>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <SlateEmptyState message="No upcoming fixtures scheduled." />
      )}
    </SlateShell>
  );
}

function TeamBadge({ name, shortCode }: { name: string; shortCode: string }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: OBS_V2.spacing.xs, maxWidth: 180 }}>
      <span
        style={{
          ...OBS_V2.typography.scale.title,
          color: OBS_V2.color.text,
          letterSpacing: "0.04em",
        }}
      >
        {shortCode}
      </span>
      <span
        style={{
          ...OBS_V2.typography.scale.bodySm,
          color: OBS_V2.color.textSecondary,
          fontWeight: 700,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {name}
      </span>
    </div>
  );
}

// ─── 4. SCORECARD SLATE ───────────────────────────────────────────────────────

export function ScorecardSlateV2({ vm }: { vm: CricketObsViewModel }) {
  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Scorecard">
      <SlateHeading
        kicker="INNINGS BREAKDOWN"
        title={`${vm.batting?.name || "CURRENT INNINGS"} SCORECARD`}
      />

      {/* Score headline */}
      <div
        className="flex items-center justify-between"
        style={{
          borderBottom: `1px solid ${OBS_V2.color.strong}`,
          paddingBottom: OBS_V2.spacing.lg,
          marginBottom: OBS_V2.spacing.lg,
        }}
      >
        <div className="flex items-center gap-4">
          <div
            style={{
              width: 56,
              height: 56,
              background: OBS_V2.color.panelInset,
              border: `1px solid ${OBS_V2.color.standard}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                ...OBS_V2.typography.scale.title,
                color: OBS_V2.color.brand,
                fontSize: 22,
              }}
            >
              {vm.batting?.shortCode || "BAT"}
            </span>
          </div>
          <div>
            <div
              style={{
                ...OBS_V2.typography.scale.headline,
                color: OBS_V2.color.text,
                letterSpacing: "0.03em",
              }}
            >
              {vm.batting?.name || "BATTING TEAM"}
            </div>
            <div
              style={{
                ...OBS_V2.typography.scale.label,
                color: OBS_V2.color.brand,
                marginTop: 2,
              }}
            >
              {vm.tournamentName}
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          <span
            style={{
              ...OBS_V2.typography.scale.score,
              color: OBS_V2.color.text,
              fontFamily: OBS_V2.typography.family.display,
            }}
          >
            {vm.runs}-{vm.wickets}
          </span>
          <span
            style={{
              ...OBS_V2.typography.scale.scoreSub,
              color: OBS_V2.color.brand,
            }}
          >
            ({vm.oversLabel} OV)
          </span>
        </div>
      </div>

      {/* Bowler figures table */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: OBS_V2.color.carbon, border: `1px solid ${OBS_V2.color.standard}` }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: OBS_V2.color.panel, borderBottom: `1px solid ${OBS_V2.color.strong}` }}>
              {["BOWLER", "OVERS", "MAIDENS", "RUNS", "WICKETS", "ECON"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...OBS_V2.typography.scale.label,
                    color: OBS_V2.color.textMuted,
                    padding: `${OBS_V2.spacing.sm}px ${OBS_V2.spacing.lg}px`,
                    textAlign: h === "BOWLER" ? "left" : "center",
                    fontWeight: 700,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vm.bowler ? (
              <tr style={{ borderBottom: `1px solid ${OBS_V2.color.hairline}` }}>
                <td
                  style={{
                    padding: `${OBS_V2.spacing.md}px ${OBS_V2.spacing.lg}px`,
                    ...OBS_V2.typography.scale.body,
                    color: OBS_V2.color.text,
                    fontWeight: 700,
                  }}
                >
                  {vm.bowler.name} *
                </td>
                <td style={{ textAlign: "center", padding: `${OBS_V2.spacing.md}px`, fontFamily: OBS_V2.typography.family.mono, color: OBS_V2.color.textSecondary, fontSize: 14 }}>{vm.bowler.overs}</td>
                <td style={{ textAlign: "center", padding: `${OBS_V2.spacing.md}px`, fontFamily: OBS_V2.typography.family.mono, color: OBS_V2.color.textSecondary, fontSize: 14 }}>{vm.bowler.maidens}</td>
                <td style={{ textAlign: "center", padding: `${OBS_V2.spacing.md}px`, fontFamily: OBS_V2.typography.family.mono, color: OBS_V2.color.textSecondary, fontSize: 14 }}>{vm.bowler.runsConceded}</td>
                <td style={{ textAlign: "center", padding: `${OBS_V2.spacing.md}px`, fontFamily: OBS_V2.typography.family.mono, color: OBS_V2.color.brand, fontWeight: 800, fontSize: 18 }}>{vm.bowler.wickets}</td>
                <td style={{ textAlign: "right", padding: `${OBS_V2.spacing.md}px ${OBS_V2.spacing.lg}px`, fontFamily: OBS_V2.typography.family.mono, color: OBS_V2.color.info, fontWeight: 700, fontSize: 14 }}>{vm.bowler.economy.toFixed(2)}</td>
              </tr>
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: OBS_V2.spacing.section, textAlign: "center", color: OBS_V2.color.textMuted }}>
                  Waiting for bowling figures…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom stats bar */}
      <div
        className="flex items-center justify-between"
        style={{
          background: OBS_V2.color.panelInset,
          border: `1px solid ${OBS_V2.color.standard}`,
          borderTop: `2px solid ${OBS_V2.color.brand}`,
          padding: `${OBS_V2.spacing.sm}px ${OBS_V2.spacing.xl}px`,
          marginTop: OBS_V2.spacing.sm,
        }}
      >
        {[
          { label: "CRR", value: vm.crr ?? "0.00", color: OBS_V2.color.brand },
          { label: "OVERS", value: vm.oversLabel, color: OBS_V2.color.textSecondary },
          { label: "TOTAL", value: `${vm.runs}-${vm.wickets}`, color: OBS_V2.color.brand },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-baseline gap-2">
            <span style={{ ...OBS_V2.typography.scale.label, color: OBS_V2.color.textMuted }}>{label}</span>
            <span style={{ ...OBS_V2.typography.scale.headline, color, fontFamily: OBS_V2.typography.family.display }}>{value}</span>
          </div>
        ))}
      </div>
    </SlateShell>
  );
}

// ─── 5. SUMMARY SLATE ────────────────────────────────────────────────────────

export function SummarySlateV2({
  vm,
  tournamentId,
  overlayMatchId,
}: {
  vm: CricketObsViewModel;
  tournamentId: number;
  overlayMatchId?: number | null;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });

  const activeMatch = useMemo(() => {
    if (overlayMatchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === overlayMatchId);
      if (found) return found as any;
    }
    return matches && matches.length > 0 ? (matches[0] as any) : null;
  }, [overlayMatchId, matches]);

  const homeTeam = activeMatch?.homeTeam || vm.home;
  const awayTeam = activeMatch?.awayTeam || vm.away;

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Summary">
      <SlateHeading
        kicker={activeMatch ? `MATCH #${activeMatch.id}${activeMatch.roundName ? ` · ${activeMatch.roundName.toUpperCase()}` : ""}` : "OFFICIAL MATCH RESULT"}
        title="MATCH SUMMARY"
      />

      {/* Two team inning cards */}
      <div
        className="flex-1 grid"
        style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: OBS_V2.spacing.xl }}
      >
        {/* Home / Batting team */}
        <Panel>
          <div
            className="flex items-center justify-between"
            style={{ borderBottom: `1px solid ${OBS_V2.color.divider}`, paddingBottom: OBS_V2.spacing.sm, marginBottom: OBS_V2.spacing.lg }}
          >
            <span style={{ ...OBS_V2.typography.scale.headline, color: OBS_V2.color.text, letterSpacing: "0.03em" }}>
              {homeTeam?.name || "TEAM 1"}
            </span>
            <span style={{ ...OBS_V2.typography.scale.title, color: OBS_V2.color.brand, fontFamily: OBS_V2.typography.family.display }}>
              {vm.phase === "completed" || vm.phase === "chase" ? `${vm.runs}-${vm.wickets}` : "—"}
            </span>
          </div>
          <p style={{ ...OBS_V2.typography.scale.micro, color: OBS_V2.color.textMuted, marginBottom: OBS_V2.spacing.sm }}>TOP BATTERS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: OBS_V2.spacing.xs }}>
            {[vm.striker, vm.nonStriker].map((batter, idx) =>
              batter ? (
                <div key={idx} className="flex justify-between">
                  <span style={{ ...OBS_V2.typography.scale.bodySm, color: OBS_V2.color.text, fontWeight: 700 }}>{batter.name}</span>
                  <span style={{ ...OBS_V2.typography.scale.bodySm, color: OBS_V2.color.brand, fontFamily: OBS_V2.typography.family.mono, fontWeight: 700 }}>
                    {batter.runs} ({batter.balls}b)
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </Panel>

        {/* Away / Bowling team */}
        <Panel>
          <div
            className="flex items-center justify-between"
            style={{ borderBottom: `1px solid ${OBS_V2.color.divider}`, paddingBottom: OBS_V2.spacing.sm, marginBottom: OBS_V2.spacing.lg }}
          >
            <span style={{ ...OBS_V2.typography.scale.headline, color: OBS_V2.color.text, letterSpacing: "0.03em" }}>
              {awayTeam?.name || "TEAM 2"}
            </span>
            <span style={{ ...OBS_V2.typography.scale.title, color: OBS_V2.color.brand, fontFamily: OBS_V2.typography.family.display }}>
              {vm.target != null ? `${vm.target - 1}` : "—"}
            </span>
          </div>
          <p style={{ ...OBS_V2.typography.scale.micro, color: OBS_V2.color.textMuted, marginBottom: OBS_V2.spacing.sm }}>TOP BOWLERS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: OBS_V2.spacing.xs }}>
            {vm.bowler ? (
              <div className="flex justify-between">
                <span style={{ ...OBS_V2.typography.scale.bodySm, color: OBS_V2.color.text, fontWeight: 700 }}>{vm.bowler.name}</span>
                <span style={{ ...OBS_V2.typography.scale.bodySm, color: OBS_V2.color.info, fontFamily: OBS_V2.typography.family.mono, fontWeight: 700 }}>
                  {vm.bowler.wickets}-{vm.bowler.runsConceded}
                </span>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      {/* Victory headline */}
      <div
        style={{
          background: OBS_V2.color.panelInset,
          border: `2px solid ${OBS_V2.color.brand}`,
          marginTop: OBS_V2.spacing.xl,
          padding: `${OBS_V2.spacing.lg}px ${OBS_V2.spacing.xl}px`,
          textAlign: "center",
        }}
      >
        <span
          style={{
            ...OBS_V2.typography.scale.title,
            color: OBS_V2.color.brand,
            letterSpacing: "0.08em",
          }}
        >
          {(activeMatch as any)?.resultSummary || vm.resultHeadline || vm.resultText || "MATCH IN PROGRESS"}
        </span>
      </div>
    </SlateShell>
  );
}

// ─── 6. VS INTRO SLATE ───────────────────────────────────────────────────────

export function VsIntroSlateV2({
  vm,
  tournamentId,
  overlayMatchId,
}: {
  vm: CricketObsViewModel;
  tournamentId: number;
  overlayMatchId?: number | null;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });

  const activeMatch = useMemo(() => {
    if (overlayMatchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === overlayMatchId);
      if (found) return found as any;
    }
    return matches && matches.length > 0 ? (matches[0] as any) : null;
  }, [overlayMatchId, matches]);

  const homeTeam = activeMatch?.homeTeam || vm.home;
  const awayTeam = activeMatch?.awayTeam || vm.away;

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Match Intro">
      <SlateHeading
        kicker={activeMatch ? `MATCH #${activeMatch.id}${activeMatch.roundName ? ` · ${activeMatch.roundName.toUpperCase()}` : ""}` : "MATCH PRESENTATION"}
        title={`${homeTeam?.name || "TEAM 1"} VS ${awayTeam?.name || "TEAM 2"}`}
      />

      {/* Cinematic VS layout */}
      <div className="flex-1 flex items-center justify-center" style={{ gap: "120px" }}>
        {/* Home Team */}
        <div className="flex flex-col items-center" style={{ gap: OBS_V2.spacing.lg }}>
          {homeTeam?.logoUrl ? (
            <div style={{ width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img
                src={homeTeam.logoUrl}
                alt={homeTeam.name || ""}
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 12px 35px rgba(255,215,0,0.35))",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 160,
                height: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: OBS_V2.color.panelInset,
                border: `2px solid ${OBS_V2.color.brandBorder}`,
              }}
            >
              <span
                style={{
                  ...OBS_V2.typography.scale.score,
                  color: OBS_V2.color.brand,
                  filter: "drop-shadow(0 8px 25px rgba(255,215,0,0.5))",
                }}
              >
                {homeTeam?.shortCode || "H"}
              </span>
            </div>
          )}
          <span
            style={{
              ...OBS_V2.typography.scale.headline,
              color: OBS_V2.color.text,
              textAlign: "center",
              letterSpacing: "0.04em",
              maxWidth: 240,
            }}
          >
            {homeTeam?.name}
          </span>
        </div>

        {/* VS */}
        <span
          style={{
            ...OBS_V2.typography.scale.mega,
            color: OBS_V2.color.brand,
            fontStyle: "italic",
            filter: "drop-shadow(0 10px 30px rgba(255,215,0,0.4))",
          }}
        >
          VS
        </span>

        {/* Away Team */}
        <div className="flex flex-col items-center" style={{ gap: OBS_V2.spacing.lg }}>
          {awayTeam?.logoUrl ? (
            <div style={{ width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img
                src={awayTeam.logoUrl}
                alt={awayTeam.name || ""}
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 12px 35px rgba(18,207,255,0.35))",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 160,
                height: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: OBS_V2.color.panelInset,
                border: `2px solid ${OBS_V2.color.infoBorder}`,
              }}
            >
              <span
                style={{
                  ...OBS_V2.typography.scale.score,
                  color: OBS_V2.color.info,
                  filter: "drop-shadow(0 8px 25px rgba(18,207,255,0.5))",
                }}
              >
                {awayTeam?.shortCode || "A"}
              </span>
            </div>
          )}
          <span
            style={{
              ...OBS_V2.typography.scale.headline,
              color: OBS_V2.color.text,
              textAlign: "center",
              letterSpacing: "0.04em",
              maxWidth: 240,
            }}
          >
            {awayTeam?.name}
          </span>
        </div>
      </div>
    </SlateShell>
  );
}

// ─── MidScreenSlatesV2 — composite router ────────────────────────────────────

/**
 * MidScreenSlatesV2 — Routes to the correct V2 slate based on overlay kind.
 * Drop-in replacement for CricketObsMidOverlays.
 */
export function MidScreenSlatesV2({
  vm,
  overlay,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  tournamentId,
}: {
  vm: CricketObsViewModel;
  overlay: CricketObsMidOverlayKind;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  tournamentId: number;
}) {
  if (overlay === "none" || overlay === "neutral") return null;

  return (
    <AnimatePresence mode="wait">
      {overlay === "sponsors" && (
        <SponsorSlateV2 key="sponsors" vm={vm} sponsorName={overlaySponsorName} />
      )}
      {overlay === "standings" && (
        <StandingsSlateV2 key="standings" vm={vm} tournamentId={tournamentId} stageOrGroup={overlayStageOrGroup} />
      )}
      {overlay === "fixtures" && (
        <FixturesSlateV2 key="fixtures" vm={vm} tournamentId={tournamentId} />
      )}
      {overlay === "scorecard" && (
        <ScorecardSlateV2 key="scorecard" vm={vm} />
      )}
      {overlay === "summary" && (
        <SummarySlateV2 key="summary" vm={vm} tournamentId={tournamentId} overlayMatchId={overlayMatchId} />
      )}
      {overlay === "intro" && (
        <VsIntroSlateV2 key="intro" vm={vm} tournamentId={tournamentId} overlayMatchId={overlayMatchId} />
      )}
    </AnimatePresence>
  );
}
