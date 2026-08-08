import { useMemo, useState } from "react";
import type { AttentionItem } from "@/components/platform/attention-center";
import type { ModuleHealthEntry } from "@/components/platform/tournament-health";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";
import { ModuleQuickPeek } from "@/components/platform/module-quick-peek";
import { CompetitionSetupCard } from "@/components/tournament-hub/competition-setup-card";
import { TeamSetupCard } from "@/components/tournament-hub/team-setup-card";
import { MatchSetupCard } from "@/components/tournament-hub/match-setup-card";
import { FixtureSetupCard } from "@/components/tournament-hub/fixture-setup-card";
import { SchedulingSetupCard } from "@/components/tournament-hub/scheduling-setup-card";
import { RuntimePreparationCard } from "@/components/tournament-hub/runtime-preparation-card";
import { LiveOperationsModule } from "@/components/platform/live-operations-panel";
import { useModuleSnapshots, useScrollToModule } from "@/components/tournament-hub/use-module-registry";
import {
  buildDefaultModuleHealth,
  TMC_PIPELINE_ORDER,
} from "@/lib/tournament-mission-control";
import { collectModuleHealthFromSnapshots } from "@/lib/module-workspace-utils";
import { cn } from "@/lib/utils";

/**
 * Keeps all foundation modules mounted so ModuleRegistry snapshots stay
 * authoritative. Visual presentation is controlled by the Mission Control
 * experience layer (focus / setup-details), not by stacking cards as the
 * primary organiser dashboard.
 */
export function TournamentMissionControlModules({
  tournamentId,
  sport,
  focusModuleId = null,
  showAll = false,
  className,
}: {
  tournamentId: number;
  sport?: string | null;
  /** When set (and showAll is false), only this module is visually shown. */
  focusModuleId?: ModuleWorkspaceId | null;
  /** Show the full advanced module stack (View setup details). */
  showAll?: boolean;
  className?: string;
}) {
  const [peekModuleId, setPeekModuleId] = useState<ModuleWorkspaceId | null>(null);
  const snapshots = useModuleSnapshots();
  const openPeek = (id: ModuleWorkspaceId) => () => setPeekModuleId(id);

  const peekSnapshot = peekModuleId ? snapshots[peekModuleId] : null;

  const visible = (id: ModuleWorkspaceId) => {
    if (showAll) return true;
    if (focusModuleId) return focusModuleId === id;
    return false;
  };

  return (
    <>
      <div className={cn("space-y-6", className)}>
        <div className={cn(!visible("competition") && "hidden")} aria-hidden={!visible("competition")}>
          <CompetitionSetupCard tournamentId={tournamentId} onQuickPeek={openPeek("competition")} />
        </div>
        <div className={cn(!visible("teams") && "hidden")} aria-hidden={!visible("teams")}>
          <TeamSetupCard tournamentId={tournamentId} onQuickPeek={openPeek("teams")} />
        </div>
        <div className={cn(!visible("fixtures") && "hidden")} aria-hidden={!visible("fixtures")}>
          <FixtureSetupCard tournamentId={tournamentId} onQuickPeek={openPeek("fixtures")} />
        </div>
        <div className={cn(!visible("scheduling") && "hidden")} aria-hidden={!visible("scheduling")}>
          <SchedulingSetupCard tournamentId={tournamentId} onQuickPeek={openPeek("scheduling")} />
        </div>
        <div className={cn(!visible("matches") && "hidden")} aria-hidden={!visible("matches")}>
          <MatchSetupCard tournamentId={tournamentId} onQuickPeek={openPeek("matches")} />
        </div>
        <div className={cn(!visible("runtime") && "hidden")} aria-hidden={!visible("runtime")}>
          <RuntimePreparationCard tournamentId={tournamentId} onQuickPeek={openPeek("runtime")} />
        </div>
        <div
          className={cn(!visible("live_operations") && "hidden")}
          aria-hidden={!visible("live_operations")}
        >
          <LiveOperationsModule
            tournamentId={tournamentId}
            sport={sport}
            onQuickPeek={openPeek("live_operations")}
          />
        </div>
      </div>

      <ModuleQuickPeek
        open={peekModuleId != null}
        onOpenChange={(open) => {
          if (!open) setPeekModuleId(null);
        }}
        title={peekSnapshot?.peekSummary.title ?? "Module summary"}
        description="Cross-module quick peek — full editing stays in the module body."
      >
        {peekSnapshot ? (
          <ul className="space-y-2">
            {peekSnapshot.peekSummary.lines.map((line) => (
              <li
                key={line}
                className="text-sm text-muted-foreground rounded-md border border-border/40 px-3 py-2"
              >
                {line}
              </li>
            ))}
            {peekSnapshot.validationIssues.length > 0 ? (
              <li className="text-xs text-muted-foreground pt-2">
                {peekSnapshot.errorCount} blocker{peekSnapshot.errorCount === 1 ? "" : "s"},{" "}
                {peekSnapshot.warningCount} warning{peekSnapshot.warningCount === 1 ? "" : "s"}
              </li>
            ) : null}
          </ul>
        ) : null}
      </ModuleQuickPeek>
    </>
  );
}

export function useTournamentModuleOrchestration(input: {
  isSetupPhase: boolean;
  readinessComplete: boolean;
  readinessAttention: AttentionItem[];
}) {
  const snapshots = useModuleSnapshots();
  const scrollToModule = useScrollToModule();

  const moduleAttention = useMemo(() => {
    const items: AttentionItem[] = [];
    for (const snapshot of Object.values(snapshots)) {
      if (!snapshot) continue;
      items.push(...snapshot.attentionItems);
    }
    return items;
  }, [snapshots]);

  const attentionItems = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...input.readinessAttention, ...moduleAttention];
    return merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [input.readinessAttention, moduleAttention]);

  const moduleHealth: ModuleHealthEntry[] = useMemo(() => {
    if (Object.keys(snapshots).length === 0) {
      return buildDefaultModuleHealth({
        isSetupPhase: input.isSetupPhase,
        readinessComplete: input.readinessComplete,
      });
    }
    return collectModuleHealthFromSnapshots(snapshots, TMC_PIPELINE_ORDER);
  }, [snapshots, input.isSetupPhase, input.readinessComplete]);

  return { attentionItems, moduleHealth, scrollToModule, snapshots };
}
