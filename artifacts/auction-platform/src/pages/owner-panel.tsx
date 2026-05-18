import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  useGetTeam,
  useGetTeamPurses,
  useGetTournament,
  usePlaceBid,
  useVerifyOwnerAccess,
  getGetAuctionStateQueryKey,
  getGetTeamQueryKey,
  getGetTeamPursesQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useTimerExpired } from "@/hooks/use-timer-expired";
import { useRoleSpecGroups } from "@/hooks/use-role-spec-groups";
import { ServerCountdown } from "@/components/server-countdown";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { BreakCountdownOverlay } from "@/components/display/break-countdown-overlay";
import { useStickyCountdown } from "@/hooks/use-sticky-countdown";
import { User, Trophy, Wallet, Users, Lock, Eye, EyeOff, RefreshCw, LogOut, Timer, AlertTriangle, ShieldAlert, CheckCircle2, MessageSquare, X } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";


function AccessGate({ tournamentId, teamId, teamName, teamColor, onVerified }: {
  tournamentId: number;
  teamId: number;
  teamName: string;
  teamColor: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const verify = useVerifyOwnerAccess();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await verify.mutateAsync({ tournamentId, teamId, data: { code: code.trim() } });
      if (result.valid) {
        sessionStorage.setItem(`owner_verified_${teamId}`, "1");
        onVerified();
      } else {
        setError("Incorrect access code. Please try again.");
        setCode("");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}15 0%, transparent 55%), #09090b` }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        <div className="space-y-3">
          <div
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
            style={{ backgroundColor: `${teamColor}22`, border: `2px solid ${teamColor}66` }}
          >
            <Lock className="w-9 h-9" style={{ color: teamColor }} />
          </div>
          <h1 className="font-display font-black text-3xl text-white">{teamName}</h1>
          <p className="text-muted-foreground text-sm">Enter your team access code to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ACCESS CODE"
              autoComplete="off"
              className="w-full px-5 py-4 rounded-2xl border text-center font-display font-black text-2xl tracking-[0.3em] bg-card/50 border-border text-white placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 transition-all"
              style={{ caretColor: teamColor }}
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-destructive text-sm text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={loading || !code.trim()}
            whileTap={{ scale: 0.97 }}
            className="w-full py-5 rounded-2xl font-display font-black text-xl text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ backgroundColor: teamColor, boxShadow: `0 0 40px ${teamColor}55` }}
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : "ENTER"}
          </motion.button>
        </form>

        <p className="text-xs text-muted-foreground/60">
          Contact the auction operator if you don't have the code.
        </p>
      </motion.div>
    </div>
  );
}

export default function OwnerPanel() {
  const [, params] = useRoute("/tournament/:id/owner/:teamId");
  const tournamentId = parseInt(params?.id || "0");
  const teamId = parseInt(params?.teamId || "0");
  const qc = useQueryClient();

  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showWaConsent, setShowWaConsent] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);

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

  useEffect(() => {
    if (!team) return;
    // Public endpoint returns requiresAccessCode boolean (accessCode is omitted).
    // Organizer endpoint returns the actual accessCode. Handle both.
    const needsCode =
      (team as unknown as { requiresAccessCode?: boolean }).requiresAccessCode ??
      !!team.accessCode;
    if (!needsCode) {
      setVerified(true);
    } else {
      const stored = sessionStorage.getItem(`owner_verified_${teamId}`);
      if (stored === "1") setVerified(true);
    }
    setChecking(false);
  }, [team, teamId]);

  useAuctionSocket(tournamentId);

  useEffect(() => {
    if (!verified) return;
    const dismissed = sessionStorage.getItem(`wa_consent_dismissed_${teamId}`);
    if (dismissed) return;
    void fetch("/api/consent/wa-link").then(r => r.json()).then((d: { link?: string | null; configured?: boolean }) => {
      if (d.link) { setWaLink(d.link); setShowWaConsent(true); }
    }).catch(() => {});
  }, [verified, teamId]);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: (query) => {
        const d = query.state.data;
        if (d?.licenseStatus === "completed" || d?.status === "completed") return false;
        return 3000;
      },
    },
  });

  // Sticky countdown: survives the server auto-clearing the countdown on read
  // so the pre-auction 4-s "officially started" banner can complete fully.
  const _rawDc = (state as { displayCountdown?: { type?: string; endsAt?: string; label?: string | null } | null } | undefined)?.displayCountdown;
  const stickyDc = useStickyCountdown(_rawDc);

  const isCompleted =
    state?.licenseStatus === "completed" || state?.status === "completed";

  const { data: allPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId && !isCompleted,
      refetchInterval: isCompleted ? false : 10000,
    },
  });

  const placeBid = usePlaceBid();
  const [isBidding, setIsBidding] = useState(false);
  const [bidFeedback, setBidFeedback] = useState<"success" | "error" | "leading" | null>(null);

  // Server-authoritative timer: no per-tick parent state. The visible card
  // ticks inside <ServerCountdown /> (isolated). For canBid gating and the
  // "BIDDING CLOSED" branch we only need a single boolean that flips when
  // the timer crosses zero — useTimerExpired() does that with one setTimeout.
  const expired = useTimerExpired(state?.timerEndsAt);
  const timerExpired = !!state?.timerEndsAt && expired;

  const currentPlayerSpecGroups = useRoleSpecGroups(tournament?.sport, state?.currentPlayer?.role);

  const isLeading = state?.currentBidTeamId === teamId;
  const isActive = state?.status === "active";
  const hasPlayer = !!state?.currentPlayer;
  const timerActive = !!state?.timerEndsAt && !expired;
  const teamPurse = allPurses?.find(t => t.teamId === teamId);
  const purseRemaining = teamPurse?.purseRemaining ?? (team ? team.purse - (team.purseUsed || 0) : 0);
  const reservePurse = teamPurse?.reservePurse ?? 0;
  const spendablePurse = teamPurse?.spendablePurse ?? purseRemaining;
  const slotsRequired = teamPurse?.slotsRequired ?? 0;
  const playersBought = teamPurse?.playersBought ?? 0;
  const maxSquad = teamPurse?.maximumSquadSize ?? 0;
  const maxSquadReached = maxSquad > 0 && playersBought >= maxSquad;
  const increment = state?.bidIncrement ?? 50000;
  const nextBidAmount = (state?.currentBid || 0) + increment;
  const categoryMax = state?.currentCategoryMaxPlayers ?? null;
  const categoryCount = categoryMax != null ? ((state?.teamCategoryPlayerCounts as Record<string, number> | null | undefined)?.[String(teamId)] ?? 0) : 0;
  const categoryLimitReached = categoryMax != null && categoryCount >= categoryMax;
  const canBid = isActive && hasPlayer && timerActive && !isLeading && spendablePurse >= nextBidAmount && (team?.isBiddingEnabled ?? true) && !maxSquadReached && !categoryLimitReached;

  async function handleBid() {
    if (!canBid || isBidding) return;
    setIsBidding(true);
    try {
      await placeBid.mutateAsync({ tournamentId, data: { teamId, amount: nextBidAmount } });
      qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
      setBidFeedback("success");
      setTimeout(() => setBidFeedback(null), 1500);
    } catch (err: any) {
      if (err?.response?.data?.error?.includes("already the highest bidder")) {
        setBidFeedback("leading");
      } else {
        setBidFeedback("error");
      }
      setTimeout(() => setBidFeedback(null), 1500);
    } finally {
      setIsBidding(false);
    }
  }

  const teamColor = team?.color || "#F59E0B";

  if (checking || !team) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </FullscreenLayout>
    );
  }

  if (isCompleted) {
    const auctionDate = tournament?.auctionDate
      ? new Date(tournament.auctionDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
      : null;
    return (
      <FullscreenLayout>
        <div
          className="min-h-screen flex flex-col items-center justify-center px-6"
          style={{ background: `radial-gradient(ellipse at top, ${teamColor}12 0%, transparent 55%), #09090b` }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="w-full max-w-sm space-y-8 text-center"
          >
            <div className="space-y-5">
              <div
                className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center"
                style={{ backgroundColor: `${teamColor}20`, border: `2px solid ${teamColor}50` }}
              >
                <CheckCircle2 className="w-12 h-12" style={{ color: teamColor }} />
              </div>
              <div className="space-y-2">
                <h1 className="font-display font-black text-3xl text-white leading-tight">
                  {tournament?.name || team.name}
                </h1>
                {auctionDate && (
                  <p className="text-sm text-muted-foreground">{auctionDate}</p>
                )}
              </div>
            </div>

            <div
              className="rounded-2xl border px-6 py-5 space-y-2"
              style={{ borderColor: `${teamColor}30`, backgroundColor: `${teamColor}08` }}
            >
              <p className="font-display font-bold text-xl text-white">This auction has concluded.</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Please contact the tournament operator for any further queries.
              </p>
            </div>

            <p className="text-xs text-muted-foreground/50 tracking-widest uppercase">
              Powered by BidWar
            </p>
          </motion.div>
        </div>
      </FullscreenLayout>
    );
  }

  if (!verified) {
    return (
      <FullscreenLayout>
        <AccessGate
          tournamentId={tournamentId}
          teamId={teamId}
          teamName={team.name}
          teamColor={teamColor}
          onVerified={() => setVerified(true)}
        />
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div
        className="relative min-h-screen flex flex-col"
        style={{
          background: `radial-gradient(ellipse at top, ${teamColor}15 0%, transparent 55%), #09090b`,
        }}
      >
        {/* WhatsApp Consent Banner */}
        {showWaConsent && waLink && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#25D366]/15 border-b border-[#25D366]/30">
            <MessageSquare className="w-4 h-4 text-[#25D366] flex-shrink-0" />
            <p className="flex-1 text-xs text-foreground">Tournament ke WhatsApp updates chahiye? Auction alerts, results milenge.</p>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold flex-shrink-0 hover:bg-[#1da851] transition-colors">
              Subscribe
            </a>
            <button onClick={() => { setShowWaConsent(false); sessionStorage.setItem(`wa_consent_dismissed_${teamId}`, "1"); }}
              className="p-1 text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-base"
              style={{ backgroundColor: `${teamColor}33`, color: teamColor, border: `2px solid ${teamColor}66` }}>
              {team?.shortCode || "?"}
            </div>
            <div>
              <p className="font-display font-bold text-lg leading-none" style={{ color: teamColor }}>
                {team?.name || "Loading..."}
              </p>
              <p className="text-xs text-muted-foreground">{team?.ownerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Live
            </span>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
              isActive ? "bg-green-500/20 text-green-400" : "bg-border/30 text-muted-foreground"
            }`}>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
              {state?.status?.toUpperCase() || "IDLE"}
            </div>
            <button
              onClick={() => {
                sessionStorage.removeItem(`owner_verified_${teamId}`);
                setVerified(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Break / Pre-Auction Countdown — compact top banner for tablet owner view */}
        {stickyDc && (
          <BreakCountdownOverlay
            key={stickyDc.endsAt}
            type={stickyDc.type}
            endsAt={stickyDc.endsAt}
            message={stickyDc.message}
            tournamentName={tournament?.name}
            compact
          />
        )}

        {/* Purse Stats */}
        <div className="grid grid-cols-3 gap-3 px-6 pt-5">
          <div className="p-4 rounded-2xl border border-border bg-card/50">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Spendable</span>
            </div>
            <p className="font-display font-black text-xl" style={{ color: teamColor }}>
              {formatShortIndianRupee(spendablePurse)}
            </p>
            {reservePurse > 0 && (
              <p className="text-[10px] text-amber-400/80 mt-0.5 font-medium">
                +{formatShortIndianRupee(reservePurse)} reserved
              </p>
            )}
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card/50">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Spent</span>
            </div>
            <p className="font-display font-black text-xl text-foreground">
              {formatShortIndianRupee(teamPurse?.purseUsed ?? (team.purseUsed || 0))}
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card/50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Players</span>
            </div>
            <p className="font-display font-black text-xl text-foreground">
              {teamPurse?.playersBought ?? 0}
            </p>
          </div>
        </div>

        {/* Squad status banners */}
        {(reservePurse > 0 || maxSquadReached || maxSquad > 0) && (
          <div className="mx-6 mt-3 space-y-2">
            {reservePurse > 0 && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/8">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-400">
                    {formatShortIndianRupee(reservePurse)} reserved — {slotsRequired} squad slot{slotsRequired !== 1 ? "s" : ""} still needed
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Protected to fill your minimum squad.
                    {(teamPurse?.lowestBasePrice ?? 0) > 0 && ` Based on ₹${(teamPurse!.lowestBasePrice!).toLocaleString("en-IN")} lowest base price.`}
                  </p>
                </div>
              </div>
            )}
            {maxSquadReached && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-400">Maximum squad size reached — bidding blocked</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Your squad has {playersBought} player{playersBought !== 1 ? "s" : ""} — the maximum allowed is {maxSquad}.
                  </p>
                </div>
              </div>
            )}
            {categoryLimitReached && !maxSquadReached && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-400">Category limit reached — bidding blocked</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Your team already has {categoryCount} player{categoryCount !== 1 ? "s" : ""} in the "{state?.currentCategoryName}" category — the maximum is {categoryMax}.
                  </p>
                </div>
              </div>
            )}
            {maxSquad > 0 && !maxSquadReached && (
              <div className="px-4 py-2.5 rounded-xl border border-border bg-card/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Squad capacity
                  </span>
                  <span className={`font-bold tabular-nums ${playersBought >= maxSquad * 0.8 ? "text-amber-400" : "text-foreground"}`}>
                    {playersBought} / {maxSquad}
                  </span>
                </div>
                <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${playersBought >= maxSquad * 0.8 ? "bg-amber-400" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, maxSquad > 0 ? (playersBought / maxSquad) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timer indicator — ticks inside ServerCountdown (isolated rerender) */}
        {state?.timerEndsAt && (
          <div className="px-6 pt-3">
            <ServerCountdown
              variant="owner"
              timerEndsAt={state.timerEndsAt}
              timerType={state.timerType}
            />
          </div>
        )}

        {/* Current Player */}
        <div className="flex-1 flex flex-col px-6 pt-5 pb-6 gap-5">
          <AnimatePresence mode="wait">
            {hasPlayer ? (
              <motion.div
                key={state?.currentPlayer?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center gap-4 p-5 rounded-2xl border border-border/60 bg-card/40"
              >
                <div className="w-20 h-24 rounded-xl bg-card border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {state?.currentPlayer?.photoUrl ? (
                    <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-9 h-9 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-2xl leading-none">{state?.currentPlayer?.name}</h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    {state?.currentPlayer?.role && (
                      <span className="text-sm text-muted-foreground capitalize">{state.currentPlayer.role}</span>
                    )}
                    {state?.currentPlayer?.age && (
                      <span className="text-xs text-muted-foreground">Age <span className="text-foreground font-semibold">{state.currentPlayer.age}</span></span>
                    )}
                    {state?.currentPlayer?.city && (
                      <span className="text-xs text-muted-foreground">{state.currentPlayer.city}</span>
                    )}
                  </div>
                  {[
                    state?.currentPlayer?.battingStyle,
                    state?.currentPlayer?.bowlingStyle,
                    state?.currentPlayer?.specialization,
                  ].some(Boolean) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {[
                        state?.currentPlayer?.battingStyle,
                        state?.currentPlayer?.bowlingStyle,
                        state?.currentPlayer?.specialization,
                      ].map((val, i) => {
                        if (!val) return null;
                        const label = currentPlayerSpecGroups[i]?.groupName;
                        return (
                          <span key={i} className="text-xs text-muted-foreground">
                            {label ? <><span className="opacity-60">{label}:</span> <span className="text-foreground font-medium">{val}</span></> : <span className="text-foreground font-medium">{val}</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    <span className="text-xs text-muted-foreground">Base <span className="text-foreground font-semibold">{formatIndianRupee(state?.currentPlayer?.basePrice)}</span></span>
                    {state?.currentPlayer?.availabilityDates && (
                      <span className="text-xs text-blue-400">Avail: {state.currentPlayer.availabilityDates}</span>
                    )}
                  </div>
                  {state?.currentPlayer?.achievements && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{state.currentPlayer.achievements}</p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="no-player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center p-8 rounded-2xl border border-dashed border-border/50 bg-card/20"
              >
                <div className="text-center text-muted-foreground">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Waiting for next player...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bid Amount */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isLeading ? "Your Bid — Leading" : "Current Bid"}
            </p>
            <motion.p
              key={state?.currentBid}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-6xl font-display font-black"
              style={{ color: isLeading ? teamColor : "white", textShadow: isLeading ? `0 0 40px ${teamColor}66` : "0 0 30px rgba(255,255,255,0.1)" }}
            >
              {formatIndianRupee(state?.currentBid || 0)}
            </motion.p>
            {hasPlayer && !isLeading && state?.currentBidTeamName && (
              <p className="text-xs text-muted-foreground">
                Leading: <span className="font-semibold text-foreground">{state.currentBidTeamName}</span>
              </p>
            )}
          </div>

          {/* BID BUTTON */}
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {isLeading ? (
                <motion.div
                  key="leading"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full py-8 rounded-3xl border-4 flex flex-col items-center justify-center gap-3"
                  style={{ borderColor: `${teamColor}88`, backgroundColor: `${teamColor}15` }}
                >
                  <Trophy className="w-12 h-12" style={{ color: teamColor }} />
                  <div className="text-center">
                    <p className="font-display font-black text-2xl" style={{ color: teamColor }}>HIGHEST BIDDER</p>
                    <p className="text-sm text-muted-foreground mt-1">Waiting for other teams...</p>
                  </div>
                </motion.div>
              ) : timerExpired && hasPlayer ? (
                <motion.div
                  key="expired"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full py-8 rounded-3xl border-2 border-red-500/30 bg-red-500/10 flex flex-col items-center justify-center gap-3"
                >
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                  <div className="text-center">
                    <p className="font-display font-black text-xl text-red-400">BIDDING CLOSED</p>
                    <p className="text-sm text-muted-foreground mt-1">Timer expired — awaiting operator</p>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="bid-button"
                  onClick={handleBid}
                  disabled={!canBid || isBidding}
                  whileTap={canBid ? { scale: 0.96 } : {}}
                  animate={bidFeedback === "success" ? { scale: [1, 1.05, 1] } : {}}
                  className="w-full py-10 rounded-3xl font-display font-black text-4xl text-black disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{
                    backgroundColor: canBid ? teamColor : "#374151",
                    boxShadow: canBid ? `0 0 60px ${teamColor}44, 0 8px 32px rgba(0,0,0,0.5)` : "none",
                    color: canBid ? "black" : "#6b7280",
                  }}
                >
                  {isBidding ? (
                    <RefreshCw className="w-10 h-10 animate-spin mx-auto" />
                  ) : bidFeedback === "success" ? (
                    "BID PLACED!"
                  ) : (
                    <>
                      BID
                      <span className="block text-lg font-bold mt-1 opacity-80">
                        {formatIndianRupee(nextBidAmount)}
                      </span>
                    </>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            {bidFeedback === "error" && (
              <p className="text-center text-destructive text-sm">Bid failed. Please try again.</p>
            )}

            {!canBid && !isLeading && !timerExpired && hasPlayer && (
              <p className="text-center text-xs text-muted-foreground">
                {!isActive ? "Auction not active"
                  : maxSquadReached ? "Maximum squad size reached"
                  : categoryLimitReached ? `Category limit reached — max ${categoryMax} in "${state?.currentCategoryName}"`
                  : !team.isBiddingEnabled ? "Bidding disabled for your team"
                  : reservePurse > 0 && spendablePurse < nextBidAmount
                  ? `${formatShortIndianRupee(reservePurse)} reserved for ${slotsRequired} squad slot${slotsRequired !== 1 ? "s" : ""}`
                  : `Need ${formatShortIndianRupee(nextBidAmount - spendablePurse)} more purse`}
              </p>
            )}
          </div>
        </div>
      </div>
    </FullscreenLayout>
  );
}
