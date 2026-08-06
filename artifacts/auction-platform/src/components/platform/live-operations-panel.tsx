import { useMemo } from "react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ExternalLink, Radio, MonitorPlay, Tv2, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleWorkspace } from "@/components/platform/module-workspace";
import {
  auctionRoomPath,
  displayScreenPath,
  openAuctionRoom,
  setupAreaPath,
} from "@/lib/tournament-navigation";
import { badmintonHubPath } from "@/lib/badminton-routes";
import { deriveModuleHealth } from "@/lib/module-workspace-utils";
import {
  useModuleWorkspaceRef,
  useRegisterModuleSnapshot,
} from "@/components/tournament-hub/use-module-registry";

/**
 * Live Operations
 * First-class destination under Tournament Mission Control.
 * Deep-links into mature operational surfaces — does not rewrite them.
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
  const sportKey = (sport ?? "").toLowerCase();
  const isBadminton = sportKey === "badminton";
  const isCricket = sportKey === "cricket";

  const snapshot = useMemo(
    () => ({
      id: "live_operations" as const,
      health: deriveModuleHealth({ errorCount: 0, warningCount: 0, entityCount: 1 }),
      errorCount: 0,
      warningCount: 0,
      validationIssues: [],
      recommendations: [],
      attentionItems: [],
      peekSummary: {
        title: "Live Operations",
        lines: [
          isBadminton ? "Badminton Mission Control" : "Auction / sport live control",
          "LED display",
          isBadminton ? "Broadcast / OBS" : "OBS / Presentation",
        ],
      },
      entityCount: 1,
      lockedCount: 0,
      loading: false,
    }),
    [isBadminton],
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
      <LiveOperationsBody tournamentId={tournamentId} sport={sport} />
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
  const returnTo = setupAreaPath(tournamentId);
  const from = encodeURIComponent(returnTo);
  const sportKey = (sport ?? "").toLowerCase();
  const isBadminton = sportKey === "badminton";
  const isCricket = sportKey === "cricket";

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {!isBadminton ? (
        <LiveOpsLink
          title="Auction Live Control"
          description="Operator board for live auction."
          icon={<LayoutGrid className="w-4 h-4" />}
          onClick={() => openAuctionRoom(tournamentId)}
          href={auctionRoomPath(tournamentId)}
          external
        />
      ) : null}

      {isBadminton ? (
        <LiveOpsLink
          title="Badminton Mission Control"
          description="Courts, queues, and live match control."
          icon={<MonitorPlay className="w-4 h-4" />}
          href={`${badmintonHubPath(tournamentId)}/control?from=${from}`}
        />
      ) : null}

      {isCricket ? (
        <LiveOpsLink
          title="Cricket Live Control"
          description="Scoring and cricket live operations."
          icon={<MonitorPlay className="w-4 h-4" />}
          href={`/tournament/${tournamentId}/scoring?from=${from}`}
        />
      ) : null}

      <LiveOpsLink
        title="LED Display"
        description="Venue LED / big screen."
        icon={<Tv2 className="w-4 h-4" />}
        href={displayScreenPath(tournamentId)}
        external
      />

      {isBadminton ? (
        <LiveOpsLink
          title="Broadcast / OBS"
          description="Badminton broadcast director surfaces."
          icon={<Radio className="w-4 h-4" />}
          href={`${badmintonHubPath(tournamentId)}/broadcast?from=${from}`}
        />
      ) : (
        <LiveOpsLink
          title="OBS / Presentation"
          description="Presentation engine surfaces."
          icon={<Radio className="w-4 h-4" />}
          href={`/tournament/${tournamentId}/display?from=${from}`}
          external
        />
      )}
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
