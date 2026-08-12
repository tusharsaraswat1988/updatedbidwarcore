import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BtnPrimary, hubCardClass, hubPanelClass } from "@/components/badminton/form-ui";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";
import { useBadmintonBidWarTheme } from "@/components/badminton/bidwar-badminton-branding";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { badmintonBroadcastPath } from "@/lib/badminton-broadcast-urls";
import { badmintonMatchControlPath, badmintonScorerMatchPath } from "@/lib/badminton-routes";



export {

  BadmintonPublicBrandMark,

  BadmintonOrganizerBrandBar,

  useBadmintonBidWarTheme,

} from "@/components/badminton/bidwar-badminton-branding";

export {

  inputClass,

  labelClass,

  hubCardClass,

  hubPanelClass,

  HubPageShell,

  FormField,

  DarkSelect,

  FormError,

  FormActions,

  FormModal,

  SearchInput,

  AsyncLoadingPanel,

  AsyncLoadingInline,

  CheckboxRow,

  PickerTrigger,

  BtnPrimary,

  BtnSecondary,

  btnPrimaryClass,

  btnSecondaryClass,

  btnCompactClass,

} from "@/components/badminton/form-ui";



const BIDWAR_HOME_URL = "https://bidwar.in/";

/** Auction-style page header for badminton hub pages */

export function PageHeader({

  title,

  subtitle,

  actions,

  eyebrow,

  badge,

  tournamentId,

  showBrandMark = true,

}: {

  title: string;

  subtitle?: string;

  actions?: React.ReactNode;

  /** @deprecated Use BadmintonHubNav back link instead */

  backHref?: string;

  /** Fallback label when tournament name is unavailable. Prefer `tournamentId`. */

  eyebrow?: string;

  badge?: string;

  /** When set, eyebrow shows the tournament display name. */

  tournamentId?: number;

  /** Centered BidWar logo — on for every hub tab/menu page. */

  showBrandMark?: boolean;

}) {

  const { brandName, logoSrc, logoAlt } = useBadmintonBidWarTheme();

  const { data: branding } = useBadmintonBranding(tournamentId ?? 0);

  const tournamentName = branding?.displayName?.trim();

  const eyebrowLabel = tournamentName || eyebrow;



  return (

    <div className="border-b border-border px-6 py-5 sm:py-6">

      <div className="max-w-7xl mx-auto space-y-4">

        {showBrandMark && logoSrc ? (

          <div className="flex justify-center">

            <a

              href={BIDWAR_HOME_URL}

              target="_blank"

              rel="noopener noreferrer"

              className="inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

              aria-label={`${brandName} — opens home page in a new tab`}

            >

              <img

                src={logoSrc}

                alt={logoAlt}

                className="block h-8 sm:h-9 md:h-10 w-auto max-w-[min(240px,55vw)] object-contain"

                loading="eager"

                decoding="async"

              />

            </a>

          </div>

        ) : null}



        <div className="flex items-start justify-between gap-4 flex-wrap">

          <div className="min-w-0">

            {eyebrowLabel ? (

              <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1 truncate">

                {eyebrowLabel}

              </p>

            ) : null}

            <div className="flex items-center gap-3 flex-wrap">

              <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">

                {title}

              </h1>

              {badge ? (

                <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold tracking-widest uppercase">

                  {badge}

                </span>

              ) : null}

            </div>

            {subtitle ? <p className="text-muted-foreground text-sm mt-1 font-mono">{subtitle}</p> : null}

          </div>

          {actions ? <div className="shrink-0">{actions}</div> : null}

        </div>

      </div>

    </div>

  );

}



/** Compatibility re-exports — canonical implementations in components/platform */
export { EmptyState } from "@/components/platform/empty-state";
export { HubKpiCard } from "@/components/platform/platform-card";
export { HubSectionHeader } from "@/components/platform/section-header";



export function HubNavButton({

  icon: Icon,

  label,

  href,

}: {

  icon: LucideIcon;

  label: string;

  href: string;

}) {

  return (

    <Link href={href}>

      <div className="flex items-center gap-2 bg-card hover:bg-accent border border-border hover:border-primary/25 rounded-lg px-3 py-2 cursor-pointer transition-colors">

        <Icon className="w-4 h-4 text-primary" />

        <span className="text-foreground/80 text-sm font-medium">{label}</span>

      </div>

    </Link>

  );

}



export function HubQuickAction({

  icon: Icon,

  title,

  desc,

  href,

}: {

  icon: LucideIcon;

  title: string;

  desc: string;

  href: string;

}) {

  return (

    <Link href={href}>

      <div className={cn(

        hubCardClass,

        "p-4 cursor-pointer hover:border-primary/30 hover:shadow-[0_10px_40px_rgba(0,0,0,0.45),0_0_0_1px_hsl(var(--primary)/0.12)] transition-all",

      )}>

        <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-3">

          <Icon className="w-5 h-5 text-primary" />

        </div>

        <p className="text-foreground font-semibold text-sm">{title}</p>

        <p className="text-muted-foreground text-xs mt-0.5">{desc}</p>

      </div>

    </Link>

  );

}



export function HubFilterTabs<T extends string>({

  tabs,

  active,

  onChange,

  counts,

  liveTab,

}: {

  tabs: readonly T[];

  active: T;

  onChange: (tab: T) => void;

  counts: Record<T, number>;

  liveTab?: T;

}) {

  return (

    <div
      className="flex items-center gap-2 mb-6 overflow-x-auto pb-1"
      role="group"
      aria-label="Filter matches"
    >

      {tabs.map((tab) => (

        <button

          key={tab}

          type="button"

          onClick={() => onChange(tab)}

          aria-pressed={active === tab}

          className={cn(

            "flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",

            active === tab

              ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-glow)]"

              : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground",

          )}

        >

          {tab === liveTab ? (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" aria-hidden />
          ) : null}

          <span className="capitalize">{tab}</span>
          {tab === liveTab ? <span className="sr-only"> live</span> : null}

          <span className={cn(

            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",

            active === tab ? "bg-primary-foreground/20" : "bg-muted",

          )}>

            {counts[tab]}

          </span>

        </button>

      ))}

    </div>

  );

}



/** Match card inspired by auction player cards — glow border, status badges */

export function HubMatchCard({

  matchId,

  tournamentId,

  status,

  leftLabel,

  rightLabel,

  leftIdentity,

  rightIdentity,

  leftScore,

  rightScore,

  currentGame,

  gamesLeft,

  gamesRight,

  servingSide,

  courtNumber,

  roundName,

  matchLabel,

}: {

  matchId: number;

  tournamentId: number;

  status: string;

  leftLabel?: string;

  rightLabel?: string;

  leftIdentity?: import("@/lib/team-player-identity").TeamPlayerIdentity;

  rightIdentity?: import("@/lib/team-player-identity").TeamPlayerIdentity;

  leftScore?: number;

  rightScore?: number;

  currentGame?: number;

  gamesLeft?: number;

  gamesRight?: number;

  servingSide?: "left" | "right";

  courtNumber?: string;

  roundName?: string;

  matchLabel?: string;

}) {

  const isLive = status === "live";

  const isCompleted = status === "completed";

  const leftGlow = isLive ? "0 0 20px rgba(245, 158, 11, 0.35), 0 0 40px rgba(245, 158, 11, 0.15)" : undefined;

  const rightGlow = isLive ? "0 0 20px rgba(239, 68, 68, 0.35), 0 0 40px rgba(239, 68, 68, 0.15)" : undefined;



  return (

    <div

      className={cn(

        hubCardClass,

        "overflow-hidden transition-colors",

        isLive && "border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.12)]",

        !isLive && "hover:border-primary/25",

      )}

    >

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50">

        <div className="flex items-center gap-2">

          {isLive ? (

            <>

              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />

              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Live</span>

            </>

          ) : isCompleted ? (

            <Badge variant="secondary" className="text-green-400 border-green-500/30 bg-green-500/10">Completed</Badge>

          ) : status === "paused" ? (

            <Badge variant="outline" className="text-amber-300 border-amber-500/30 bg-amber-500/10">Paused</Badge>

          ) : (

            <Badge variant="outline">{status === "ready" ? "Ready" : "Scheduled"}</Badge>

          )}

        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono">

          {courtNumber && <span>Court {courtNumber}</span>}

          {roundName && <span>· {roundName}</span>}

        </div>

      </div>



      {leftLabel && rightLabel ? (

        <div className="p-4">

          <div className="flex items-center justify-between gap-3">

            <div className="flex-1 min-w-0">

              <div className="flex items-center gap-1.5 mb-1">

                {servingSide === "left" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}

                {leftIdentity ? (
                  <TeamPlayerCard
                    identity={leftIdentity}
                    size="xs"
                    layout="inline"
                    showBadge
                    className="min-w-0"
                    playerClassName="text-foreground font-semibold text-sm"
                    teamClassName="text-primary/80"
                  />
                ) : (
                  <p className="text-foreground font-semibold text-sm truncate">{leftLabel}</p>
                )}

              </div>

              <p

                className="text-primary text-4xl font-display font-bold leading-none tabular-nums"

                style={{ textShadow: leftGlow }}

              >

                {leftScore ?? 0}

              </p>

            </div>



            <div className="flex flex-col items-center gap-1 px-2">

              <div className="text-muted-foreground text-xs font-mono">G{currentGame ?? 1}</div>

              <div className="text-muted-foreground text-lg font-light">:</div>

              <div className="flex items-center gap-1.5 font-display font-bold text-sm text-muted-foreground">

                <span>{gamesLeft ?? 0}</span>

                <span>–</span>

                <span>{gamesRight ?? 0}</span>

              </div>

            </div>



            <div className="flex-1 min-w-0 text-right">

              <div className="flex items-center gap-1.5 mb-1 justify-end">

                {rightIdentity ? (
                  <TeamPlayerCard
                    identity={rightIdentity}
                    size="xs"
                    layout="inline"
                    align="end"
                    showBadge
                    className="min-w-0"
                    playerClassName="text-foreground font-semibold text-sm"
                    teamClassName="text-primary/80"
                  />
                ) : (
                  <p className="text-foreground font-semibold text-sm truncate">{rightLabel}</p>
                )}

                {servingSide === "right" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}

              </div>

              <p

                className="text-red-400 text-4xl font-display font-bold leading-none tabular-nums"

                style={{ textShadow: rightGlow }}

              >

                {rightScore ?? 0}

              </p>

            </div>

          </div>



          <div className="grid grid-cols-3 gap-2 mt-4">
            <Link
              href={badmintonMatchControlPath(tournamentId, matchId)}
              className="min-h-11 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 text-[11px] font-semibold flex items-center justify-center transition-colors text-center px-1"
            >
              Match Control
            </Link>
            {isLive ? (
              <Link
                href={badmintonScorerMatchPath(matchId, tournamentId)}
                className="min-h-11 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center justify-center transition-colors text-center px-1"
              >
                Scorer
              </Link>
            ) : (
              <span
                className="min-h-11 rounded-lg bg-muted/40 border border-border text-muted-foreground/50 text-[11px] font-semibold flex items-center justify-center text-center px-1"
                title="Start from Match Control first"
              >
                Scorer
              </span>
            )}
            <Link
              href={badmintonBroadcastPath(tournamentId, matchId)}
              className="min-h-11 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-[11px] font-semibold flex items-center justify-center transition-colors text-center px-1"
            >
              Broadcast
            </Link>
          </div>

        </div>

      ) : (

        <div className="p-4">

          <p className="text-muted-foreground text-sm text-center">{matchLabel ?? `Match #${matchId}`}</p>

        </div>

      )}

    </div>

  );

}
