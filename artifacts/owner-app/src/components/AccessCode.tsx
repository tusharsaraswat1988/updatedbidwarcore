import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import {
  fetchOwnerAccessLockoutStatus,
  persistOwnerSession,
  verifyOwnerAccessCode,
} from "@workspace/api-base/owner-auth";
import { useBranding } from "@/hooks/useBranding";
import { TeamLogo } from "@/components/TeamLogo";
import { loadOnboardingEntries, clearOnboardingEntries } from "@/lib/owner-flow";

type Props = {
  tournamentId: number;
  teamId: number;
  teamName: string;
  teamShortCode: string;
  teamColor: string;
  teamLogoUrl?: string | null;
  tournamentName?: string;
  onVerified: () => void;
  onBack?: () => void;
};

/** Single access-code gate for all owner entry paths. */
export function AccessCode({
  tournamentId,
  teamId,
  teamName,
  teamShortCode,
  teamColor,
  teamLogoUrl,
  tournamentName,
  onVerified,
  onBack,
}: Props) {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState(0);
  const { poweredByText, showPoweredBy } = useBranding();

  const lockedOut = lockoutRemainingSec > 0;

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    const entries = loadOnboardingEntries();
    if (entries.length > 1) {
      setLocation("/join/teams");
      return;
    }
    if (entries.length === 1) {
      setLocation("/join");
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/");
  }

  useEffect(() => {
    if (lockoutRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      setLockoutRemainingSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutRemainingSec > 0]);

  // Re-check server when organiser clears lockout (don't wait for local countdown).
  useEffect(() => {
    if (!lockedOut) return;
    let cancelled = false;
    const poll = async () => {
      const status = await fetchOwnerAccessLockoutStatus(tournamentId, teamId);
      if (cancelled) return;
      if (!status.locked) {
        setLockoutRemainingSec(0);
        setError("");
      } else if (status.lockoutRemainingSec > 0) {
        setLockoutRemainingSec(status.lockoutRemainingSec);
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [lockedOut, tournamentId, teamId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading || lockedOut) return;
    setLoading(true);
    setError("");

    const result = await verifyOwnerAccessCode(tournamentId, teamId, code);
    if (result.ok) {
      clearOnboardingEntries();
      persistOwnerSession(teamId, code);
      onVerified();
    } else if (result.reason === "lockout") {
      setLockoutRemainingSec(result.lockoutRemainingSec);
      setError(
        "Too many incorrect attempts. Please try again later or contact the tournament organiser.",
      );
      setCode("");
    } else {
      setError("Incorrect code. Please try again.");
      setCode("");
    }
    setLoading(false);
  }

  return (
    <div
      className="relative h-full flex flex-col items-center justify-between px-6 py-5 bg-background overscroll-none overflow-y-auto safe-top safe-bottom"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}18 0%, transparent 55%), #1e1845` }}
    >
      {/* ── Top full-width live animated line across the viewport ── */}
      <div className="fixed top-0 left-0 right-0 h-[3px] overflow-hidden bg-black/40 z-50 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${teamColor} 50%, transparent 100%)`,
          }}
        />
        <motion.div
          className="absolute top-0 bottom-0 w-48 rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${teamColor}, #10B981, #F59E0B, transparent)`,
            boxShadow: `0 0 14px 2px ${teamColor}, 0 0 24px 4px #10B981`,
          }}
          animate={{
            left: ["-200px", "100%"],
          }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* ── Top Navigation Bar: Back / Change Team ── */}
      <div className="w-full max-w-sm flex items-center justify-between pt-2 pb-1 z-20">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Change team"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2a2458]/90 hover:bg-[#342e66] text-[#a8a0c4] hover:text-white border border-[#4a4478]/70 active:scale-95 transition-all text-xs font-semibold shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change team</span>
        </button>
        {tournamentName && (
          <span className="text-xs font-semibold text-[#a8a0c4]/70 truncate max-w-[190px]">
            {tournamentName}
          </span>
        )}
      </div>

      {/* ── Main Access Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="w-full max-w-sm space-y-6 my-auto"
      >
        <div className="text-center space-y-4">
          {/* Live indicator & lively animated line */}
          <div className="flex flex-col items-center gap-1.5 mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18123a]/80 border border-[#4a4478]/60 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-emerald-400 font-display">
                LIVE AUCTION ROOM
              </span>
            </div>

            {/* Glowing animated line */}
            <div className="relative w-44 h-[2.5px] overflow-hidden rounded-full bg-white/10 mt-1">
              <motion.div
                className="absolute inset-y-0 w-24 rounded-full"
                style={{
                  background: `linear-gradient(90deg, transparent, ${teamColor}, #34d399, ${teamColor}, transparent)`,
                  boxShadow: `0 0 10px ${teamColor}, 0 0 18px #34d399`,
                }}
                animate={{
                  left: ["-50%", "150%"],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </div>

          <TeamLogo
            logoUrl={teamLogoUrl}
            shortCode={teamShortCode}
            teamName={teamName}
            teamColor={teamColor}
            className="w-28 h-28 rounded-3xl mx-auto"
            textClassName="text-4xl"
            fallback={
              teamShortCode ? undefined : (
                <Lock className="w-12 h-12" style={{ color: teamColor }} />
              )
            }
          />
          <div>
            <h1 className="font-display font-black text-4xl text-white tracking-wide">{teamName}</h1>
            <p className="text-[#a8a0c4] text-lg mt-2">Enter your access code to join</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
              placeholder="ACCESS CODE"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              disabled={lockedOut}
              className="w-full px-6 py-6 rounded-2xl border border-[#3d3670] text-center font-display font-bold text-3xl tracking-[0.35em] bg-[#2a2458] text-white placeholder:text-[#6b6490] outline-none transition-colors"
              style={{ borderColor: code ? teamColor : undefined }}
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-[#a8a0c4] hover:text-[#a8a0c4] transition-colors p-2"
            >
              {showCode ? <EyeOff className="w-7 h-7" /> : <Eye className="w-7 h-7" />}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-base text-center font-semibold"
              >
                {error}
                {lockedOut && lockoutRemainingSec > 0 && (
                  <span className="block mt-1 text-sm text-red-300/80 tabular-nums">
                    Try again in {Math.floor(lockoutRemainingSec / 60)}:{String(lockoutRemainingSec % 60).padStart(2, "0")}
                  </span>
                )}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={!code.trim() || loading || lockedOut}
            whileTap={{ scale: 0.97 }}
            className="w-full py-6 rounded-2xl font-display font-black text-2xl text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ backgroundColor: teamColor, boxShadow: `0 0 40px ${teamColor}44` }}
          >
            {loading ? (
              <div className="w-7 h-7 border-3 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            ) : "ENTER"}
          </motion.button>
        </form>

        {/* Secondary back link if user tapped the wrong team */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={handleBack}
            className="text-xs text-[#a8a0c4]/90 hover:text-amber-400 transition-colors font-medium inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-white/5 active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Wrong team? Select another team</span>
          </button>
        </div>
      </motion.div>

      {/* ── Footer Branding ── */}
      <div className="w-full text-center pb-2 z-20">
        {showPoweredBy && (
          <p className="text-xs text-[#524982] uppercase tracking-widest text-center select-none font-medium">
            {poweredByText}
          </p>
        )}
      </div>
    </div>
  );
}
