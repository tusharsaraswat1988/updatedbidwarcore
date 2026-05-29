import { useEffect, useState, useRef } from "react";
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
import { AccessGate } from "./AccessGate";
import { Warmup } from "./Warmup";
import { LiveBid } from "./LiveBid";
import { Completed } from "./Completed";
import { Squad } from "./Squad";
import { upsertSavedAuction, removeSavedAuction } from "./Launcher";

type Screen = "loading" | "gate" | "warmup" | "live" | "squad" | "completed";

function sessionKey(teamId: number) {
  return `owner_verified_${teamId}`;
}

// ── Push subscription helper ──────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function subscribeToPush(tournamentId: number, teamId: number) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const keyRes = await fetch("/api/vapid-public-key");
    if (!keyRes.ok) return;
    const { publicKey } = (await keyRes.json()) as { publicKey: string };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subJson = sub.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    await fetch(`/api/tournaments/${tournamentId}/push-subscribe?teamId=${teamId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(subJson),
    });
  } catch {
    // Push is optional — fail silently
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OwnerRoute() {
  const params       = useParams<{ id: string; teamId: string }>();
  const tournamentId = parseInt(params.id || "0");
  const teamId       = parseInt(params.teamId || "0");
  const qc           = useQueryClient();
  const pushDoneRef  = useRef(false);

  const [screen, setScreen] = useState<Screen>("loading");

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

  // Auction state polling — declared early so the save effect below can read it
  const pollInterval = screen === "live" || screen === "squad" ? 1000 : 5000;
  const { data: state, isFetching: stateFetching, isError: stateIsError } = useGetAuctionState(tournamentId, {
    query: {
      queryKey:       getGetAuctionStateQueryKey(tournamentId),
      enabled:        !!tournamentId && screen !== "loading" && screen !== "gate",
      refetchInterval: (query) => {
        const d = query.state.data;
        if (d?.licenseStatus === "completed" || d?.status === "completed") return false;
        return pollInterval;
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
    });
  }, [tournamentId, teamId, tournament?.name, team?.name, team?.color, state?.status, state?.licenseStatus]);

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

  // Subscribe to push once the owner is past the gate
  useEffect(() => {
    if (screen === "loading" || screen === "gate") return;
    if (pushDoneRef.current) return;
    pushDoneRef.current = true;
    subscribeToPush(tournamentId, teamId);
  }, [screen, tournamentId, teamId]);

  // Detect auction completion
  useEffect(() => {
    if (!state) return;
    const done = state.licenseStatus === "completed" || state.status === "completed";
    if (done && screen === "live") setScreen("completed");
  }, [state, screen]);

  const isCompleted = state?.licenseStatus === "completed" || state?.status === "completed";

  const { data: allPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey:       getGetTeamPursesQueryKey(tournamentId),
      enabled:        !!tournamentId && (screen === "live" || screen === "completed"),
      refetchInterval: isCompleted ? false : 10000,
    },
  });

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

  // ── Access code verification ──────────────────────────────────────────────
  async function verifyCode(enteredCode: string): Promise<boolean> {
    try {
      const r = await fetch(
        `/api/tournaments/${tournamentId}/teams/${teamId}/verify-access`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ code: enteredCode }),
        },
      );
      if (r.ok) {
        const body = (await r.json()) as { valid?: boolean };
        return body.valid === true;
      }
      const accessCode = (team as unknown as { accessCode?: string })?.accessCode;
      if (accessCode && enteredCode.toUpperCase() === accessCode.toUpperCase()) return true;
      return false;
    } catch {
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
    setScreen(isCompleted ? "completed" : "live");
  }

  async function handleBid(amount: number): Promise<"success" | "leading" | "error"> {
    try {
      await placeBid.mutateAsync({ tournamentId, data: { teamId, amount } });
      qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
      setLastBidError("");
      return "success";
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "";
      const display = msg || "Bid failed. Please try again.";
      setLastBidError(display);
      if (msg.includes("already the highest bidder")) {
        qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
        return "leading";
      }
      return "error";
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
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

  return (
    <LiveBid
      state={state ?? null}
      team={team}
      tournament={tournament ?? null}
      teamPurse={teamPurse ?? null}
      teamId={teamId}
      isFetching={stateFetching}
      bidErrorMsg={lastBidError}
      onBid={handleBid}
      onViewSquad={() => setScreen("squad")}
      onSync={handleSync}
      isSyncError={stateIsError}
      onSignOut={() => {
        sessionStorage.removeItem(sessionKey(teamId));
        setScreen("gate");
      }}
    />
  );
}
