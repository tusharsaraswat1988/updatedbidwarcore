import { useMemo } from "react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ExternalLink, Radio, MonitorPlay, Tv2, LayoutGrid, Table2, Trophy, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleWorkspace } from "@/components/platform/module-workspace";
import { displayScreenPath, sportsMissionControlPath } from "@/lib/tournament-navigation";
import { deriveModuleHealth } from "@/lib/module-workspace-utils";
import {
  useModuleWorkspaceRef,
  useRegisterModuleSnapshot,
} from "@/components/tournament-hub/use-module-registry";
import { getSportCapabilities } from "@/lib/sport-capabilities";
import type { SportLiveOpsLink } from "@/lib/sports-shell-types";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useTournamentScoringActive } from "@/hooks/use-platform-features";

const LIVE_OPS_ICONS: Record<string, ReactNode> = {
  dashboard: <MonitorPlay className="w-4 h-4" />,
  mission_control: <MonitorPlay className="w-4 h-4" />,
  match_center: <LayoutGrid className="w-4 h-4" />,
  standings: <Table2 className="w-4 h-4" />,
  statistics: <Trophy className="w-4 h-4" />,
  public: <Calendar className="w-4 h-4" />,
  broadcast: <Radio className="w-4 h-4" />,
};

function liveOpsIcon(link: SportLiveOpsLink): ReactNode {
  return LIVE_OPS_ICONS[link.id] ?? <MonitorPlay className="w-4 h-4" />;
}

/**
 * Live Operations — Sports Mission Control destination.
 * Deep-links into mature operational surfaces — does not rewrite them.
 * Capability-driven: never show cricket destinations for badminton (and vice versa).
 */
export function LiveOperationsModule({
  tournamentId,
  sport,
  onQuickPeek,
}: {
  tournamentId: number;
  sport?: string | null;
  onQuickPeek?: () => void;
}) {
  const caps = getSportCapabilities(sport);
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const sportsActive = useTournamentScoringActive(
    tournament?.sport ?? sport,
    tournament?.scoringEnabled,
  );

  const snapshot = useMemo(
    () => ({
      id: "live_operations" as const,
      health: deriveModuleHealth({ errorCount: 0, warningCount: 0, entityCount: sportsActive ? 1 : 0 }),
      errorCount: 0,
      warningCount: 0,
      validationIssues: [],
      recommendations: [],
      attentionItems: [],
      peekSummary: {
        title: "Live Operations",
        lines: sportsActive
          ? caps.liveOpsPeekLines
          : ["Sports not enabled for this tournament"],
      },
      entityCount: sportsActive ? 1 : 0,
      lockedCount: 0,
      loading: false,
    }),
    [caps.liveOpsPeekLines, sportsActive],
  );

  useRegisterModuleSnapshot(snapshot);
  const workspaceRef = useModuleWorkspaceRef("live_operations");

  return (
    <ModuleWorkspace
      id="live_operations"
      icon={Radio}
      title="Live Operations"
      description="Sport live control, LED, and broadcast destinations."
      health={snapshot.health}
      onQuickPeek={onQuickPeek}
      workspaceRef={workspaceRef}
    >
      {sportsActive ? (
        <LiveOperationsBody tournamentId={tournamentId} sport={sport} />
      ) : (
        <p className="text-sm text-muted-foreground px-1 py-2">
          Enable match scoring for this tournament to open Sports live destinations.
        </p>
      )}
    </ModuleWorkspace>
  );
}

/** @deprecated Use LiveOperationsModule — body-only export for compat */
export function LiveOperationsPanel({
  tournamentId,
  sport,
}: {
  tournamentId: number;
  sport?: string | null;
}) {
  return <LiveOperationsBody tournamentId={tournamentId} sport={sport} />;
}

function LiveOperationsBody({
  tournamentId,
  sport,
}: {
  tournamentId: number;
  sport?: string | null;
}) {
  const returnTo = sportsMissionControlPath(tournamentId);
  const encodedReturnTo = encodeURIComponent(returnTo);
  const caps = getSportCapabilities(sport);

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {caps.liveOpsLinks.map((link) => (
        <LiveOpsLink
          key={link.id}
          title={link.title}
          description={link.description}
          icon={liveOpsIcon(link)}
          href={link.buildHref({ tournamentId, encodedReturnTo })}
          external={link.external}
        />
      ))}

      <LiveOpsLink
        title="LED Display"
        description="Venue LED / big screen."
        icon={<Tv2 className="w-4 h-4" />}
        href={displayScreenPath(tournamentId)}
        onClick={() => {
          window.open(displayScreenPath(tournamentId), "_blank", "noopener,noreferrer");
        }}
        external
      />
    </ul>
  );
}

function LiveOpsLink({
  title,
  description,
  icon,
  href,
  onClick,
  external,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  onClick?: () => void;
  external?: boolean;
}) {
  const content = (
    <Button
      type="button"
      variant="outline"
      className="h-auto w-full justify-start gap-3 px-3 py-3 text-left"
      onClick={onClick}
    >
      <span className="text-primary shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground font-normal mt-0.5">
          {description}
        </span>
      </span>
      {external ? <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : null}
    </Button>
  );

  if (onClick) return <li>{content}</li>;

  return (
    <li>
      <Link href={href}>{content}</Link>
    </li>
  );
}
