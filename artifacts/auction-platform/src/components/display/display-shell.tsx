import { useMemo } from "react";
import { useFortuneWheelBroadcastLive } from "./use-fortune-wheel-broadcast-live";
import { useStickyCountdown } from "@/hooks/use-sticky-countdown";
import { Volume2 } from "lucide-react";
import {
  useGetAuctionState,
  useGetTeamPurses,
  useGetTournament,
  useListPlayers,
  useListCategories,
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  getGetTournamentQueryKey,
  getListPlayersQueryKey,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { FullscreenLayout } from "@/components/layout";
import { StaticBackground } from "./static-background";
import { AuctionHeader } from "./auction-header";
import type { DisplayTheme } from "@/lib/display-theme";
import { parseSponsorLogos } from "@/lib/sponsor-logo";
import { PlayerCard } from "./player-card";
import { BidDisplay } from "./bid-display";
import { IdleScreen } from "./idle-screen";
import { AnimatedEffectsLayer } from "./animated-effects-layer";
import { OverlayManager } from "./overlay-manager";
import { SponsorTicker } from "./sponsor-ticker";
import { Top5Overlay } from "./top5-overlay";
import { BreakCountdownOverlay } from "./break-countdown-overlay";
import { AuctionStatusOverlay } from "./auction-status-overlay";
import { DisplayConnectionBanner } from "./display-connection-banner";
import {
  deriveAuctionDisplayMode,
  soldRecordFromOutcome,
  unsoldRecordFromOutcome,
} from "@/lib/auction-display-status";
import { BROADCAST_MAIN_WIDTH, BROADCAST_SAFE_MAIN } from "@/lib/display-broadcast-layout";
import { PurseUpdatedToast } from "./purse-updated-toast";
import { useSoldAnimation } from "./use-sold-animation";
import { useBroadcastAudio } from "./use-broadcast-audio";
import { useRoleSpecGroups } from "@/hooks/use-role-spec-groups";
import type { AudioSettings } from "@/lib/audio-manager";
import type { CategoryLite, DisplayPlayerFilter, PlayerLite, PurseRow, WheelItem } from "./types";

// Module-level stable empty references. Critical for memo correctness:
// passing `value ?? []` inline creates a fresh array on every render,
// which would break `React.memo` shallow-compare for downstream leaves
// like OverlayManager that branch on emptiness only.
const EMPTY_PLAYERS: PlayerLite[] = [];
const EMPTY_CATEGORIES: CategoryLite[] = [];
const EMPTY_WHEEL_ITEMS: WheelItem[] = [];

/**
 * DisplayShell — single owner of realtime auction state for the LED
 * broadcast screen.
 *
 * Realtime architecture:
 *  - Exactly one `useAuctionSocket(tournamentId)` subscription lives
 *    here. All child components consume the resulting React-Query
 *    cache via props — no duplicate SSE subscriptions.
 *  - Five queries (state, purses, tournament, players, categories) are
 *    invalidated by the socket; child components never call query hooks
 *    themselves, eliminating overlapping subscriptions.
 *  - The shell does no per-tick timer work. Countdown ticking lives
 *    inside `AuctionCountdown` (mounted in `BidDisplay`), which owns
 *    its own 250ms interval in an isolated memoized subtree.
 *
 * Render boundaries (which leaves rerender when):
 *  a) timer tick           → only AuctionCountdown (inside BidDisplay subtree)
 *  b) bid update           → BidDisplay (currentBid pulse) + AuctionHeader
 *                            only if status flipped; PlayerCard untouched
 *  c) player change        → PlayerCard + BidDisplay; overlays untouched
 *  d) overlay toggle       → OverlayManager subtree only
 *  e) team-purse change    → AuctionHeader counters + TeamOverlay (when open)
 *  f) sold event           → AnimatedEffectsLayer only (stamp → card)
 *
 * Static background, header brand, sponsor carousel rotation, fortune
 * wheel RAF loop, and overlays are all React.memo'd and receive only
 * the slices they need, so the shell's own rerenders (from any auction
 * state change) cost nothing for components whose inputs are unchanged.
 */
export function DisplayShell({ tournamentId, theme }: { tournamentId: number; theme?: DisplayTheme }) {
  // ── Single realtime subscription ─────────────────────────────────────
  const { connectionStatus } = useAuctionSocket(tournamentId);
  const isStaleFeed = connectionStatus !== "connected";

  // ── Query data (cache invalidated by the socket above) ───────────────
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      // Poll as a safety net so countdown expiry is reflected even if an SSE
      // event is missed. SSE is the primary transport; this only catches rare
      // missed events on dedicated hardware.
      refetchInterval: 10000,
    },
  });
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const overlayMode = state?.displayOverlay ?? null;
  const fortuneWheelLive = useFortuneWheelBroadcastLive(
    state?.fortuneWheelActive,
    state?.wheelSpinning,
  );

  const { data: allPlayers } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId && (overlayMode === "player" || overlayMode === "top5"),
    },
  });
  const { data: allCategories } = useListCategories(tournamentId, {
    query: {
      queryKey: getListCategoriesQueryKey(tournamentId),
      enabled: !!tournamentId && overlayMode === "player",
    },
  });

  // ── Spec group names for the current player's role ───────────────────
  // useRoleSpecGroups fetches once per role change; bid-tick SSE updates
  // do not re-trigger it, so memo'd children stay stable between bids.
  const currentPlayerSpecGroups = useRoleSpecGroups(tournament?.sport, state?.currentPlayer?.role);

  // ── Derived state ────────────────────────────────────────────────────
  const displayMode = useMemo(
    () => deriveAuctionDisplayMode(state),
    [state?.status, state?.lastAction, state?.outcome, state?.displayCountdown],
  );
  const { soldPhase, soldRecord, unsoldPhase, unsoldRecord } = useSoldAnimation(state);

  const outcomeSoldRecord = useMemo(
    () => soldRecordFromOutcome(displayMode.outcome),
    [displayMode.outcome],
  );
  const outcomeUnsoldRecord = useMemo(
    () => unsoldRecordFromOutcome(displayMode.outcome),
    [displayMode.outcome],
  );
  const isOutcomeScreen = displayMode.phase === "sold" || displayMode.phase === "unsold";
  const showSoldOverlay = isOutcomeScreen || soldPhase != null || unsoldPhase != null;
  const activeSoldRecord = soldRecord ?? outcomeSoldRecord;
  const activeUnsoldRecord = unsoldRecord ?? outcomeUnsoldRecord;

  // ── Broadcast audio (LED display only) ───────────────────────────────
  // Settings are memo'd on primitives so the AudioManager only re-initialises
  // when an actual value changes, not on every auction-state SSE ping.
  const audioSettings = useMemo<AudioSettings | null>(() => {
    if (!tournament) return null;
    return {
      audioEnabled:          tournament.audioEnabled          ?? true,
      masterVolume:          tournament.masterVolume          ?? 80,
      countdownSoundEnabled: tournament.countdownSoundEnabled ?? true,
      countdownSoundUrl:     tournament.countdownSoundUrl     ?? null,
      countdownSoundVolume:  tournament.countdownSoundVolume  ?? 70,
      soldSoundEnabled:      tournament.soldSoundEnabled      ?? true,
      soldSoundUrl:          tournament.soldSoundUrl          ?? null,
      soldSoundVolume:       tournament.soldSoundVolume       ?? 80,
      breakEndMusicEnabled:  tournament.breakEndMusicEnabled  ?? false,
      breakEndMusicUrl:      tournament.breakEndMusicUrl      ?? null,
      breakEndMusicVolume:   tournament.breakEndMusicVolume   ?? 80,
    };
  }, [
    tournament?.audioEnabled,
    tournament?.masterVolume,
    tournament?.countdownSoundEnabled,
    tournament?.countdownSoundUrl,
    tournament?.countdownSoundVolume,
    tournament?.soldSoundEnabled,
    tournament?.soldSoundUrl,
    tournament?.soldSoundVolume,
    tournament?.breakEndMusicEnabled,
    tournament?.breakEndMusicUrl,
    tournament?.breakEndMusicVolume,
  ]);

  // Stable key that changes exactly once per sold event for deduplication.
  // The backend currently reports outcomes through lastAction while leaving
  // session status active, so the derived display outcome is the UI contract.
  const soldKey = displayMode.phase === "sold"
    ? displayMode.outcome?.action ?? `${state?.soldPlayersCount ?? 0}`
    : "";

  // Derive countdown primitives from the raw server state for useBroadcastAudio
  // (audio scheduling must use the real server values, not the sticky copy).
  const _dc = (state as { displayCountdown?: { type?: string; endsAt?: string; label?: string | null } | null } | undefined)?.displayCountdown;
  const hasDisplayCountdown = _dc?.type === "break" || _dc?.type === "pre-auction";
  const displayCountdownEndsAt = hasDisplayCountdown ? (_dc?.endsAt ?? null) : null;

  const { isUnlocked } = useBroadcastAudio({
    status: displayMode.phase,
    timerEndsAt: state?.timerEndsAt,
    soldKey,
    settings: audioSettings,
    hasDisplayCountdown,
    displayCountdownEndsAt,
  });

  // Sticky countdown for the visual overlay — holds the break countdown alive
  // for 5 s after the server clears it so the post-expiry banner can complete.
  const stickyDc = useStickyCountdown(_dc);
  const isActive = displayMode.isLive;
  const isPaused = displayMode.isPaused;
  const teamColor = state?.currentBidTeamColor || "#F59E0B";
  const statusForHeader = displayMode.phase === "live" ? "active" : displayMode.phase;
  const statusLabel = displayMode.outcome?.isManual
    ? "Manual Sold"
    : displayMode.phase === "sold"
    ? "Sold"
    : displayMode.phase === "unsold"
    ? "Unsold"
    : statusForHeader;

  // Memoized derived values so memo'd children get stable prop identity.
  const sponsorLogos = useMemo(
    () => parseSponsorLogos(tournament?.sponsorLogos),
    [tournament?.sponsorLogos],
  );

  const playerSpecs = useMemo<string[]>(() => {
    if (!state?.currentPlayer) return [];
    const specValues = [
      state.currentPlayer.battingStyle,
      state.currentPlayer.bowlingStyle,
      state.currentPlayer.specialization,
    ];
    const labeledSpecs = specValues
      .map((val, i) => {
        if (!val) return null;
        const label = currentPlayerSpecGroups[i]?.groupName;
        return label ? `${label}: ${val}` : val;
      })
      .filter((v): v is string => Boolean(v));
    return [
      state.currentPlayer.role,
      ...labeledSpecs,
      state.currentPlayer.city,
      state.currentPlayer.age ? `Age ${state.currentPlayer.age}` : null,
    ].filter((v): v is string => Boolean(v));
  }, [
    state?.currentPlayer?.role,
    state?.currentPlayer?.battingStyle,
    state?.currentPlayer?.bowlingStyle,
    state?.currentPlayer?.specialization,
    state?.currentPlayer?.city,
    state?.currentPlayer?.age,
    state?.currentPlayer,
    currentPlayerSpecGroups,
  ]);

  // Stable identity for the optional player filter — `state.displayPlayerFilter`
  // is a fresh object on every SSE update, but the filter values themselves
  // rarely change. useMemo on the primitive fields gives OverlayManager a
  // stable reference until the filter actually mutates.
  const playerFilter = useMemo<DisplayPlayerFilter>(() => {
    const f = state?.displayPlayerFilter;
    if (!f) return null;
    return { status: f.status, categoryId: f.categoryId ?? null, teamId: f.teamId ?? null };
  }, [state?.displayPlayerFilter?.status, state?.displayPlayerFilter?.categoryId, state?.displayPlayerFilter?.teamId]);

  // Sticky label — follows the sticky countdown so the banner stays coherent
  // during the post-expiry window.
  const displayCountdownLabel = stickyDc?.message ?? null;

  const stripPurses = useMemo<PurseRow[]>(() => (teamPurses || []).map(t => ({
    teamId: t.teamId,
    teamName: t.teamName,
    shortCode: t.shortCode || t.teamName.slice(0, 4).toUpperCase(),
    ownerName: t.ownerName,
    color: t.color,
    logoUrl: t.logoUrl,
    purse: t.effectiveCapacity ?? t.purse,
    purseUsed: t.purseUsed,
    purseRemaining: t.purseRemaining,
    playersBought: t.playersBought,
    retainedCount: t.retainedCount,
    reservePurse: t.reservePurse,
    spendablePurse: t.spendablePurse,
    slotsRequired: t.slotsRequired,
    lowestBasePrice: t.lowestBasePrice,
    minimumSquadSize: t.minimumSquadSize,
    maximumSquadSize: t.maximumSquadSize,
    topPlayerName: t.topPlayerName,
    topPlayerAmount: t.topPlayerAmount,
  })), [teamPurses]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <FullscreenLayout>
      <StaticBackground teamColor={teamColor} theme={theme}>
        <DisplayConnectionBanner status={connectionStatus} />
        <AuctionHeader
          tournament={tournament ?? undefined}
          status={statusForHeader}
          statusLabel={statusLabel}
          soldCount={state?.soldPlayersCount || 0}
          remainingCount={state?.remainingPlayersCount || 0}
          sponsorLogos={sponsorLogos}
          themeAccent={theme?.accentColor}
          compact={showSoldOverlay}
        />

        {/* Main Content Area — broadcast-safe inset for venue LED crops */}
        <div
          className={`flex-1 flex flex-col items-center justify-center ${BROADCAST_SAFE_MAIN} relative min-h-0 transition-opacity duration-300 ${
            showSoldOverlay ? "overflow-visible" : "overflow-hidden"
          } ${isStaleFeed ? "opacity-95 ring-2 ring-inset ring-amber-500/25" : ""}`}
        >
          {/* Pre Auction & Break Timer countdown — scoped to content area so the top
              AuctionHeader / sponsor strip remains visible. z-10 keeps it below
              the sold-stamp animations (z-20) in the stacking order. */}
          {stickyDc && (
            <div key={stickyDc.endsAt} className="absolute inset-0 z-10">
              <BreakCountdownOverlay
                endsAt={stickyDc.endsAt}
                message={stickyDc.message ?? displayCountdownLabel}
                tournamentName={tournament?.name ?? null}
              />
            </div>
          )}

          {/* SOLD / UNSOLD full-screen overlay — always on top during outcome */}
          {overlayMode !== "top5" && showSoldOverlay && (
            <AnimatedEffectsLayer
              soldPhase={soldPhase ?? (isOutcomeScreen && displayMode.phase === "sold" && activeSoldRecord ? "card" : null)}
              soldRecord={activeSoldRecord}
              unsoldPhase={unsoldPhase ?? (isOutcomeScreen && displayMode.phase === "unsold" && activeUnsoldRecord ? "card" : null)}
              unsoldRecord={activeUnsoldRecord}
            />
          )}

          {displayMode.overlayMode === "paused" && (
            <AuctionStatusOverlay mode="paused" />
          )}

          {overlayMode === "top5" ? (
            <Top5Overlay
              players={allPlayers ?? EMPTY_PLAYERS}
              purses={stripPurses}
            />
          ) : state?.currentPlayer && !showSoldOverlay ? (
            <div
              className={`${BROADCAST_MAIN_WIDTH} mx-auto transition-opacity duration-300 ${displayMode.showStatusOverlay ? "opacity-40" : "opacity-100"}`}
            >
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 lg:gap-12 xl:gap-16 w-full">
                {/* PlayerCard / BidDisplay get PRIMITIVE props only. `state` and
                    `state.currentPlayer` are fresh object references on every SSE
                    update, so passing them as a whole would defeat React.memo's
                    shallow compare and force these children to rerender on every
                    bid event. Slicing into primitives confines bid-update
                    rerenders to BidDisplay (whose primitives actually change). */}
                <PlayerCard
                  playerId={state.currentPlayer.id}
                  name={state.currentPlayer.name}
                  photoUrl={state.currentPlayer.photoUrl}
                  jerseyNumber={state.currentPlayer.jerseyNumber}
                  teamColor={teamColor}
                  playerTag={(state.currentPlayer as { playerTag?: string | null }).playerTag ?? null}
                />
                <BidDisplay
                  playerId={state.currentPlayer.id}
                  playerName={state.currentPlayer.name}
                  playerBasePrice={state.currentPlayer.basePrice}
                  playerAvailabilityDates={state.currentPlayer.availabilityDates}
                  tournamentMatchDates={tournament?.matchDates}
                  playerAchievements={state.currentPlayer.achievements}
                  playerSpecs={playerSpecs}
                  teamColor={teamColor}
                  currentBid={state.currentBid}
                  currentBidTeamId={state.currentBidTeamId}
                  currentBidTeamName={state.currentBidTeamName}
                  currentBidTeamLogoUrl={(state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl ?? null}
                  bidIncrement={state.bidIncrement}
                  timerEndsAt={state.timerEndsAt}
                  timerType={state.timerType}
                  playerTag={(state.currentPlayer as { playerTag?: string | null }).playerTag ?? null}
                  freezeBidTimer={displayMode.freezeBidUpdates}
                  disableBidAnimations={displayMode.freezeBidUpdates}
                />
              </div>
            </div>
          ) : (
            <IdleScreen
              tournamentName={tournament?.name}
              tournamentLogoUrl={tournament?.logoUrl}
              status={state?.status}
              lastAction={state?.lastAction}
              isActive={isActive}
              isPaused={isPaused}
            />
          )}
        </div>

        <SponsorTicker
          logos={sponsorLogos}
          themeAccent={theme?.accentColor}
          includePoweredByBidWar
        />

        {/* Audio unlock nudge — hidden during sold overlay so it doesn't clutter the screen */}
        {audioSettings?.audioEnabled && !isUnlocked && !showSoldOverlay && (
          <div className={`absolute right-5 z-50 flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-full px-3 py-1.5 text-white/50 text-[11px] select-none pointer-events-none backdrop-blur-sm ${sponsorLogos.some(l => l.name?.trim()) ? "bottom-14" : "bottom-5"}`}>
            <Volume2 className="w-3 h-3" />
            Click anywhere to enable audio
          </div>
        )}

        <OverlayManager
          overlayMode={overlayMode}
          stripPurses={stripPurses}
          currentBidTeamId={state?.currentBidTeamId}
          tournamentName={tournament?.name ?? null}
          allPlayers={allPlayers ?? EMPTY_PLAYERS}
          allCategories={allCategories ?? EMPTY_CATEGORIES}
          playerFilter={playerFilter}
          fortuneWheelActive={fortuneWheelLive}
          wheelItems={state?.wheelItems ?? EMPTY_WHEEL_ITEMS}
          wheelWinner={state?.wheelWinner}
          wheelSpinning={state?.wheelSpinning}
          bannerUrl={tournament?.mainBannerUrl ?? null}
          bannerFit={tournament?.mainBannerFit ?? "cover"}
        />

        {state?.ledPurseToast?.teamName && (
          <PurseUpdatedToast teamName={state.ledPurseToast.teamName} />
        )}
      </StaticBackground>
    </FullscreenLayout>
  );
}
