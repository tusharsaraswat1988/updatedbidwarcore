import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";
import {
  fetchOwnerAccessLockoutStatus,
  persistOwnerSession,
  verifyOwnerAccessCode,
} from "@workspace/api-base/owner-auth";
import { useBranding } from "@/hooks/useBranding";
import { TeamLogo } from "@/components/TeamLogo";

type Props = {
  tournamentId: number;
  teamId: number;
  teamName: string;
  teamShortCode: string;
  teamColor: string;
  teamLogoUrl?: string | null;
  onVerified: () => void;
};

/** Single access-code gate for all owner entry paths. */
export function AccessCode({
  tournamentId,
  teamId,
  teamName,
  teamShortCode,
  teamColor,
  teamLogoUrl,
  onVerified,
}: Props) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState(0);
  const { brandName, logos, poweredByText, miniBrandText } = useBranding();

  const lockedOut = lockoutRemainingSec > 0;

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
      className="h-full flex flex-col items-center justify-center px-6 bg-[#09090b] overscroll-none"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}18 0%, transparent 55%), #09090b` }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-5">
          <div className="flex items-center justify-center gap-2 mb-2">
            {logos.mini ? (
              <img src={logos.mini} alt={brandName} className="h-8 w-auto" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs bg-amber-400/20 text-amber-400 border border-amber-400/30">
                {miniBrandText}
              </div>
            )}
            <span className="font-display font-black text-lg text-white tracking-wide">{brandName}</span>
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
            <p className="text-[#71717a] text-lg mt-2">Enter your access code to join</p>
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
              className="w-full px-6 py-6 rounded-2xl border border-[#3f3f46] text-center font-display font-bold text-3xl tracking-[0.35em] bg-[#18181b] text-white placeholder:text-[#52525b] outline-none transition-colors"
              style={{ borderColor: code ? teamColor : undefined }}
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a1a1aa] transition-colors p-2"
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

        <p className="text-sm text-[#3f3f46] uppercase tracking-widest text-center">
          {poweredByText}
        </p>
      </motion.div>
    </div>
  );
}
