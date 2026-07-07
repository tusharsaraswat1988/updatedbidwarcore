import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuctionState, Player, TeamPurse, Tournament } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { parsePresentationContext, type PresentationContext } from "@/lib/presentation-context";
import {
  deriveAuctionDisplayMode,
  outcomeEventKey,
  soldRecordFromOutcome,
  unsoldRecordFromOutcome,
} from "@/lib/auction-display-status";
import { cldUrl } from "@/lib/cloudinary";
import type { BroadcastSettings } from "./types";
import { DEFAULT_BROADCAST_SETTINGS } from "./types";
import { BroadcastDirector } from "./director/broadcast-director";
import { broadcastDirectorDiagnostics } from "./director/diagnostics";
import { composeLayout } from "./director/layout-composer";
import { preloadUrlsInBrowser } from "./director/preload-manager";
import { computeAuctionInputKey } from "./director/snapshot-key";
import type { BroadcastFrame, BroadcastOutputTarget, DirectorContext } from "./director/types";
import { BROADCAST_TRANSITION_MS, themePalette } from "./tokens";

export type UseBroadcastDirectorInput = {
  tournamentId: number;
  outputTarget?: BroadcastOutputTarget;
  state: AuctionState | undefined;
  teamPurses: TeamPurse[] | undefined;
  soldPlayers: Player[] | undefined;
  tournament: Tournament | undefined;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  auctionStartsAt: string | null;
  sponsorLogos: SponsorLogo[];
  settings: BroadcastSettings;
  isObsMode: boolean;
  isStaleFeed: boolean;
  formatAmount: (n: number) => string;
  onAudioCue?: (cue: BroadcastFrame["audioCues"][number]) => void;
};

const PLACEHOLDER_PALETTE = themePalette(DEFAULT_BROADCAST_SETTINGS.theme);

const PLACEHOLDER_FRAME: BroadcastFrame = {
  frameId: "WAITING-0",
  sceneId: "WAITING",
  currentContext: "WAITING",
  outputTarget: "obs",
  transition: { from: null, to: "WAITING", active: false, durationMs: BROADCAST_TRANSITION_MS },
  layout: composeLayout("obs"),
  chrome: {
    tournamentName: null,
    tournamentLogoUrl: null,
    sponsorLogos: [],
    sponsorRotationMs: DEFAULT_BROADCAST_SETTINGS.sponsorRotationSpeedSec * 1000,
    themeAccent: PLACEHOLDER_PALETTE.accent,
    showTopBar: false,
    showSponsorTicker: true,
    showConnectionBanner: true,
  },
  palette: { theme: DEFAULT_BROADCAST_SETTINGS.theme, ...PLACEHOLDER_PALETTE },
  scene: { kind: "WAITING", tournamentLogoSrc: null, countdownTargetIso: null, standbyLabel: "STANDBY" },
  top5: null,
  team: null,
  teamOverviews: [],
  widgets: [],
  cameraFeeds: [],
  preloadUrls: [],
  audioCues: [],
  obsPerformanceMode: true,
  isStaleFeed: false,
  settings: DEFAULT_BROADCAST_SETTINGS,
};

function computeSummaryFromState(
  state: AuctionState | undefined,
  teamPurses: TeamPurse[] | undefined,
) {
  let summaryTopBuyerSpend = 0;
  let summaryTopBuyerName: string | null = null;
  let summaryHighestTeamSpend = 0;
  let summaryHighestTeamName: string | null = null;

  for (const t of teamPurses ?? []) {
    const spent = t.purseUsed ?? 0;
    if (spent > summaryTopBuyerSpend) {
      summaryTopBuyerSpend = spent;
      summaryTopBuyerName = t.teamName;
    }
    if (spent > summaryHighestTeamSpend) {
      summaryHighestTeamSpend = spent;
      summaryHighestTeamName = t.teamName;
    }
  }

  const outcome = state?.outcome;
  return {
    summarySold: state?.soldPlayersCount ?? 0,
    summaryUnsold: state?.unsoldPlayersCount ?? 0,
    summaryRemaining: state?.remainingPlayersCount ?? 0,
    summaryHighestBid: outcome?.type === "sold" ? (outcome.amount ?? 0) : 0,
    summaryHighestBidPlayer: outcome?.type === "sold" ? (outcome.playerName ?? null) : null,
    summaryTopBuyerName,
    summaryTopBuyerSpend,
    summaryHighestTeamSpend,
    summaryHighestTeamName,
  };
}

function buildDirectorContext(
  input: UseBroadcastDirectorInput,
  displayMode: ReturnType<typeof deriveAuctionDisplayMode>,
  outcomeKey: string | null,
  sold: ReturnType<typeof soldRecordFromOutcome>,
  unsold: ReturnType<typeof unsoldRecordFromOutcome>,
  summary: ReturnType<typeof computeSummaryFromState>,
  nowMs: number,
): DirectorContext {
  const { state, settings, formatAmount } = input;
  const player = state?.currentPlayer;

  return {
    tournamentId: input.tournamentId,
    outputTarget: input.outputTarget ?? "obs",
    tournamentName: input.tournamentName,
    tournamentLogoUrl: input.tournamentLogoUrl,
    auctionStartsAt: input.auctionStartsAt,
    sponsorLogos: input.sponsorLogos,
    settings,
    isObsMode: input.isObsMode,
    isStaleFeed: input.isStaleFeed,
    formatAmount,
    resolvePhotoSrc: (url, preset) => (url ? cldUrl(url, preset) : null),
    auctionStatus: state?.status ?? "idle",
    currentPlayerId: player?.id ?? null,
    currentBid: state?.currentBid ?? null,
    currentBidTeamId: state?.currentBidTeamId ?? null,
    currentBidTeamName: state?.currentBidTeamName ?? null,
    currentBidTeamColor: state?.currentBidTeamColor ?? null,
    currentBidTeamLogoUrl: state?.currentBidTeamLogoUrl ?? null,
    timerEndsAt: state?.timerEndsAt ?? null,
    remainingPlayersCount: state?.remainingPlayersCount ?? null,
    currentCategoryName: state?.currentCategoryName ?? null,
    playerName: player?.name ?? null,
    playerPhotoUrl: player?.photoUrl ?? null,
    playerRole: player?.role ?? null,
    playerCity: player?.city ?? null,
    playerBasePrice: player?.basePrice ?? null,
    playerTag: (player as { playerTag?: string | null } | undefined)?.playerTag ?? null,
    displayIsBreak: displayMode.isBreak,
    breakEndsAt: displayMode.breakEndsAt,
    breakMessage: displayMode.breakMessage,
    outcomeType: displayMode.outcome?.type ?? null,
    outcomeKey,
    outcomeIsManual: displayMode.outcome?.isManual ?? false,
    soldPlayerName: sold?.playerName ?? displayMode.outcome?.record?.playerName ?? null,
    soldPhotoUrl: sold?.photoUrl ?? displayMode.outcome?.record?.photoUrl ?? null,
    soldAmount: sold?.amount ?? displayMode.outcome?.record?.amount ?? null,
    soldTeamName: sold?.teamName ?? displayMode.outcome?.record?.teamName ?? null,
    soldTeamColor: sold?.teamColor ?? displayMode.outcome?.record?.teamColor ?? null,
    soldTeamLogoUrl: sold?.teamLogoUrl ?? displayMode.outcome?.record?.teamLogoUrl ?? null,
    unsoldPlayerName: unsold?.playerName ?? displayMode.outcome?.record?.playerName ?? null,
    unsoldPhotoUrl: unsold?.photoUrl ?? displayMode.outcome?.record?.photoUrl ?? null,
    presentationContext: readPresentationContext(state),
    teamPurses: input.teamPurses,
    soldPlayers: input.soldPlayers,
    ...summary,
    nowMs,
  };
}

function readPresentationContext(state: AuctionState | undefined): PresentationContext {
  return parsePresentationContext(
    (state as { presentationContext?: unknown } | undefined)?.presentationContext,
  );
}

function framesEqual(a: BroadcastFrame, b: BroadcastFrame): boolean {
  return (
    a.frameId === b.frameId &&
    a.sceneId === b.sceneId &&
    a.currentContext === b.currentContext &&
    a.transition.active === b.transition.active &&
    a.transition.from === b.transition.from &&
    a.transition.to === b.transition.to
  );
}

export function useBroadcastDirector(input: UseBroadcastDirectorInput): BroadcastFrame {
  const directorRef = useRef<BroadcastDirector | null>(null);
  if (!directorRef.current) {
    directorRef.current = new BroadcastDirector();
    broadcastDirectorDiagnostics.recordDirectorRebuild();
  }
  const director = directorRef.current;

  const inputRef = useRef(input);
  inputRef.current = input;

  const onAudioCueRef = useRef(input.onAudioCue);
  onAudioCueRef.current = input.onAudioCue;

  const [frame, setFrame] = useState<BroadcastFrame>(PLACEHOLDER_FRAME);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledHoldKeyRef = useRef<string | null>(null);
  const scheduledTransitionKeyRef = useRef<string | null>(null);
  const lastCuesRef = useRef<Set<string>>(new Set());

  const displayMode = useMemo(
    () => deriveAuctionDisplayMode(input.state),
    [
      input.state?.status,
      input.state?.lastAction,
      input.state?.outcome,
      input.state?.displayCountdown,
    ],
  );

  const outcomeKey = useMemo(
    () => outcomeEventKey(displayMode.outcome),
    [displayMode.outcome],
  );

  const sold = useMemo(() => soldRecordFromOutcome(displayMode.outcome), [displayMode.outcome]);
  const unsold = useMemo(() => unsoldRecordFromOutcome(displayMode.outcome), [displayMode.outcome]);

  const summary = useMemo(
    () => computeSummaryFromState(input.state, input.teamPurses),
    [
      input.state?.soldPlayersCount,
      input.state?.unsoldPlayersCount,
      input.state?.remainingPlayersCount,
      input.state?.outcome,
      input.teamPurses,
    ],
  );

  const auctionInputKey = useMemo(
    () =>
      computeAuctionInputKey({
        tournamentId: input.tournamentId,
        outputTarget: input.outputTarget,
        tournamentName: input.tournamentName,
        tournamentLogoUrl: input.tournamentLogoUrl,
        auctionStartsAt: input.auctionStartsAt,
        sponsorLogos: input.sponsorLogos,
        settings: input.settings,
        isObsMode: input.isObsMode,
        isStaleFeed: input.isStaleFeed,
        state: input.state,
        teamPurses: input.teamPurses,
        soldPlayers: input.soldPlayers,
        presentationContext: readPresentationContext(input.state),
        displayIsBreak: displayMode.isBreak,
        breakEndsAt: displayMode.breakEndsAt,
        breakMessage: displayMode.breakMessage,
        outcomeKey,
        summarySold: summary.summarySold,
        summaryUnsold: summary.summaryUnsold,
        summaryRemaining: summary.summaryRemaining,
        summaryHighestBid: summary.summaryHighestBid,
        summaryTopBuyerName: summary.summaryTopBuyerName,
        summaryHighestTeamSpend: summary.summaryHighestTeamSpend,
      }),
    [
      input.tournamentId,
      input.outputTarget,
      input.tournamentName,
      input.tournamentLogoUrl,
      input.auctionStartsAt,
      input.sponsorLogos,
      input.settings,
      input.isObsMode,
      input.isStaleFeed,
      input.state,
      input.teamPurses,
      input.soldPlayers,
      (input.state as { presentationContext?: unknown } | undefined)?.presentationContext,
      displayMode.isBreak,
      displayMode.breakEndsAt,
      displayMode.breakMessage,
      outcomeKey,
      summary,
    ],
  );

  const runTick = useCallback(
    (nowMs: number) => {
      const currentInput = inputRef.current;
      const mode = deriveAuctionDisplayMode(currentInput.state);
      const key = outcomeEventKey(mode.outcome);
      const soldRecord = soldRecordFromOutcome(mode.outcome);
      const unsoldRecord = unsoldRecordFromOutcome(mode.outcome);
      const summarySnapshot = computeSummaryFromState(currentInput.state, currentInput.teamPurses);

      const ctx = buildDirectorContext(
        currentInput,
        mode,
        key,
        soldRecord,
        unsoldRecord,
        summarySnapshot,
        nowMs,
      );

      const result = director.tick(ctx);

      setFrame((prev) => {
        const changed = !framesEqual(prev, result.frame);
        broadcastDirectorDiagnostics.recordSetFrame(changed);
        return changed ? result.frame : prev;
      });

      if (result.frame.transition.active) {
        const transitionKey = `${result.frame.transition.from ?? ""}->${result.frame.transition.to}`;
        if (scheduledTransitionKeyRef.current !== transitionKey) {
          scheduledTransitionKeyRef.current = transitionKey;
          if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = setTimeout(() => {
            director.completeTransition();
            runTick(Date.now());
          }, BROADCAST_TRANSITION_MS);
        }
      } else {
        scheduledTransitionKeyRef.current = null;
      }

      if (result.sceneHoldMs > 0 && result.sceneHoldDurationMs > 0) {
        const holdKey = `${result.frame.sceneId}-${director.getState().ephemeralHoldKey ?? result.frame.sceneId}`;
        if (scheduledHoldKeyRef.current !== holdKey) {
          scheduledHoldKeyRef.current = holdKey;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            const holdInput = inputRef.current;
            const holdMode = deriveAuctionDisplayMode(holdInput.state);
            const holdCtx = buildDirectorContext(
              holdInput,
              holdMode,
              outcomeEventKey(holdMode.outcome),
              soldRecordFromOutcome(holdMode.outcome),
              unsoldRecordFromOutcome(holdMode.outcome),
              computeSummaryFromState(holdInput.state, holdInput.teamPurses),
              Date.now(),
            );
            director.completeEphemeralHold(holdCtx);
            scheduledHoldKeyRef.current = null;
            runTick(Date.now());
          }, result.sceneHoldDurationMs);
        }
      } else {
        scheduledHoldKeyRef.current = null;
      }

      preloadUrlsInBrowser(result.frame.preloadUrls, (url) => director.preloads.markLoaded(url));

      const onAudioCue = onAudioCueRef.current;
      if (onAudioCue) {
        for (const cue of result.frame.audioCues) {
          if (!lastCuesRef.current.has(cue.id)) {
            lastCuesRef.current.add(cue.id);
            onAudioCue(cue);
          }
        }
      }
    },
    [director],
  );

  useEffect(() => {
    runTick(Date.now());
  }, [auctionInputKey, runTick]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => director.reset();
  }, [input.tournamentId, director]);

  return frame;
}
