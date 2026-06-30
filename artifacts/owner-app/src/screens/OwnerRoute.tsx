import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { useWakeLock } from "../hooks/useWakeLock";
import {
  useGetTeam, getGetTeamQueryKey,
  useGetTournament, getGetTournamentQueryKey,
  useGetAuctionState, getGetAuctionStateQueryKey,
  useGetTeamPurses, getGetTeamPursesQueryKey,
  usePlaceBid,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AccessCode } from "@/components/AccessCode";
import {
  clearOwnerSession,
  getStoredOwnerAccessCode,
  isOwnerSessionVerified,
  teamNeedsAccessCode,
  establishOwnerServerSession,
  subscribeOwnerPush,
  logoutOwnerPushAndSession,
} from "@workspace/api-base/owner-auth";
import { Warmup } from "./Warmup";
import { LiveBid } from "./LiveBid";
import { Completed } from "./Completed";
import { Squad } from "./Squad";
import { Scout } from "./Scout";
import { upsertSavedAuction, removeSavedAuction } from "./Launcher";
import { isPlayerOnAuctionStage, AUCTION_STAGE_NAV_MESSAGE } from "@/lib/auction-stage";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useMutationSync } from "@/hooks/use-mutation-sync";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import { useBranding } from "@/hooks/useBranding";
import { resolveSplashLogoUrl } from "@/lib/brand-assets";

type Screen = "loading" | "gate" | "warmup" | "live" | "squad" | "scout" | "completed";

// ── Component ─────────────────────────────────────────────────────────────────
export function OwnerRoute() {
  const params       = useParams<{ id: string; teamId: string }>();
  const tournamentId = parseInt(params.id || "0");
  const teamId       = parseInt(params.teamId || "0");
  const qc           = useQueryClient();
  const pushDoneRef  = useRef(false);
  const [serverVerified, setServerVerified] = useState(false);

  const [screen, setScreen] = useState<Screen>("loading");
  const { logos, brandName, miniBrandText } = useBranding();
  const splashSrc = resolveSplashLogoUrl(logos);

  // Keep the screen awake while the owner is active — critical during live bidding.
  // Released automatically when the page is hidden; re-acquired on visibility restore.
  useWakeLock(screen !== "loading" && screen !== "gate");

  const { data: team } = useGetTeam(tournamentId, teamId, {
    query: {
      queryKey: getGetTeamQueryKey(tournamentId, teamId),
      enabled:  !!tournamentId && !!teamId,
    },
  });

  const { data: tournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled:  !!tournamentId,
    },
  });

  // Live SSE push + polling fallback only when disconnected
  const { connectionStatus } = useAuctionSocket(tournamentId);
  const { applyMutationResult, invalidateFallback } = useMutationSync(tournamentId, connectionStatus);

  const pollFallbackMs = screen === "live" || screen === "squad" || screen === "scout" ? 1000 : 5000;
  const { data: state, isFetching: stateFetching, isError: stateIsError } = useGetAuctionState(tournamentId, {
    query: {
      queryKey:       getGetAuctionStateQueryKey(tournamentId),
      enabled:        !!tournamentId && screen !== "loading" && screen !== "gate",
      refetchInterval: (query) => {
        const d = query.state.data;
        if (d?.licenseStatus === "completed" || d?.status === "completed") return false;
        return sseAwareRefetchInterval(connectionStatus, pollFallbackMs);
      },
    },
  });

  // Save this auction to localStorage so the Launcher can find it later.
  // Never save (and actively remove) completed auctions.
  useEffect(() => {
    if (!tournamentId || !teamId) return;
    const completed = state?.status === "completed" || state?.licenseStatus === "completed";
    if (completed) {
      removeSavedAuction(tournamentId, teamId);
      return;
    }
    upsertSavedAuction({
      tournamentId,
      teamId,
      tournamentName: tournament?.name,
      teamName:       team?.name,
      teamColor:      team?.color ?? undefined,
      teamLogoUrl:    team?.logoUrl ?? undefined,
    });
  }, [tournamentId, teamId, tournament?.name, team?.name, team?.color, team?.logoUrl, state?.status, state?.licenseStatus]);

  // Determine if code is required and if already verified
  useEffect(() => {
    if (!team) return;
    if (!teamNeedsAccessCode(team) || isOwnerSessionVerified(teamId)) {
      if (screen === "loading") {
        setScreen(isOwnerSessionVerified(teamId) ? "live" : "warmup");
      }
    } else {
      setScreen("gate");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, teamId]);

  // Establish verified server session (httpOnly cookie) after passing the gate.
  useEffect(() => {
    if (!team || screen === "loading" || screen === "gate") return;

    let cancelled = false;
    void (async () => {
      const code = getStoredOwnerAccessCode(teamId) ?? "";
      const result = await establishOwnerServerSession(tournamentId, teamId, code);
      if (!cancelled && result.ok) {
        setServerVerified(true);
      }
    })();

    return () => { cancelled = true; };
  }, [team, screen, tournamentId, teamId]);

  // Subscribe to push only after verified server session exists.
  useEffect(() => {
    if (!serverVerified || pushDoneRef.current) return;
    pushDoneRef.current = true;
    void subscribeOwnerPush(tournamentId, teamId);
  }, [serverVerified, tournamentId, teamId]);

  // Detect auction completion
  useEffect(() => {
    if (!state) return;
    const done = state.licenseStatus === "completed" || state.status === "completed";
    if (done && screen === "live") setScreen("completed");
  }, [state, screen]);

  // Auto-return from scout/squad to live when a player goes on stage
  const [scoutAutoReturn, setScoutAutoReturn] = useState(false);
  useEffect(() => {
    if (screen !== "scout" && screen !== "squad") return;
    if (!isPlayerOnAuctionStage(state)) return;

    if (screen === "scout") {
      setScoutAutoReturn(true);
      const t = setTimeout(() => {
        setScoutAutoReturn(false);
        setScreen("live");
      }, 500);
      return () => clearTimeout(t);
    }

    setScreen("live");
    return;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status, (state?.currentPlayer as { id?: number } | null | undefined)?.id, screen]);

  const [navToast, setNavToast] = useState<string | null>(null);
  const dismissNavToast = useCallback(() => setNavToast(null), []);

  function handleViewScout() {
    if (isPlayerOnAuctionStage(state)) {
      setNavToast(AUCTION_STAGE_NAV_MESSAGE);
      return;
    }
    setScreen("scout");
  }

  function handleViewSquad() {
    if (isPlayerOnAuctionStage(state)) {
      setNavToast(AUCTION_STAGE_NAV_MESSAGE);
      return;
    }
    setScreen("squad");
  }

  const isCompleted = state?.licenseStatus === "completed" || state?.status === "completed";
  const embeddedPurses = state?.teamPurses;

  const { data: allPursesFromQuery } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey:       getGetTeamPursesQueryKey(tournamentId),
      enabled:        !!tournamentId && (screen === "live" || screen === "completed") && !embeddedPurses?.length,
      refetchInterval: isCompleted
        ? false
        : sseAwareRefetchInterval(connectionStatus, 10000),
    },
  });
  const allPurses = embeddedPurses ?? allPursesFromQuery;

  const placeBid = usePlaceBid();
  const [lastBidError, setLastBidError] = useState("");

  const teamColor = team?.color || "#F59E0B";
  const teamPurse = allPurses?.find((t) => t.teamId === teamId);

  // ── Sync / recover handler ────────────────────────────────────────────────
  function handleSync() {
    qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getGetTeamQueryKey(tournamentId, teamId) });
    qc.invalidateQueries({ queryKey: getGetTeamPursesQueryKey(tournamentId) });
  }

  function handleWarmupReady() {
    setScreen(isCompleted ? "completed" : "live");
  }

  async function handleBid(amount: number): Promise<"success" | "leading" | "error"> {
    try {
      const storedCode = getStoredOwnerAccessCode(teamId);
      const result = await placeBid.mutateAsync({
        tournamentId,
        data: { teamId, amount, ...(storedCode ? { accessCode: storedCode } : {}) },
      });
      applyMutationResult(result);
      setLastBidError("");
      return "success";
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "";
      const display = msg || "Bid failed. Please try again.";
      setLastBidError(display);
      if (msg.includes("already the highest bidder")) {
        invalidateFallback();
        return "leading";
      }
      return "error";
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (screen === "loading" || !team) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#09090b] gap-6">
        {splashSrc ? (
          <img src={splashSrc} alt={brandName} className="h-16 w-auto max-w-[240px] object-contain" />
        ) : logos.mini ? (
          <img src={logos.mini} alt={brandName} className="h-10 w-auto" />
        ) : (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-sm bg-amber-400/20 text-amber-400 border border-amber-400/30">
            {miniBrandText}
          </div>
        )}
        <div className="w-8 h-8 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (screen === "gate") {
    return (
      <AccessCode
        tournamentId={tournamentId}
        teamId={teamId}
        teamName={team.name}
        teamShortCode={team.shortCode || "?"}
        teamColor={teamColor}
        teamLogoUrl={team.logoUrl}
        onVerified={() => setScreen("warmup")}
      />
    );
  }

  if (screen === "warmup") {
    return (
      <Warmup
        teamName={team.name}
        teamShortCode={team.shortCode || "?"}
        teamColor={teamColor}
        teamLogoUrl={team.logoUrl}
        onReady={handleWarmupReady}
        onSync={handleSync}
      />
    );
  }

  if (screen === "completed") {
    return (
      <Completed
        teamName={team.name}
        teamColor={teamColor}
        tournamentName={tournament?.name}
        auctionDate={tournament?.auctionDate}
        playersBought={teamPurse?.playersBought}
        purseSpent={teamPurse?.purseUsed}
      />
    );
  }

  if (screen === "squad") {
    return (
      <Squad
        tournamentId={tournamentId}
        teamId={teamId}
        team={team}
        teamPurse={teamPurse ?? null}
        onBack={() => setScreen("live")}
      />
    );
  }

  if (screen === "scout") {
    return (
      <Scout
        tournamentId={tournamentId}
        teamId={teamId}
        teamColor={teamColor}
        onBack={() => setScreen("live")}
        auctionStarted={scoutAutoReturn}
      />
    );
  }

  return (
    <LiveBid
      state={state ?? null}
      team={team}
      tournament={tournament ?? null}
      teamPurse={teamPurse ?? null}
      teamId={teamId}
      tournamentId={tournamentId}
      connectionStatus={connectionStatus}
      bidErrorMsg={lastBidError}
      onBid={handleBid}
      onViewSquad={handleViewSquad}
      onViewScout={handleViewScout}
      navToast={navToast}
      onNavToastDismiss={dismissNavToast}
      onSync={handleSync}
      isSyncError={stateIsError}
      onSignOut={() => {
        void logoutOwnerPushAndSession(tournamentId, teamId).finally(() => {
          clearOwnerSession(teamId);
          pushDoneRef.current = false;
          setServerVerified(false);
          setScreen("gate");
        });
      }}
    />
  );
}
