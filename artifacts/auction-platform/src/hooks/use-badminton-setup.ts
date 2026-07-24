import { useQuery } from "@tanstack/react-query";
import { useBadmintonDashboard } from "@/hooks/use-badminton-match";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { useBadmintonScoringFormat } from "@/hooks/use-badminton-scoring-format";
import { badmintonFetch } from "@/lib/badminton-api";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  evaluateBadmintonSetup,
  getNextSetupStep,
  getSetupStepById,
  isTournamentSetupReady,
  markWizardCompleted,
  readWizardCompleted,
  setupProgress,
  type BadmintonSetupItem,
  type BadmintonSetupSnapshot,
  type BadmintonSetupStepId,
} from "@/lib/badminton-setup-workflow";

const wizardCompletedListeners = new Set<() => void>();

function subscribeWizardCompleted(onStoreChange: () => void) {
  wizardCompletedListeners.add(onStoreChange);
  return () => {
    wizardCompletedListeners.delete(onStoreChange);
  };
}

function emitWizardCompleted() {
  wizardCompletedListeners.forEach((listener) => listener());
}

export function completeBadmintonSetupWizard(tournamentId: number) {
  markWizardCompleted(tournamentId);
  emitWizardCompleted();
}

/** Defer fixtures list until after first paint — setup chrome doesn't need it. */
function useDeferredFixturesEnabled(tournamentId: number) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(() => {
        if (!cancelled) setEnabled(true);
      }, { timeout: 2500 });
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(id);
      };
    }
    const timer = window.setTimeout(() => {
      if (!cancelled) setEnabled(true);
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tournamentId]);
  return enabled;
}

export function useBadmintonSetup(tournamentId: number) {
  const { data, isLoading: dashboardLoading } = useBadmintonDashboard(tournamentId);
  const { data: branding, isLoading: brandingLoading } = useBadmintonBranding(tournamentId);
  const { data: scoringFormat, isLoading: formatLoading } =
    useBadmintonScoringFormat(tournamentId);

  const wizardCompleted = useSyncExternalStore(
    subscribeWizardCompleted,
    () => readWizardCompleted(tournamentId),
    () => false,
  );

  const fixturesEnabled = useDeferredFixturesEnabled(tournamentId);
  const { data: fixtures = [], isLoading: fixturesLoading } = useQuery({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () =>
      badmintonFetch<
        Array<{ id: number; courtId?: number | null; scheduledAt?: string | null }>
      >(tournamentId, `/fixtures`),
    enabled: !!tournamentId && fixturesEnabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const totalScheduledFixtures = fixtures.filter(
    (f) => f.courtId != null && f.scheduledAt != null,
  ).length;

  const totalMatches =
    (data?.matchesScheduled ?? 0) +
    (data?.matchesLive ?? 0) +
    (data?.matchesCompleted ?? 0);

  // Existing tournaments that already created matches skip the Ready gate
  const wizardCompletedEffective = wizardCompleted || totalMatches > 0;

  const snapshot: BadmintonSetupSnapshot = {
    brandingComplete: Boolean(branding?.displayName?.trim()),
    totalPlayers: data?.totalPlayers ?? 0,
    totalCategories: data?.totalCategories ?? 0,
    scoringFormatConfigured: Boolean(scoringFormat?.configured),
    totalFixtures: fixtures.length,
    totalCourts: data?.totalCourts ?? 0,
    totalScheduledFixtures,
    wizardCompleted: wizardCompletedEffective,
  };

  const items = evaluateBadmintonSetup(snapshot);
  const progress = setupProgress(items);
  const next = getNextSetupStep(items);
  const ready = isTournamentSetupReady(items);

  return {
    snapshot,
    items,
    progress,
    next,
    ready,
    dashboard: data,
    branding,
    scoringFormat,
    fixtures,
    // Fixtures are only needed for structure/schedule chapter markers — don't
    // block setup chrome (branding/courts/rules) on the full fixtures list.
    isLoading: dashboardLoading || brandingLoading || formatLoading,
    fixturesLoading,
    getStep: (stepId: BadmintonSetupStepId): BadmintonSetupItem | null =>
      getSetupStepById(items, stepId),
  };
}
