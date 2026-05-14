import { useMemo } from "react";
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
import { PlayerCard } from "./player-card";
import { BidDisplay } from "./bid-display";
import { IdleScreen } from "./idle-screen";
import { AnimatedEffectsLayer } from "./animated-effects-layer";
import { OverlayManager } from "./overlay-manager";
import { useSoldAnimation } from "./use-sold-animation";
import { useBroadcastAudio } from "./use-broadcast-audio";
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
export function DisplayShell({ tournamentId }: { tournamentId: number }) {
  // ── Single realtime subscription ─────────────────────────────────────
  useAuctionSocket(tournamentId);

  // ── Query data (cache invalidated by the socket above) ───────────────
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: state } = useGetAuctionState(tournamentId, {
    query: { queryKey: getGetAuctionStateQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const overlayMode = state?.displayOverlay ?? null;

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

  // ── Derived state ────────────────────────────────────────────────────
  const { soldPhase, soldRecord } = useSoldAnimation(state);

  // ── Broadcast audio (LED display only) ───────────────────────────────
  // Settings are memo'd on primitives so the AudioManager only re-initialises
  // when an actual value changes, not on every auction-state SSE ping.
  const audioSettings = useMemo<AudioSettings | null>(() => {
    if (!tournament) return null;
    const t = tournament as unknown as Record<string, unknown>;
    return {
      audioEnabled:          (t.audioEnabled          as boolean)  ?? true,
      masterVolume:          (t.masterVolume           as number)   ?? 80,
      countdownSoundEnabled: (t.countdownSoundEnabled  as boolean)  ?? true,
      countdownSoundUrl:     (t.countdownSoundUrl      as string | null) ?? null,
      countdownSoundVolume:  (t.countdownSoundVolume   as number)   ?? 70,
      soldSoundEnabled:      (t.soldSoundEnabled       as boolean)  ?? true,
      soldSoundUrl:          (t.soldSoundUrl           as string | null) ?? null,
      soldSoundVolume:       (t.soldSoundVolume        as number)   ?? 80,
    };
  }, [
    (tournament as Record<string, unknown> | undefined)?.audioEnabled,
    (tournament as Record<string, unknown> | undefined)?.masterVolume,
    (tournament as Record<string, unknown> | undefined)?.countdownSoundEnabled,
    (tournament as Record<string, unknown> | undefined)?.countdownSoundUrl,
    (tournament as Record<string, unknown> | undefined)?.countdownSoundVolume,
    (tournament as Record<string, unknown> | undefined)?.soldSoundEnabled,
    (tournament as Record<string, unknown> | undefined)?.soldSoundUrl,
    (tournament as Record<string, unknown> | undefined)?.soldSoundVolume,
  ]);

  // Stable key that changes exactly once per sold event for deduplication.
  // "sold" is a runtime-only status the server emits during live auction;
  // it is not in the OpenAPI enum so we widen to string for comparison.
  const soldKey = (state?.status as string) === "sold"
    ? `${state?.currentBidTeamId ?? 0}_${state?.currentBid ?? 0}_${state?.soldPlayersCount ?? 0}`
    : "";

  const { isUnlocked } = useBroadcastAudio({
    status: state?.status,
    timerEndsAt: state?.timerEndsAt,
    soldKey,
    settings: audioSettings,
  });

  const isActive = state?.status === "active";
  const isPaused = state?.status === "paused";
  const teamColor = state?.currentBidTeamColor || "#F59E0B";

  // Memoized derived values so memo'd children get stable prop identity.
  const sponsorLogos = useMemo<{ url: string; name: string }[]>(() => {
    if (!tournament?.sponsorLogos) return [];
    try { return JSON.parse(tournament.sponsorLogos); } catch { return []; }
  }, [tournament?.sponsorLogos]);

  const playerSpecs = useMemo<string[]>(() => {
    if (!state?.currentPlayer) return [];
    return [
      state.currentPlayer.role,
      state.currentPlayer.battingStyle,
      state.currentPlayer.bowlingStyle,
      state.currentPlayer.specialization,
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

  const stripPurses = useMemo<PurseRow[]>(() => (teamPurses || []).map(t => ({
    teamId: t.teamId,
    teamName: t.teamName,
    shortCode: t.shortCode || t.teamName.slice(0, 4).toUpperCase(),
    ownerName: t.ownerName,
    color: t.color,
    logoUrl: t.logoUrl,
    purse: t.purse,
    purseUsed: t.purseUsed,
    purseRemaining: t.purseRemaining,
    playersBought: t.playersBought,
    reservePurse: t.reservePurse,
    spendablePurse: t.spendablePurse,
    slotsRequired: t.slotsRequired,
    lowestBasePrice: t.lowestBasePrice,
    maximumSquadSize: t.maximumSquadSize,
  })), [teamPurses]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <FullscreenLayout>
      {/* DisplayFooter (sponsor ticker) uses this keyframe. Kept globally
          available so the footer can be enabled in the future without
          re-declaring the animation. */}
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <StaticBackground teamColor={teamColor}>
        <AuctionHeader
          tournament={tournament ?? undefined}
          status={state?.status}
          soldCount={state?.soldPlayersCount || 0}
          remainingCount={state?.remainingPlayersCount || 0}
          sponsorLogos={sponsorLogos}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 relative overflow-hidden min-h-0">
          {/* SOLD animations layered above main content (stamp → card) */}
          <AnimatedEffectsLayer soldPhase={soldPhase} soldRecord={soldRecord} />

          {state?.currentPlayer ? (
            <div className="w-full max-w-6xl">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 lg:gap-16">
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
                />
                <BidDisplay
                  playerId={state.currentPlayer.id}
                  playerName={state.currentPlayer.name}
                  playerBasePrice={state.currentPlayer.basePrice}
                  playerAvailabilityDates={state.currentPlayer.availabilityDates}
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

        {/* Bottom team purse strip removed from broadcast — team info is shown on
            demand via the dedicated Team overlay (operator-controlled) to keep the
            live display clean and reduce per-team Framer Motion + box-shadow load. */}

        {/* Audio unlock nudge — fades away after first user interaction */}
        {audioSettings?.audioEnabled && !isUnlocked && (
          <div className="absolute bottom-5 right-5 z-50 flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-full px-3 py-1.5 text-white/50 text-[11px] select-none pointer-events-none backdrop-blur-sm">
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
          fortuneWheelActive={state?.fortuneWheelActive}
          wheelItems={state?.wheelItems ?? EMPTY_WHEEL_ITEMS}
          wheelWinner={state?.wheelWinner}
          wheelSpinning={state?.wheelSpinning}
        />
      </StaticBackground>
    </FullscreenLayout>
  );
}
