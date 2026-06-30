import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  useGetTournament,
  useSetBreakTimer,
  getGetAuctionStateQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Coffee, Play, StopCircle, PlusCircle, ShieldAlert, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function useRemainingTime(endsAt: string | null | undefined) {
  const [msLeft, setMsLeft] = useState(() =>
    endsAt ? Math.max(0, new Date(endsAt).getTime() - Date.now()) : 0,
  );

  useEffect(() => {
    if (!endsAt) { setMsLeft(0); return; }
    setMsLeft(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    const id = setInterval(() => {
      setMsLeft(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const totalSecs = Math.max(0, Math.ceil(msLeft / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const expired = msLeft <= 0;
  return { mins, secs, expired, totalSecs };
}

function isCountdownActive(dc: { type?: string; endsAt?: string } | null): boolean {
  return !!dc?.endsAt && (dc.type === "break" || dc.type === "pre-auction");
}

export default function BreakTimerPage() {
  const [, params] = useRoute("/tournament/:id/break-timer");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: state, refetch } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 2000,
    },
  });

  const setBreakTimerMut = useSetBreakTimer();

  const [breakMinutes, setBreakMinutes] = useState("5");
  const [breakSeconds, setBreakSeconds] = useState("0");
  const [breakLabel, setBreakLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const dc = (state as { displayCountdown?: { type?: string; endsAt?: string; message?: string | null; musicMuted?: boolean } | null } | undefined)?.displayCountdown ?? null;
  const { mins, secs, expired } = useRemainingTime(isCountdownActive(dc) ? dc?.endsAt : null);

  async function handleStartBreak() {
    const mins = Math.max(0, parseInt(breakMinutes, 10) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(breakSeconds, 10) || 0));
    const durationSeconds = mins * 60 + secs;
    if (durationSeconds < 10 || durationSeconds > 3600) {
      setError("Duration must be between 10 seconds and 60 minutes.");
      return;
    }
    setError(null);
    try {
      await setBreakTimerMut.mutateAsync({
        tournamentId,
        data: { action: "start", durationSeconds, message: breakLabel || undefined },
      });
      await refetch();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to start countdown.";
      setError(msg);
    }
  }

  async function handleExtend() {
    setError(null);
    try {
      await setBreakTimerMut.mutateAsync({
        tournamentId,
        data: { action: "extend", durationSeconds: 300 },
      });
      await refetch();
    } catch { setError("Failed to extend countdown."); }
  }

  async function handleToggleBreakMusic() {
    const muted = dc?.musicMuted === true;
    try {
      await setBreakTimerMut.mutateAsync({
        tournamentId,
        data: { action: muted ? "unmute_music" : "mute_music" },
      });
      await refetch();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Could not update break music.";
      setError(msg);
    }
  }

  async function handleCancelBreak() {
    setError(null);
    try {
      await setBreakTimerMut.mutateAsync({ tournamentId, data: { action: "cancel" } });
      await refetch();
    } catch { setError("Failed to cancel countdown."); }
  }

  const countdownActive = isCountdownActive(dc) && !expired;
  const auctionIsLive = state?.status === "active";

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="max-w-lg mx-auto space-y-6 pt-2">
        <div>
          <h1 className="text-2xl font-display font-black text-foreground">Pre Auction & Break Timer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Put a countdown on the big screen before the auction starts or during breaks.
          </p>
          <div className="mt-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">How it works:</strong> Set a duration and a label (e.g. &quot;Pre Auction&quot; or &quot;Lunch Break — 15 min&quot;), then press Start. The countdown appears on all displays. When time is up, screens switch back automatically.</p>
            <p>You can extend the timer or cancel it at any time from this page.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Active countdown status */}
        <AnimatePresence>
          {dc && isCountdownActive(dc) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
            >
              <div className="flex items-center gap-3">
                <Coffee className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Countdown — Active
                  </p>
                  {dc.message && (
                    <p className="text-xs text-muted-foreground mt-0.5">{dc.message}</p>
                  )}
                </div>
                <div className="font-display font-black text-2xl tabular-nums text-foreground flex-shrink-0">
                  {expired ? (
                    <span className="text-green-400 text-base font-bold">Expired</span>
                  ) : (
                    <span className="text-amber-400">
                      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!expired && dc?.type === "break" && (
                  <button
                    onClick={handleToggleBreakMusic}
                    disabled={setBreakTimerMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-foreground hover:bg-white/10 text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    {dc.musicMuted ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        Resume music
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        Stop music
                      </>
                    )}
                  </button>
                )}
                {!expired && (
                  <button
                    onClick={handleExtend}
                    disabled={setBreakTimerMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Extend +5 min
                  </button>
                )}
                <button
                  onClick={handleCancelBreak}
                  disabled={setBreakTimerMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-semibold transition-colors disabled:opacity-40 ml-auto"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown setup */}
        <div className="rounded-xl border border-border bg-card/40 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-foreground">Start Countdown</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Minutes
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Seconds
              </label>
              <input
                type="number"
                min={0}
                max={59}
                value={breakSeconds}
                onChange={(e) => setBreakSeconds(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Label (optional)
              </label>
              <input
                type="text"
                maxLength={60}
                value={breakLabel}
                onChange={(e) => setBreakLabel(e.target.value)}
                placeholder="e.g. Pre Auction"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {auctionIsLive && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              Live bidding will auto-pause and the countdown will appear on all displays.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleStartBreak}
              disabled={setBreakTimerMut.isPending || countdownActive}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 font-semibold text-sm transition-colors disabled:opacity-40"
            >
              <Play className="w-4 h-4" />
              {countdownActive ? "Countdown Active" : "Start Countdown"}
            </button>
            {countdownActive && (
              <button
                onClick={handleExtend}
                disabled={setBreakTimerMut.isPending}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-semibold text-sm transition-colors disabled:opacity-40"
              >
                <PlusCircle className="w-4 h-4" />
                +5 min
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {[5, 10, 15, 30].map((m) => (
              <button
                key={m}
                onClick={() => setBreakMinutes(String(m))}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  breakMinutes === String(m)
                    ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                    : "border-border text-muted-foreground hover:border-amber-500/30 hover:text-amber-400"
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
