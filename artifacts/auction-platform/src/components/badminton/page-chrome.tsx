import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BtnPrimary, hubCardClass, hubPanelClass } from "@/components/badminton/form-ui";
import { badmintonBroadcastPath } from "@/lib/badminton-broadcast-urls";
import { badmintonMatchControlPath, badmintonUmpireScorerPath } from "@/lib/badminton-routes";



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

} from "@/components/badminton/form-ui";



/** Auction-style page header for badminton hub pages */

export function PageHeader({

  title,

  subtitle,

  actions,

  eyebrow,

  badge,

}: {

  title: string;

  subtitle?: string;

  actions?: React.ReactNode;

  /** @deprecated Use BadmintonHubNav back link instead */

  backHref?: string;

  eyebrow?: string;

  badge?: string;

}) {

  return (

    <div className="border-b border-border px-6 py-6">

      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">

        <div>

          {eyebrow && (

            <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">{eyebrow}</p>

          )}

          <div className="flex items-center gap-3 flex-wrap">

            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">{title}</h1>

            {badge && (

              <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold tracking-widest uppercase">

                {badge}

              </span>

            )}

          </div>

          {subtitle && <p className="text-muted-foreground text-sm mt-1 font-mono">{subtitle}</p>}

        </div>

        {actions}

      </div>

    </div>

  );

}



export function EmptyState({

  icon: Icon,

  title,

  desc,

  action,

}: {

  icon: LucideIcon;

  title: string;

  desc: string;

  action?: {
    label: string;
    onClick?: () => void;
    /** Prefer href for SPA navigation (avoids full reload). */
    href?: string;
  };

}) {

  return (

    <div className="text-center py-16 px-4">

      <div className="inline-flex p-4 rounded-xl bg-primary/10 mb-4">

        <Icon className="w-8 h-8 text-primary" />

      </div>

      <h3 className="text-foreground font-display font-bold text-lg">{title}</h3>

      <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">{desc}</p>

      {action ? (

        <div className="mt-6">

          {action.href ? (

            <Link href={action.href}>

              <BtnPrimary type="button">{action.label}</BtnPrimary>

            </Link>

          ) : (

            <BtnPrimary type="button" onClick={action.onClick}>

              {action.label}

            </BtnPrimary>

          )}

        </div>

      ) : null}

    </div>

  );

}



/** KPI stat card — mirrors auction tournament-hub Card pattern */

export function HubKpiCard({

  label,

  value,

  icon: Icon,

  tint = "primary",

  pulse,

}: {

  label: string;

  value: number | string;

  icon: LucideIcon;

  tint?: "primary" | "amber" | "blue" | "green" | "red" | "purple" | "muted";

  pulse?: boolean;

}) {

  const tintMap = {

    primary: { well: "bg-primary/10", icon: "text-primary" },

    amber: { well: "bg-amber-500/10", icon: "text-amber-500" },

    blue: { well: "bg-blue-500/10", icon: "text-blue-500" },

    green: { well: "bg-green-500/10", icon: "text-green-500" },

    red: { well: "bg-red-500/10", icon: "text-red-500" },

    purple: { well: "bg-purple-500/10", icon: "text-purple-500" },

    muted: { well: "bg-muted/30", icon: "text-muted-foreground" },

  };

  const t = tintMap[tint];



  return (

    <Card className="bg-card border-border hover:border-primary/20 transition-colors">

      <CardContent className="p-5">

        <div className="flex justify-between items-start">

          <div className="space-y-2">

            <p className="text-sm font-medium text-muted-foreground">{label}</p>

            <p className="text-3xl font-display font-bold tabular-nums">{value}</p>

          </div>

          <div className={cn("p-3 rounded-lg relative", t.well)}>

            <Icon className={cn("w-5 h-5", t.icon)} />

            {pulse && (

              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />

            )}

          </div>

        </div>

      </CardContent>

    </Card>

  );

}



export function HubSectionHeader({

  title,

  subtitle,

  badge,

  badgeVariant = "default",

}: {

  title: string;

  subtitle?: string;

  badge?: string;

  badgeVariant?: "default" | "destructive" | "secondary" | "outline";

}) {

  return (

    <div className="flex items-baseline gap-3 flex-wrap">

      <h2 className="text-lg font-display font-bold text-foreground">{title}</h2>

      {badge && <Badge variant={badgeVariant}>{badge}</Badge>}

      {subtitle && <span className="text-muted-foreground text-sm">{subtitle}</span>}

    </div>

  );

}



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

                <p className="text-foreground font-semibold text-sm truncate">{leftLabel}</p>

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

                <p className="text-foreground font-semibold text-sm truncate">{rightLabel}</p>

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
                href={badmintonUmpireScorerPath(matchId, tournamentId)}
                className="min-h-11 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center justify-center transition-colors text-center px-1"
              >
                Umpire
              </Link>
            ) : (
              <span
                className="min-h-11 rounded-lg bg-muted/40 border border-border text-muted-foreground/50 text-[11px] font-semibold flex items-center justify-center text-center px-1"
                title="Start from Match Control first"
              >
                Umpire
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
