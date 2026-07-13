/**
 * Reusable Team → Player identity display.
 * Auction tournaments: team logo/badge → team name → player name.
 * Standalone (no team): player name only.
 */

import { cn } from "@/lib/utils";
import {
  hasTeamIdentity,
  identityFromSideInfo,
  resolveTeamColor,
  teamInitials,
  type TeamPlayerIdentity,
} from "@/lib/team-player-identity";
import type { BadmintonSideInfo } from "@workspace/badminton-core";

export type TeamPlayerCardSize = "xs" | "sm" | "md" | "lg" | "xl";
export type TeamPlayerCardAlign = "start" | "center" | "end";
export type TeamPlayerCardTone = "default" | "inverse" | "muted" | "led";

const sizeStyles: Record<
  TeamPlayerCardSize,
  {
    badge: string;
    logo: string;
    team: string;
    player: string;
    gap: string;
  }
> = {
  xs: {
    badge: "h-5 w-5 text-[8px]",
    logo: "h-5 w-5",
    team: "text-[10px] tracking-wide",
    player: "text-xs",
    gap: "gap-0.5",
  },
  sm: {
    badge: "h-6 w-6 text-[9px]",
    logo: "h-6 w-6",
    team: "text-[11px] tracking-wide",
    player: "text-sm",
    gap: "gap-0.5",
  },
  md: {
    badge: "h-8 w-8 text-[10px]",
    logo: "h-8 w-8",
    team: "text-xs tracking-wider",
    player: "text-base",
    gap: "gap-1",
  },
  lg: {
    badge: "h-10 w-10 text-xs",
    logo: "h-10 w-10",
    team: "text-sm tracking-wider",
    player: "text-xl",
    gap: "gap-1.5",
  },
  xl: {
    badge: "h-12 w-12 text-sm",
    logo: "h-12 w-12",
    team: "text-base tracking-[0.12em]",
    player: "text-2xl sm:text-3xl",
    gap: "gap-2",
  },
};

function toneClasses(tone: TeamPlayerCardTone) {
  switch (tone) {
    case "inverse":
      return {
        team: "text-black/55",
        player: "text-black",
        badgeText: "text-white",
      };
    case "muted":
      return {
        team: "text-white/45",
        player: "text-white/85",
        badgeText: "text-white",
      };
    case "led":
      return {
        team: "text-white/55 uppercase",
        player: "text-white",
        badgeText: "text-white",
      };
    default:
      return {
        team: "text-primary/90",
        player: "text-foreground",
        badgeText: "text-white",
      };
  }
}

export function TeamBadge({
  teamName,
  teamLogoUrl,
  teamColor,
  size = "md",
  className,
}: {
  teamName: string;
  teamLogoUrl?: string | null;
  teamColor?: string | null;
  size?: TeamPlayerCardSize;
  className?: string;
}) {
  const styles = sizeStyles[size];
  const color = teamColor?.trim() || resolveTeamColor({ playerName: "", teamName, teamColor });

  if (teamLogoUrl?.trim()) {
    return (
      <img
        src={teamLogoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(
          styles.logo,
          "rounded-md object-contain bg-white/90 border border-white/15 flex-none",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        styles.badge,
        "rounded-md flex items-center justify-center font-black flex-none border border-white/15",
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      <span className="text-white leading-none">{teamInitials(teamName)}</span>
    </div>
  );
}

type TeamPlayerCardProps = {
  identity: TeamPlayerIdentity;
  size?: TeamPlayerCardSize;
  align?: TeamPlayerCardAlign;
  tone?: TeamPlayerCardTone;
  /** stack = logo → team → player (default). inline = badge + team · player on one row. */
  layout?: "stack" | "inline";
  showBadge?: boolean;
  className?: string;
  teamClassName?: string;
  playerClassName?: string;
};

export function TeamPlayerCard({
  identity,
  size = "md",
  align = "start",
  tone = "default",
  layout = "stack",
  showBadge = true,
  className,
  teamClassName,
  playerClassName,
}: TeamPlayerCardProps) {
  const styles = sizeStyles[size];
  const tones = toneClasses(tone);
  const team = identity.teamName?.trim() || "";
  const player = identity.playerName?.trim() || "—";
  const color = resolveTeamColor(identity);
  const alignClass =
    align === "center" ? "items-center text-center" : align === "end" ? "items-end text-right" : "items-start text-left";

  if (!hasTeamIdentity(identity)) {
    return (
      <div className={cn("min-w-0", alignClass, className)}>
        <p className={cn("font-semibold truncate leading-tight", styles.player, tones.player, playerClassName)}>
          {player}
        </p>
      </div>
    );
  }

  if (layout === "inline") {
    return (
      <div className={cn("min-w-0 flex items-center gap-2", align === "end" && "flex-row-reverse", className)}>
        {showBadge ? (
          <TeamBadge
            teamName={team}
            teamLogoUrl={identity.teamLogoUrl}
            teamColor={color}
            size={size === "xl" ? "md" : size === "lg" ? "sm" : size}
          />
        ) : null}
        <div className={cn("min-w-0 flex flex-col", styles.gap, alignClass)}>
          <p className={cn("font-bold uppercase truncate leading-tight", styles.team, tones.team, teamClassName)}>
            {team}
          </p>
          <p className={cn("font-semibold truncate leading-tight", styles.player, tones.player, playerClassName)}>
            {player}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 flex flex-col", styles.gap, alignClass, className)}>
      {showBadge ? (
        <TeamBadge
          teamName={team}
          teamLogoUrl={identity.teamLogoUrl}
          teamColor={color}
          size={size}
        />
      ) : null}
      <p className={cn("font-bold uppercase truncate leading-tight", styles.team, tones.team, teamClassName)}>
        {team}
      </p>
      <p className={cn("font-semibold truncate leading-tight", styles.player, tones.player, playerClassName)}>
        {player}
      </p>
    </div>
  );
}

/** Convenience: build card from BadmintonSideInfo. */
export function TeamPlayerCardFromSide({
  side,
  preferShort,
  ...rest
}: Omit<TeamPlayerCardProps, "identity"> & {
  side: BadmintonSideInfo | null | undefined;
  preferShort?: boolean;
}) {
  return <TeamPlayerCard identity={identityFromSideInfo(side, { preferShort })} {...rest} />;
}

type TeamPlayerVsProps = {
  left: TeamPlayerIdentity;
  right: TeamPlayerIdentity;
  size?: TeamPlayerCardSize;
  tone?: TeamPlayerCardTone;
  layout?: "stack" | "inline";
  className?: string;
  vsClassName?: string;
};

/** Standard Team/Player VS Team/Player composition. */
export function TeamPlayerVs({
  left,
  right,
  size = "md",
  tone = "muted",
  layout = "stack",
  className,
  vsClassName,
}: TeamPlayerVsProps) {
  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <TeamPlayerCard
        identity={left}
        size={size}
        tone={tone}
        layout={layout}
        align="end"
        className="flex-1 min-w-0"
      />
      <span
        className={cn(
          "flex-none text-[10px] font-black uppercase tracking-[0.2em] text-white/35",
          vsClassName,
        )}
      >
        VS
      </span>
      <TeamPlayerCard
        identity={right}
        size={size}
        tone={tone}
        layout={layout}
        align="start"
        className="flex-1 min-w-0"
      />
    </div>
  );
}
