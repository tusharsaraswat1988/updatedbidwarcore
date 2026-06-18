import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { SportBadge, CaptainBadge } from "../../design-system/badges";
import { TeamSlot, AvatarSlot } from "../../design-system/logo-slots";
import { StatCard } from "../../design-system/stat-cards";
import {
  pickRenderContext,
  type BuzzTemplateRenderProps,
} from "../../rendering/buzz-render-context";
import {
  heroLogoSize,
  heroTitleSize,
  isLandscapePoster,
  isTallPoster,
  posterSpacing,
  secondaryLabelSize,
  bodyLabelSize,
} from "../../rendering/poster-layout";
import { formatTeamSpend } from "./TeamReveal.utils";
import type { TeamRevealContract } from "./TeamReveal.types";

type TeamRevealProps = TeamRevealContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

export function TeamReveal(props: TeamRevealProps) {
  const renderCtx = pickRenderContext(props);
  const {
    teamName,
    teamLogoUrl,
    sport,
    captainName,
    captainImageUrl,
    playerCount,
    backgroundImageUrl,
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  } = props;

  const spendDisplay = formatTeamSpend(props);
  const hasStats = playerCount != null || spendDisplay != null;
  const hasCaptain = !!captainName;
  const displayTeamName = teamName ?? "FRANCHISE";

  if (renderCtx) {
    return (
      <BidwarCanvas
        branding={props.branding}
        backgroundImageUrl={backgroundImageUrl}
        showFooterBranding
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        <TeamRevealPoster
          displayTeamName={displayTeamName}
          teamLogoUrl={teamLogoUrl}
          sport={sport}
          captainName={captainName}
          captainImageUrl={captainImageUrl}
          playerCount={playerCount}
          spendDisplay={spendDisplay}
          hasStats={hasStats}
          hasCaptain={hasCaptain}
          ctx={renderCtx}
        />
      </BidwarCanvas>
    );
  }

  return (
    <BidwarCanvas branding={props.branding} backgroundImageUrl={backgroundImageUrl} showFooterBranding>
      <div style={s.layoutLegacy}>
        <div style={s.topStrip}>
          <SportBadge sport={sport} />
          <span style={s.announceTag}>● TEAM REVEAL ●</span>
        </div>
        <div style={s.teamLogoSection}>
          <TeamSlot teamName={displayTeamName} imageUrl={teamLogoUrl} size={96} />
        </div>
        <div style={s.teamNameArea}>
          <span style={s.franchiseLabel}>FRANCHISE</span>
          <h1 style={{ ...legacyTitle, textAlign: "center" }}>{displayTeamName.toUpperCase()}</h1>
        </div>
        <div style={s.divider} aria-hidden="true" />
        {hasStats && (
          <div style={s.statsRow}>
            {playerCount != null && (
              <StatCard label="Squad Size" value={playerCount} icon="👥" />
            )}
            {spendDisplay != null && (
              <StatCard label="Total Spend" value={spendDisplay} highlight icon="💰" />
            )}
          </div>
        )}
        {hasCaptain && (
          <div style={s.captainSection}>
            <div style={s.captainSeparator} aria-hidden="true" />
            <span style={s.captainLabel}>CAPTAIN</span>
            <div style={s.captainRow}>
              <AvatarSlot name={captainName!} kind="player" imageUrl={captainImageUrl ?? undefined} size="sm" />
              <span style={s.captainNameText}>{captainName!}</span>
              <CaptainBadge />
            </div>
          </div>
        )}
      </div>
    </BidwarCanvas>
  );
}

function TeamRevealPoster({
  ctx,
  displayTeamName,
  teamLogoUrl,
  sport,
  captainName,
  captainImageUrl,
  playerCount,
  spendDisplay,
  hasStats,
  hasCaptain,
}: {
  ctx: NonNullable<ReturnType<typeof pickRenderContext>>;
  displayTeamName: string;
  teamLogoUrl?: string | null;
  sport: TeamRevealContract["sport"];
  captainName?: string | null;
  captainImageUrl?: string | null;
  playerCount?: number | null;
  spendDisplay: string | null;
  hasStats: boolean;
  hasCaptain: boolean;
}) {
  const spacing = posterSpacing(ctx);
  const logoSize = heroLogoSize(ctx);
  const titleSize = heroTitleSize(ctx);
  const labelSize = secondaryLabelSize(ctx);
  const bodySize = bodyLabelSize(ctx);
  const landscape = isLandscapePoster(ctx);
  const tall = isTallPoster(ctx);

  const tagStyle: React.CSSProperties = {
    fontFamily: "system-ui, sans-serif",
    fontSize: labelSize,
    fontWeight: 800,
    color: t.primaryGold,
    letterSpacing: "0.14em",
    background: "rgba(251,191,36,0.09)",
    border: "1px solid rgba(251,191,36,0.30)",
    borderRadius: 999,
    padding: `${Math.round(labelSize * 0.35)}px ${Math.round(labelSize * 1.1)}px`,
    textTransform: "uppercase",
  };

  const heroNameStyle: React.CSSProperties = {
    margin: 0,
    fontFamily: "system-ui, sans-serif",
    fontSize: titleSize,
    fontWeight: 900,
    color: "#FFFFFF",
    letterSpacing: "0.05em",
    lineHeight: 1.02,
    textAlign: landscape ? "left" : "center",
    textTransform: "uppercase",
  };

  const statCardStyle: React.CSSProperties = {
    minWidth: landscape ? 180 : 140,
    padding: `${Math.round(bodySize * 0.8)}px ${Math.round(bodySize * 1.2)}px`,
  };

  const heroBlock = (
    <>
      <div style={p.topStrip}>
        <SportBadge sport={sport} />
        <span style={tagStyle}>● TEAM REVEAL ●</span>
      </div>
      <div style={{ ...p.logoSection, marginBottom: spacing.sectionGap }}>
        <TeamSlot teamName={displayTeamName} imageUrl={teamLogoUrl ?? undefined} size={logoSize} />
      </div>
      <div style={{ ...p.nameArea, alignItems: landscape ? "flex-start" : "center" }}>
        <span style={{ ...p.microLabel, fontSize: labelSize }}>FRANCHISE</span>
        <h1 style={heroNameStyle}>{displayTeamName.toUpperCase()}</h1>
      </div>
    </>
  );

  const statsBlock = hasStats ? (
    <div
      style={{
        ...p.statsRow,
        gap: spacing.sectionGap,
        marginBottom: hasCaptain ? spacing.sectionGap : 0,
      }}
    >
      {playerCount != null && (
        <StatCard
          label="Squad Size"
          value={playerCount}
          icon="👥"
          style={statCardStyle}
        />
      )}
      {spendDisplay != null && (
        <StatCard
          label="Total Spend"
          value={spendDisplay}
          highlight
          icon="💰"
          style={statCardStyle}
        />
      )}
    </div>
  ) : null;

  const captainBlock = hasCaptain ? (
    <div style={p.captainSection}>
      <div style={p.captainSeparator} aria-hidden="true" />
      <span style={{ ...p.microLabel, fontSize: labelSize }}>CAPTAIN</span>
      <div style={{ ...p.captainRow, padding: `${Math.round(bodySize * 0.7)}px ${Math.round(bodySize * 1.4)}px` }}>
        <AvatarSlot name={captainName!} kind="player" imageUrl={captainImageUrl ?? undefined} size="sm" />
        <span style={{ ...p.captainName, fontSize: bodySize }}>{captainName!}</span>
        <CaptainBadge />
      </div>
    </div>
  ) : null;

  if (landscape) {
    return (
      <div style={p.landscapeRoot}>
        <div style={p.landscapeHeroCol}>{heroBlock}</div>
        <div style={p.landscapeSideCol}>
          {statsBlock}
          {captainBlock}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...p.portraitRoot,
        gap: tall ? spacing.sectionGap * 1.25 : spacing.sectionGap,
      }}
    >
      {heroBlock}
      <div style={p.portraitBody}>
        {statsBlock}
        {captainBlock}
      </div>
    </div>
  );
}

const legacyTitle: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  fontSize: "clamp(1.5rem, 5.5vw, 2.75rem)",
  fontWeight: 900,
  color: "#FFFFFF",
  letterSpacing: "0.06em",
  lineHeight: 1.05,
  margin: 0,
};

const p: Record<string, React.CSSProperties> = {
  portraitRoot: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    flex: 1,
    minHeight: 0,
    justifyContent: "space-between",
  },
  portraitBody: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    gap: 20,
  },
  landscapeRoot: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    height: "100%",
    flex: 1,
    gap: 48,
    minHeight: 0,
  },
  landscapeHeroCol: {
    flex: 1.15,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minWidth: 0,
    height: "100%",
  },
  landscapeSideCol: {
    flex: 0.85,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 28,
    minWidth: 0,
    height: "100%",
  },
  topStrip: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
  },
  logoSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  nameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  microLabel: {
    fontFamily: "system-ui, sans-serif",
    fontWeight: 700,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: "0.26em",
    textTransform: "uppercase",
  },
  statsRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "100%",
  },
  captainSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  captainSeparator: {
    width: "100%",
    height: 1,
    background: "rgba(255,255,255,0.07)",
  },
  captainRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  captainName: {
    fontFamily: "system-ui, sans-serif",
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: "0.06em",
    flexShrink: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

const s: Record<string, React.CSSProperties> = {
  layoutLegacy: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    padding: "0 0 4px",
  },
  topStrip: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
  },
  announceTag: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "clamp(0.45rem, 1.3vw, 0.5625rem)",
    fontWeight: 800,
    color: t.primaryGold,
    letterSpacing: "0.14em",
    background: "rgba(251,191,36,0.09)",
    border: "1px solid rgba(251,191,36,0.30)",
    borderRadius: 999,
    padding: "3px 10px",
    textTransform: "uppercase",
  },
  teamLogoSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  teamNameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    paddingBottom: 12,
    textAlign: "center",
  },
  franchiseLabel: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "clamp(0.45rem, 1.2vw, 0.5625rem)",
    fontWeight: 700,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: "0.26em",
    textTransform: "uppercase",
  },
  divider: {
    width: "55%",
    height: 1,
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
    marginBottom: 14,
  },
  statsRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 14,
    width: "100%",
  },
  captainSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
    width: "100%",
  },
  captainSeparator: {
    width: "100%",
    height: 1,
    background: "rgba(255,255,255,0.07)",
  },
  captainLabel: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "clamp(0.45rem, 1.2vw, 0.5625rem)",
    fontWeight: 700,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: "0.26em",
    textTransform: "uppercase",
  },
  captainRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 18px",
    borderRadius: 10,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  captainNameText: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "clamp(0.75rem, 2.5vw, 1rem)",
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: "0.06em",
    flexShrink: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
