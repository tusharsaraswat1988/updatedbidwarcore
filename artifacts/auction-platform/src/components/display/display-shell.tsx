import { useMemo } from "react";
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
import type { PurseRow } from "./types";

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

  const stripPurses = useMemo<PurseRow[]>(() => (teamPurses || []).map(t => ({
    teamId: t.teamId,
    teamName: t.teamName,
    shortCode: t.shortCode || t.teamName.slice(0, 4).toUpperCase(),
    color: t.color,
    logoUrl: t.logoUrl,
    purse: t.purse,
    purseUsed: t.purseUsed,
    purseRemaining: t.purseRemaining,
    playersBought: t.playersBought,
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
                <PlayerCard player={state.currentPlayer} teamColor={teamColor} />
                <BidDisplay
                  player={state.currentPlayer}
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

        <OverlayManager
          overlayMode={overlayMode}
          stripPurses={stripPurses}
          currentBidTeamId={state?.currentBidTeamId}
          tournamentName={tournament?.name ?? null}
          allPlayers={allPlayers ?? []}
          allCategories={allCategories ?? []}
          playerFilter={state?.displayPlayerFilter ?? null}
          fortuneWheelActive={state?.fortuneWheelActive}
          wheelItems={state?.wheelItems ?? []}
          wheelWinner={state?.wheelWinner}
          wheelSpinning={state?.wheelSpinning}
        />
      </StaticBackground>
    </FullscreenLayout>
  );
}
