import { Link } from "wouter";
import {
  Sparkles,
  MapPin,
  Sliders,
  Users,
  UserCog,
  Layers,
  GitBranch,
  Trophy,
  FileText,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number | null;
  badgeColor?: string;
  description?: string;
}

interface SegmentedTabsProps {
  items: TabItem[];
  activeId: string;
  className?: string;
}

export function BadmintonSegmentedTabs({
  items,
  activeId,
  className,
}: SegmentedTabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 p-1 bg-card/80 border border-border/70 rounded-xl backdrop-blur-md shadow-xs overflow-x-auto no-scrollbar",
        className,
      )}
      role="tablist"
      aria-label="Section Navigation"
    >
      {items.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeId;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "group relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 select-none",
              isActive
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Icon
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-150 group-hover:scale-110",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground group-hover:text-primary",
              )}
              aria-hidden="true"
            />
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums leading-tight",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : tab.badgeColor || "bg-muted text-muted-foreground group-hover:text-foreground",
                )}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** Setup Chapter: Identity & Branding · Courts · Rules */
export function BadmintonSetupTabs({
  tournamentId,
  activeSection,
  courtsCount,
  formatLabel,
  className,
}: {
  tournamentId: number;
  activeSection: "identity" | "courts" | "rules";
  courtsCount?: number;
  formatLabel?: string;
  className?: string;
}) {
  const items: TabItem[] = [
    {
      id: "identity",
      label: "Identity & Branding",
      href: `/tournament/${tournamentId}/badminton/branding`,
      icon: Sparkles,
    },
    {
      id: "courts",
      label: "Courts & Venues",
      href: `/tournament/${tournamentId}/badminton/branding?section=courts`,
      icon: MapPin,
      badge: courtsCount !== undefined ? courtsCount : null,
    },
    {
      id: "rules",
      label: "Rules & Scoring Format",
      href: `/tournament/${tournamentId}/badminton/branding?section=rules`,
      icon: Sliders,
      badge: formatLabel || null,
      badgeColor: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    },
  ];

  return <BadmintonSegmentedTabs items={items} activeId={activeSection} className={className} />;
}

/** Participants Chapter: Players & Rosters · Officials & Scorers */
export function BadmintonParticipantTabs({
  tournamentId,
  activeSection,
  playersCount,
  officialsCount,
  className,
}: {
  tournamentId: number;
  activeSection: "players" | "officials";
  playersCount?: number;
  officialsCount?: number;
  className?: string;
}) {
  const items: TabItem[] = [
    {
      id: "players",
      label: "Players & Rosters",
      href: `/tournament/${tournamentId}/badminton/players`,
      icon: Users,
      badge: playersCount !== undefined ? playersCount : null,
    },
    {
      id: "officials",
      label: "Officials & Scorers",
      href: `/tournament/${tournamentId}/badminton/players?section=officials`,
      icon: UserCog,
      badge: officialsCount !== undefined ? officialsCount : null,
    },
  ];

  return <BadmintonSegmentedTabs items={items} activeId={activeSection} className={className} />;
}

/** Fixtures Chapter: Events & Categories · Draw & Brackets */
export function BadmintonFixtureTabs({
  tournamentId,
  activeSection,
  eventsCount,
  fixturesCount,
  className,
}: {
  tournamentId: number;
  activeSection: "events" | "draw";
  eventsCount?: number;
  fixturesCount?: number;
  className?: string;
}) {
  const items: TabItem[] = [
    {
      id: "events",
      label: "Events & Categories",
      href: `/tournament/${tournamentId}/badminton/fixtures?section=events`,
      icon: Layers,
      badge: eventsCount !== undefined ? eventsCount : null,
    },
    {
      id: "draw",
      label: "Draw & Brackets",
      href: `/tournament/${tournamentId}/badminton/fixtures?section=draw`,
      icon: GitBranch,
      badge: fixturesCount !== undefined ? `${fixturesCount} matches` : null,
    },
  ];

  return <BadmintonSegmentedTabs items={items} activeId={activeSection} className={className} />;
}

/** Results Chapter: Standings & Podiums · Tournament Summary · Match Analytics */
export function BadmintonResultTabs({
  tournamentId,
  activeSection,
  className,
}: {
  tournamentId: number;
  activeSection: "standings" | "summary" | "insights";
  className?: string;
}) {
  const items: TabItem[] = [
    {
      id: "standings",
      label: "Standings & Podiums",
      href: `/tournament/${tournamentId}/badminton/results`,
      icon: Trophy,
    },
    {
      id: "summary",
      label: "Tournament Summary",
      href: `/tournament/${tournamentId}/badminton/summary`,
      icon: FileText,
    },
    {
      id: "insights",
      label: "Match Analytics & Insights",
      href: `/tournament/${tournamentId}/badminton/analytics`,
      icon: BarChart3,
    },
  ];

  return <BadmintonSegmentedTabs items={items} activeId={activeSection} className={className} />;
}
