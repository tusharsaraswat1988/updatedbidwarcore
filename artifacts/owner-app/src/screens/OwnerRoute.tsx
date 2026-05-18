import { useEffect, useState } from "react";
import { useParams } from "wouter";
import {
  useGetTeam, getGetTeamQueryKey,
  useGetTournament, getGetTournamentQueryKey,
  useGetAuctionState, getGetAuctionStateQueryKey,
  useGetTeamPurses, getGetTeamPursesQueryKey,
  usePlaceBid,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AccessGate } from "./AccessGate";
import { Warmup } from "./Warmup";
import { LiveBid } from "./LiveBid";
import { Completed } from "./Completed";

type Screen = "loading" | "gate" | "warmup" | "live" | "completed";

function sessionKey(teamId: number) {
  return `owner_verified_${teamId}`;
}

export function OwnerRoute() {
  const params = useParams<{ id: string; teamId: string }>();
  const tournamentId = parseInt(params.id || "0");
  const teamId       = parseInt(params.teamId || "0");
  const qc           = useQueryClient();

  const [screen, setScreen] = useState<Screen>("loading");

  const { data: team } = useGetTeam(tournamentId, teamId, {
    query: {
      queryKey: getGetTeamQueryKey(tournamentId, teamId),
      enabled: !!tournamentId && !!teamId,
    },
  });

  const { data: tournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  // Determine if code is required and if already verified
  useEffect(() => {
    if (!team) return;
    const needsCode =
      (team as unknown as { requiresAccessCode?: boolean }).requiresAccessCode ??
      !!team.accessCode;

    if (!needsCode || sessionStorage.getItem(sessionKey(teamId)) === "1") {
      if (screen === "loading") setScreen("warmup");
    } else {
      setScreen("gate");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, teamId]);

  // Auction state polling — always poll once screen is live
  const pollInterval = screen === "live" ? 1500 : 5000;
  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId && screen !== "loading" && screen !== "gate",
      refetchInterval: (query) => {
        const d = query.state.data;
        if (d?.licenseStatus === "completed" || d?.status === "completed") return false;
        return pollInterval;
      },
    },
  });

  // Detect auction completion
  useEffect(() => {
    if (!state) return;
    const done = state.licenseStatus === "completed" || state.status === "completed";
    if (done && screen === "live") setScreen("completed");
  }, [state, screen]);

  const isCompleted = state?.licenseStatus === "completed" || state?.status === "completed";

  const { data: allPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId && (screen === "live" || screen === "completed"),
      refetchInterval: isCompleted ? false : 10000,
    },
  });

  const placeBid = usePlaceBid();

  const teamColor   = team?.color || "#F59E0B";
  const teamPurse   = allPurses?.find(t => t.teamId === teamId);

  // ── Verify access code ──────────────────────────────────────────────────────
  async function verifyCode(enteredCode: string): Promise<boolean> {
    try {
      const r = await fetch(`/api/tournaments/${tournamentId}/teams/${teamId}/verify-access-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: enteredCode }),
      });
      if (r.ok) return true;

      // Fallback: compare against team.accessCode if returned (organizer view)
      const accessCode = (team as unknown as { accessCode?: string })?.accessCode;
      if (accessCode && enteredCode.toUpperCase() === accessCode.toUpperCase()) return true;

      return false;
    } catch {
      // Network error — check local team data as fallback
      const accessCode = (team as unknown as { accessCode?: string })?.accessCode;
      if (accessCode && enteredCode.toUpperCase() === accessCode.toUpperCase()) return true;
      return false;
    }
  }

  function handleVerified() {
    sessionStorage.setItem(sessionKey(teamId), "1");
    setScreen("warmup");
  }

  function handleWarmupReady() {
    if (isCompleted) {
      setScreen("completed");
    } else {
      setScreen("live");
    }
  }

  async function handleBid(amount: number): Promise<"success" | "leading" | "error"> {
    try {
      await placeBid.mutateAsync({ tournamentId, data: { teamId, amount } });
      qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
      return "success";
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "";
      if (msg.includes("already the highest bidder")) return "leading";
      return "error";
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (screen === "loading" || !team) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]">
        <div className="w-8 h-8 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (screen === "gate") {
    return (
      <AccessGate
        teamName={team.name}
        teamShortCode={team.shortCode || "?"}
        teamColor={teamColor}
        verifyCode={verifyCode}
        onVerified={handleVerified}
      />
    );
  }

  if (screen === "warmup") {
    return (
      <Warmup
        teamName={team.name}
        teamShortCode={team.shortCode || "?"}
        teamColor={teamColor}
        onReady={handleWarmupReady}
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

  // live
  return (
    <LiveBid
      state={state ?? null}
      team={team}
      tournament={tournament ?? null}
      teamPurse={teamPurse ?? null}
      teamId={teamId}
      onBid={handleBid}
      onSignOut={() => {
        sessionStorage.removeItem(sessionKey(teamId));
        setScreen("gate");
      }}
    />
  );
}
